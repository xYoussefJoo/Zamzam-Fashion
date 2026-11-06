using Zamzam.Domain.Enums;

namespace Zamzam.Domain.Entities;

// One row per status change: who moved the order, from what, to what, and when.
public class OrderStatusHistory : Entity
{
    public int OrderId { get; private set; }
    public OrderStatus? FromStatus { get; private set; }   // null = the order was just created
    public OrderStatus ToStatus { get; private set; }
    public string? ChangedByUserId { get; private set; }   // null = the customer or the system
    public DateTime ChangedAt { get; private set; }
    public string? Note { get; private set; }

    private OrderStatusHistory() { } // EF Core

    internal OrderStatusHistory(OrderStatus? from, OrderStatus to, string? changedByUserId, string? note, DateTime changedAt)
    {
        FromStatus = from;
        ToStatus = to;
        ChangedByUserId = changedByUserId;
        Note = note;
        ChangedAt = changedAt;
    }
}
