using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;

namespace Zamzam.Application.Orders;

public sealed record AdminOrdersQuery(
    OrderStatus[]? Status = null,
    OrderType? Type = null,
    string? Q = null,
    DateTime? From = null,
    DateTime? To = null,
    int? Page = null,
    int? PageSize = null);

public sealed class AdminOrdersQueryValidator : AbstractValidator<AdminOrdersQuery>
{
    public AdminOrdersQueryValidator()
    {
        RuleFor(q => q.Q).MaximumLength(100);
        RuleFor(q => q.To).GreaterThanOrEqualTo(q => q.From).When(q => q.From is not null && q.To is not null)
            .WithMessage("'To' must be after 'From'.");
    }
}

// #35 GET /api/admin/orders — the order board.
public sealed class ListAdminOrdersHandler(IAppDbContext db)
{
    public async Task<Paged<AdminOrderRow>> HandleAsync(AdminOrdersQuery query, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        var orders = db.Orders.AsNoTracking();

        if (query.Status is { Length: > 0 } statuses) orders = orders.Where(o => statuses.Contains(o.Status));
        if (query.Type is OrderType type) orders = orders.Where(o => o.Type == type);
        if (query.From is DateTime from) orders = orders.Where(o => o.CreatedAt >= from.ToUniversalTime());
        if (query.To is DateTime to) orders = orders.Where(o => o.CreatedAt <= to.ToUniversalTime());
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var text = query.Q.Trim();
            var upper = text.ToUpperInvariant();
            var digits = new string(text.Where(char.IsDigit).ToArray()).TrimStart('0'); // "0101…" also finds "+20101…"
            orders = orders.Where(o => o.Number.Contains(upper)
                || o.Customer.Name.ToLower().Contains(text.ToLower())
                || (digits.Length >= 4 && o.Customer.Phone.Contains(digits)));
        }

        var rows = from o in orders
                   join z in db.DeliveryZones on o.DeliveryZoneId equals z.Id
                   orderby o.CreatedAt descending, o.Id descending
                   select new AdminOrderRow(o.Id, o.Number, o.Type, o.Status, o.Customer.Name, o.Customer.Phone,
                       z.NameAr, z.NameEn, o.Total, o.PaymentStatus, o.CreatedAt, o.Lines.Sum(l => (int?)l.Quantity) ?? 0);

        var total = await rows.CountAsync(ct);
        var items = await rows.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return Paging.Create(items, page, pageSize, total);
    }
}

// #36 GET /api/admin/orders/{id} — everything, unmasked, with who changed what.
public sealed class GetAdminOrderHandler(IAppDbContext db, IUserDirectory users)
{
    public async Task<AdminOrderDetail> HandleAsync(int id, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking()
            .Include(o => o.Lines).Include(o => o.History).Include(o => o.Tailoring)
            .FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw new NotFoundException("Order");
        return await ToDetailAsync(db, users, order, ct);
    }

    internal static async Task<AdminOrderDetail> ToDetailAsync(IAppDbContext db, IUserDirectory users, Order o, CancellationToken ct)
    {
        var zone = await db.DeliveryZones.AsNoTracking().FirstAsync(z => z.Id == o.DeliveryZoneId, ct);
        var names = await users.NamesAsync(o.History.Where(h => h.ChangedByUserId is not null).Select(h => h.ChangedByUserId!).Distinct(), ct);
        var c = o.Customer;
        var t = o.Tailoring;

        return new AdminOrderDetail(o.Id, o.Number, o.Type, o.Status, o.CreatedAt,
            new AdminCustomerDto(c.Name, c.Phone, c.Email, c.City, c.Address, c.Notes),
            zone.ToAdminDto(),
            o.Lines.OrderBy(l => l.Id).Select(l => l.ToDto()).ToList(),
            o.Subtotal, o.DeliveryFee, o.Total, o.PaymentMethod, o.PaymentStatus,
            o.History.OrderBy(h => h.ChangedAt).ThenBy(h => h.Id).Select(h => new AdminHistoryEvent(h.FromStatus, h.ToStatus, h.ChangedAt, h.Note,
                h.ChangedByUserId is null ? null : names.GetValueOrDefault(h.ChangedByUserId, "Deleted account"))).ToList(),
            t is null ? null : new AdminTailoringDto(t.StyleId, t.Garment, t.Fabric, t.Color, t.Fit, t.SizingMode, t.StandardSize,
                t.Measurements, t.HasLining, t.Extras, t.ReferenceImageKey is not null, t.EstimatedPrice, t.QuotedPrice,
                t.QuoteNote, t.QuoteValidUntil, t.QuoteApprovedAt));
    }
}

public sealed record ChangeOrderStatusCommand(OrderStatus To, string? Note);

public sealed class ChangeOrderStatusValidator : AbstractValidator<ChangeOrderStatusCommand>
{
    public ChangeOrderStatusValidator()
    {
        RuleFor(c => c.To).IsInEnum();
        RuleFor(c => c.Note).MaximumLength(500);
    }
}

// #37 POST /api/admin/orders/{id}/status — only the moves in the status machine; cancelling puts stock back.
public sealed class ChangeOrderStatusHandler(IAppDbContext db, IUserDirectory users, IEmailQueue emails, TimeProvider clock)
{
    private const int MaxAttempts = 3;

    public async Task<AdminOrderDetail> HandleAsync(int id, ChangeOrderStatusCommand command, string? userId, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                // History must be loaded: the order records "from → to" by looking at its existing history.
                var order = await db.Orders.Include(o => o.Lines).Include(o => o.History).Include(o => o.Tailoring)
                    .FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw new NotFoundException("Order");

                var returns = order.ChangeStatus(command.To, userId, command.Note, clock.GetUtcNow().UtcDateTime);
                if (returns.Count > 0)
                {
                    var ids = returns.Select(r => r.VariantId).ToList();
                    var variants = await db.ProductVariants.Where(v => ids.Contains(v.Id)).ToDictionaryAsync(v => v.Id, ct);
                    // A variant deleted for good can't come back; soft-deleted ones still get their stock.
                    foreach (var r in returns.Where(r => variants.ContainsKey(r.VariantId))) variants[r.VariantId].Restock(r.Quantity);
                }

                await db.SaveChangesAsync(ct); // order + stock in one save = one transaction
                OrderEmails.StatusChanged(emails, order);
                return await GetAdminOrderHandler.ToDetailAsync(db, users, order, ct);
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxAttempts)
            {
                db.ClearChanges(); // a checkout touched the same stock at the same moment: retry with fresh values
            }
        }
    }
}
