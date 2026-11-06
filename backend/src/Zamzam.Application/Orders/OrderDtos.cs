using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;

namespace Zamzam.Application.Orders;

public sealed record ZoneDto(int Id, string Key, string NameAr, string NameEn, decimal Fee, int EtaDaysMin, int EtaDaysMax);

public sealed record AdminZoneDto(int Id, string Key, string NameAr, string NameEn, decimal Fee, int EtaDaysMin, int EtaDaysMax, bool IsActive);

public sealed record OrderLineDto(int VariantId, string ProductNameAr, string ProductNameEn, string Size,
    string ColorNameAr, string ColorNameEn, decimal UnitPrice, int Qty, decimal LineTotal, string? ImageUrl);

public sealed record PlacedOrderDto(string Number, string TrackingToken, string TrackingUrl, OrderStatus Status,
    decimal Subtotal, decimal DeliveryFee, decimal Total, IReadOnlyList<OrderLineDto> Lines);

// ---------- public tracking (#7 in the contract = #11 here): personal data masked, no internal notes

public sealed record PublicZoneRef(string NameAr, string NameEn);

public sealed record PublicCustomerDto(string Name, string Phone, PublicZoneRef Zone);

public sealed record TimelineEvent(OrderStatus? From, OrderStatus To, DateTime At);

public sealed record PublicTailoringDto(string Garment, string Fabric, string Color, string Fit,
    decimal EstimatedPrice, decimal? QuotedPrice, string? QuoteNote, DateTime? QuoteValidUntil);

public sealed record PublicOrderDto(string Number, OrderType Type, OrderStatus Status, DateTime CreatedAt,
    PublicCustomerDto Customer, IReadOnlyList<OrderLineDto> Lines, decimal Subtotal, decimal DeliveryFee, decimal Total,
    PaymentMethod PaymentMethod, PaymentStatus PaymentStatus, IReadOnlyList<TimelineEvent> Timeline, PublicTailoringDto? Tailoring);

// ---------- admin

public sealed record AdminOrderRow(int Id, string Number, OrderType Type, OrderStatus Status, string CustomerName,
    string Phone, string ZoneNameAr, string ZoneNameEn, decimal Total, PaymentStatus PaymentStatus, DateTime CreatedAt, int ItemsCount);

public sealed record AdminCustomerDto(string Name, string Phone, string? Email, string City, string Address, string? Notes);

public sealed record AdminHistoryEvent(OrderStatus? From, OrderStatus To, DateTime At, string? Note, string? ChangedBy);

public sealed record AdminTailoringDto(string? StyleId, string Garment, string Fabric, string Color, string Fit,
    SizingMode SizingMode, string? StandardSize, IReadOnlyDictionary<string, decimal> Measurements, bool HasLining,
    IReadOnlyList<string> Extras, bool HasReferenceImage, decimal EstimatedPrice, decimal? QuotedPrice, string? QuoteNote,
    DateTime? QuoteValidUntil, DateTime? QuoteApprovedAt);

public sealed record AdminOrderDetail(int Id, string Number, OrderType Type, OrderStatus Status, DateTime CreatedAt,
    AdminCustomerDto Customer, AdminZoneDto Zone, IReadOnlyList<OrderLineDto> Lines, decimal Subtotal, decimal DeliveryFee,
    decimal Total, PaymentMethod PaymentMethod, PaymentStatus PaymentStatus, IReadOnlyList<AdminHistoryEvent> History,
    AdminTailoringDto? Tailoring);

internal static class OrderMapping
{
    public static OrderLineDto ToDto(this OrderLine l) =>
        new(l.VariantId, l.ProductNameAr, l.ProductNameEn, l.Size, l.ColorNameAr, l.ColorNameEn, l.UnitPrice, l.Quantity, l.LineTotal, l.ImageUrl);

    public static AdminZoneDto ToAdminDto(this DeliveryZone z) =>
        new(z.Id, z.Key, z.NameAr, z.NameEn, z.Fee, z.EtaDaysMin, z.EtaDaysMax, z.IsActive);
}

// Who changed an order. The accounts live in the Identity tables, which only Infrastructure knows.
public interface IUserDirectory
{
    Task<IReadOnlyDictionary<string, string>> NamesAsync(IEnumerable<string> userIds, CancellationToken cancellationToken);
}
