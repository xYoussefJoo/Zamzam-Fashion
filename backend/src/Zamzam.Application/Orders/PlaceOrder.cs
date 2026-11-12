using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Zamzam.Application.Catalog;
using Zamzam.Application.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.ValueObjects;

namespace Zamzam.Application.Orders;

public sealed record CheckoutCustomer(string Name, string Phone, string? Email, int DeliveryZoneId, string City, string Address, string? Notes);

public sealed record CheckoutLine(int VariantId, int Qty);

public sealed record PlaceOrderCommand(
    CheckoutCustomer Customer,
    IReadOnlyList<CheckoutLine> Lines,
    string PaymentMethod,
    decimal ExpectedTotal,
    bool AcceptTerms);

public sealed class PlaceOrderValidator : AbstractValidator<PlaceOrderCommand>
{
    public PlaceOrderValidator()
    {
        RuleFor(c => c.Customer).NotNull();
        RuleFor(c => c.Customer.Name).NotEmpty().Length(3, 100).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.Phone).NotEmpty().MaximumLength(20).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.Email).EmailAddress().MaximumLength(254)
            .When(c => c.Customer is not null && !string.IsNullOrWhiteSpace(c.Customer.Email));
        RuleFor(c => c.Customer.DeliveryZoneId).GreaterThan(0).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.City).NotEmpty().Length(2, 100).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.Address).NotEmpty().Length(10, 500).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.Notes).MaximumLength(500).When(c => c.Customer is not null);

        RuleFor(c => c.Lines).NotEmpty().Must(l => l.Count <= Order.MaxLines).WithMessage($"At most {Order.MaxLines} items.");
        RuleForEach(c => c.Lines).ChildRules(line =>
        {
            line.RuleFor(l => l.VariantId).GreaterThan(0);
            line.RuleFor(l => l.Qty).InclusiveBetween(1, OrderLine.MaxQuantity);
        });
        RuleFor(c => c.Lines)
            .Must(lines => lines.GroupBy(l => l.VariantId).All(g => g.Sum(l => l.Qty) <= OrderLine.MaxQuantity))
            .When(c => c.Lines is not null).WithMessage($"At most {OrderLine.MaxQuantity} pieces of the same item.");

        RuleFor(c => c.PaymentMethod).Equal("CashOnDelivery").WithMessage("Only cash on delivery is available.");
        RuleFor(c => c.ExpectedTotal).GreaterThanOrEqualTo(0);
        RuleFor(c => c.AcceptTerms).Equal(true).WithMessage("Please accept the terms to place the order.");
    }
}

public sealed record StockShortage(int VariantId, int Requested, int Available);

// #10 POST /api/orders — guest checkout, cash on delivery.
// 1 check the customer → 2 load the items → 3 re-price on the server → 4 compare with what the customer saw
// → 5 check ALL stock → 6 reserve → 7 save the order — steps 2–7 in one transaction.
public sealed class PlaceOrderHandler(
    IAppDbContext db,
    IOrderNumberGenerator numbers,
    IImageStorage storage,
    IEmailQueue emails,
    ISiteLinks links,
    TimeProvider clock,
    ILogger<PlaceOrderHandler> logger)
{
    private const int MaxAttempts = 3;

    public async Task<PlacedOrderDto> HandleAsync(PlaceOrderCommand command, CancellationToken ct)
    {
        // Fail fast on bad customer data (phone, email, address) before touching stock.
        var c = command.Customer;
        var customer = new CustomerInfo(c.Name, c.Phone, c.Email, c.City, c.Address, c.Notes);
        var lines = command.Lines.GroupBy(l => l.VariantId)
            .Select(g => new CheckoutLine(g.Key, g.Sum(l => l.Qty))).ToList(); // duplicates merged

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var (order, token) = await db.InTransactionAsync(
                    t => PlaceAsync(customer, c.DeliveryZoneId, lines, command.ExpectedTotal, t), ct);
                OrderEmails.NewOrder(emails, links, order, token);
                return new PlacedOrderDto(order.Number, token, links.TrackingPage(order.Number, token), order.Status,
                    order.Subtotal, order.DeliveryFee, order.Total, order.Lines.Select(l => l.ToDto()).ToList());
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxAttempts)
            {
                // Someone bought the same item at the same moment: start again from fresh stock numbers.
                // If it really ran out, the next attempt answers OUT_OF_STOCK.
                logger.LogInformation("Stock changed during checkout, retrying (attempt {Attempt}).", attempt + 1);
                db.ClearChanges();
            }
        }
    }

    private async Task<(Order Order, string Token)> PlaceAsync(CustomerInfo customer, int zoneId,
        IReadOnlyList<CheckoutLine> lines, decimal expectedTotal, CancellationToken ct)
    {
        var zone = await db.DeliveryZones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == zoneId && z.IsActive, ct)
            ?? throw new DomainException(ErrorCodes.Validation, "We don't deliver to this governorate yet.");

        // Load every wanted variant with its product, color and main photo (tracked: stock will change).
        var ids = lines.Select(l => l.VariantId).ToList();
        var products = await db.Products
            .Include(p => p.Variants.Where(v => ids.Contains(v.Id))).ThenInclude(v => v.Color)
            .Include(p => p.Images.Where(i => i.SortOrder == 0))
            .Where(p => p.Variants.Any(v => ids.Contains(v.Id)))
            .ToListAsync(ct);
        var found = products.SelectMany(p => p.Variants.Select(v => (Product: p, Variant: v))).ToDictionary(x => x.Variant.Id);

        // Check ALL lines first, so the customer sees every missing item in one answer.
        var shortages = lines.Select(line =>
        {
            var available = found.TryGetValue(line.VariantId, out var item) && IsSellable(item.Product, item.Variant)
                ? item.Variant.Stock : 0;
            return new StockShortage(line.VariantId, line.Qty, available);
        }).Where(s => s.Requested > s.Available).ToList();
        if (shortages.Count > 0)
            throw new ConflictException(ErrorCodes.OutOfStock, "Some items are no longer available in that quantity.",
                new Dictionary<string, object?> { ["items"] = shortages });

        // Prices come from the database, never from the browser.
        var drafts = lines.Select(line =>
        {
            var (product, variant) = found[line.VariantId];
            var image = product.Images.FirstOrDefault();
            return new OrderLineDraft(variant.Id, product.NameAr, product.NameEn, variant.Size,
                variant.Color!.NameAr, variant.Color.NameEn, variant.PriceFrom(product.BasePrice), line.Qty,
                image is null ? null : storage.PublicUrl(ImageKeys.ForWidth(image.StorageKey, ImageSizes.Thumbnail)));
        }).ToList();

        var subtotal = drafts.Sum(d => d.UnitPrice * d.Quantity);
        var total = subtotal + zone.Fee;
        if (total != expectedTotal)
            throw new ConflictException(ErrorCodes.PriceChanged, "Prices or the delivery fee changed. Please review the new total.",
                new Dictionary<string, object?> { ["subtotal"] = subtotal, ["deliveryFee"] = zone.Fee, ["total"] = total });

        var number = await numbers.NextAsync(ct);
        foreach (var line in lines)
        {
            found[line.VariantId].Variant.Reserve(line.Qty);
            // Stock history: written by the checkout itself (no owner), in the same save as the order.
            db.StockMovements.Add(new StockMovement(line.VariantId, -line.Qty, StockReason.Sold, number, createdBy: null));
        }

        var (token, hash) = TrackingTokens.Create();
        var order = Order.CreateReady(number, hash, customer, zone.Id, zone.Fee, drafts,
            clock.GetUtcNow().UtcDateTime);
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct); // fails with a concurrency error if a variant changed since we read it
        return (order, token);
    }

    private static bool IsSellable(Product product, ProductVariant variant) =>
        product.IsVisible && !product.IsDeleted && !variant.IsDeleted;
}
