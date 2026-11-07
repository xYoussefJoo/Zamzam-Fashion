using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.ValueObjects;

namespace Zamzam.Application.Tailoring;

// ===================== #14 POST /api/tailoring/requests =====================

public sealed record TailoringRequestCommand(
    CheckoutCustomer Customer,
    string? StyleId,
    string Garment,
    string Fabric,
    string Color,
    string Fit,
    SizingMode SizingMode,
    string? StandardSize,
    Dictionary<string, decimal>? Measurements,
    bool Lining,
    string[]? Extras,
    string? Notes,
    bool AcceptTerms);

public sealed class TailoringRequestValidator : AbstractValidator<TailoringRequestCommand>
{
    public TailoringRequestValidator()
    {
        RuleFor(c => c.Customer).NotNull();
        RuleFor(c => c.Customer.Name).NotEmpty().Length(3, 100).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.Phone).NotEmpty().MaximumLength(20).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.Email).EmailAddress().MaximumLength(254)
            .When(c => c.Customer is not null && !string.IsNullOrWhiteSpace(c.Customer.Email));
        RuleFor(c => c.Customer.DeliveryZoneId).GreaterThan(0).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.City).NotEmpty().Length(2, 100).When(c => c.Customer is not null);
        RuleFor(c => c.Customer.Address).NotEmpty().Length(10, 500).When(c => c.Customer is not null);

        RuleFor(c => c.StyleId).MaximumLength(50);
        RuleFor(c => c.Garment).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Fabric).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Color).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Fit).NotEmpty().MaximumLength(50);
        RuleFor(c => c.SizingMode).IsInEnum();
        RuleFor(c => c.StandardSize).NotEmpty().When(c => c.SizingMode == SizingMode.StandardSize);
        RuleFor(c => c.Measurements).NotEmpty().When(c => c.SizingMode == SizingMode.Measurements)
            .WithMessage("Enter at least one measurement, or choose a standard size.");
        RuleFor(c => c.Extras).Must(e => e!.Length <= 20).When(c => c.Extras is not null);
        RuleFor(c => c.Notes).MaximumLength(1000);
        RuleFor(c => c.AcceptTerms).Equal(true).WithMessage("Please accept the terms to send the request.");
    }
}

public sealed record PlacedTailoringRequestDto(string Number, string TrackingToken, string TrackingUrl, OrderStatus Status,
    decimal EstimatedPrice, decimal DeliveryFee, decimal EstimatedTotal);

// check customer + catalog → recalculate the price → (optional) photo to the private bucket → save the order.
public sealed class PlaceTailoringRequestHandler(
    IAppDbContext db,
    IOrderNumberGenerator numbers,
    IImageStorage storage,
    IImageProcessor processor,
    IEmailQueue emails,
    ISiteLinks links,
    TimeProvider clock,
    ILogger<PlaceTailoringRequestHandler> logger)
{
    public async Task<PlacedTailoringRequestDto> HandleAsync(TailoringRequestCommand c, Stream? photo, long photoLength, CancellationToken ct)
    {
        var x = c.Customer;
        var customer = new CustomerInfo(x.Name, x.Phone, x.Email, x.City, x.Address, x.Notes);
        var zone = await db.DeliveryZones.AsNoTracking().FirstOrDefaultAsync(z => z.Id == x.DeliveryZoneId && z.IsActive, ct)
            ?? throw new DomainException(ErrorCodes.Validation, "We don't deliver to this governorate yet.");

        // The catalog checks style/garment/fabric/fit and that every measurement belongs to the garment.
        var catalog = await TailoringData.CatalogAsync(db, ct);
        catalog.EnsureValidRequest(c.StyleId, c.Garment, c.Fabric, c.Fit, c.SizingMode, c.Measurements);
        var estimate = (await TailoringData.PricesAsync(db, ct))
            .Estimate(c.StyleId, c.Garment, c.Fabric, c.Lining, c.SizingMode, c.StandardSize, c.Extras);

        // The photo is re-encoded (no EXIF / GPS) and stored privately; only the owner can open it.
        string? photoKey = null;
        if (photo is not null && photoLength > 0)
        {
            await using var checkedPhoto = await PhotoUpload.ReadCheckedAsync(photo, photoLength, ct);
            var largest = (await processor.ToWebpSizesAsync(checkedPhoto, ct)).MaxBy(p => p.Width)!;
            photoKey = $"tailoring/{Guid.NewGuid():N}.webp";
            await storage.UploadPrivateAsync(photoKey, largest.Content, "image/webp", ct);
        }

        try
        {
            var spec = new TailoringSpec(c.StyleId, c.Garment, c.Fabric, c.Color, c.Fit, c.SizingMode, c.StandardSize,
                c.SizingMode == SizingMode.Measurements ? c.Measurements : null, c.Lining, c.Extras, photoKey, estimate.Total, c.Notes);

            var (token, hash) = TrackingTokens.Create();
            var order = await db.InTransactionAsync(async t =>
            {
                var created = Order.CreateCustom(await numbers.NextAsync(t), hash, customer, zone.Id, zone.Fee, spec,
                    clock.GetUtcNow().UtcDateTime);
                db.Orders.Add(created);
                await db.SaveChangesAsync(t);
                return created;
            }, ct);

            TailoringEmails.NewRequest(emails, links, order, token);
            return new PlacedTailoringRequestDto(order.Number, token, links.TrackingPage(order.Number, token), order.Status,
                spec.EstimatedPrice, order.DeliveryFee, order.Total);
        }
        catch
        {
            if (photoKey is not null) await DeletePhotoQuietlyAsync(photoKey);
            throw;
        }
    }

    private async Task DeletePhotoQuietlyAsync(string key)
    {
        try { await storage.DeletePrivateAsync([key], CancellationToken.None); }
        catch (Exception ex) { logger.LogWarning(ex, "Could not delete the unused tailoring photo {Key}", key); }
    }
}
