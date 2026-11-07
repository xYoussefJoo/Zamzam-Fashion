using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Entities;

namespace Zamzam.Application.Orders;

// #11 GET /api/orders/{number} with the X-Tracking-Token header.
// Unknown number and wrong token give the same 404, so nobody can probe which order numbers exist.
public sealed class TrackOrderHandler(IAppDbContext db)
{
    public async Task<PublicOrderDto> HandleAsync(string number, string? token, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking()
            .Include(o => o.Lines).Include(o => o.History).Include(o => o.Tailoring)
            .FirstOrDefaultAsync(o => o.Number == number, ct);
        if (order is null || !TrackingTokens.Matches(token, order.TrackingTokenHash))
            throw new NotFoundException("Order");

        var zone = await db.DeliveryZones.AsNoTracking().FirstAsync(z => z.Id == order.DeliveryZoneId, ct);
        var t = order.Tailoring;

        return new PublicOrderDto(order.Number, order.Type, order.Status, order.CreatedAt,
            new PublicCustomerDto(MaskName(order.Customer.Name), MaskPhone(order.Customer.Phone), new PublicZoneRef(zone.NameAr, zone.NameEn)),
            order.Lines.OrderBy(l => l.Id).Select(l => l.ToDto()).ToList(),
            order.Subtotal, order.DeliveryFee, order.Total, order.PaymentMethod, order.PaymentStatus,
            order.History.OrderBy(h => h.ChangedAt).ThenBy(h => h.Id).Select(h => new TimelineEvent(h.FromStatus, h.ToStatus, h.ChangedAt)).ToList(),
            t is null ? null : new PublicTailoringDto(t.Garment, t.Fabric, t.Color, t.Fit, t.EstimatedPrice, t.QuotedPrice, t.QuoteNote, t.QuoteValidUntil));
    }

    // "Mona Ahmed Ali" -> "Mona A."
    internal static string MaskName(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length < 2 ? parts[0] : $"{parts[0]} {parts[1][0]}.";
    }

    // "+201012345678" -> "+20101****678"
    internal static string MaskPhone(string phone) =>
        phone.Length <= 9 ? "****" : phone[..6] + "****" + phone[^3..];
}
