using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.ValueObjects;

namespace Zamzam.Domain.Entities;

public class Order : Entity
{
    public const int MaxLines = 30;
    public const int MaxQuoteDays = 30;

    // Every move the owner may make (docs/API-CONTRACT.md, Appendix A).
    // Quote moves (AwaitingQuote -> QuoteSent/QuoteApproved, QuoteSent -> QuoteApproved) are not here:
    // they only happen through SendQuote and the customer's ApproveQuote.
    private static readonly Dictionary<OrderStatus, OrderStatus[]> OwnerMoves = new()
    {
        [OrderStatus.PendingConfirmation] = [OrderStatus.Confirmed, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Packing, OrderStatus.Cancelled],
        [OrderStatus.AwaitingQuote] = [OrderStatus.Cancelled],
        [OrderStatus.QuoteSent] = [OrderStatus.Cancelled],
        [OrderStatus.QuoteApproved] = [OrderStatus.InProduction, OrderStatus.Cancelled],
        [OrderStatus.InProduction] = [OrderStatus.QualityCheck],
        [OrderStatus.QualityCheck] = [OrderStatus.Packing, OrderStatus.InProduction],
        [OrderStatus.Packing] = [OrderStatus.Shipped],
        [OrderStatus.Shipped] = [OrderStatus.Delivered],
    };

    private readonly List<OrderLine> _lines = [];
    private readonly List<OrderStatusHistory> _history = [];

    public string Number { get; private set; } = null!;            // ZF-10234
    public string TrackingTokenHash { get; private set; } = null!; // the token itself is never stored
    public OrderType Type { get; private set; }
    public OrderStatus Status { get; private set; }

    public CustomerInfo Customer { get; private set; } = null!;
    public int DeliveryZoneId { get; private set; }

    public decimal Subtotal { get; private set; }
    public decimal DeliveryFee { get; private set; }
    public decimal Total { get; private set; }
    public PaymentMethod PaymentMethod { get; private set; }
    public PaymentStatus PaymentStatus { get; private set; }

    public TailoringSpec? Tailoring { get; private set; }
    public IReadOnlyCollection<OrderLine> Lines => _lines;
    public IReadOnlyCollection<OrderStatusHistory> History => _history;

    private Order() { } // EF Core

    private Order(string number, string trackingTokenHash, OrderType type, CustomerInfo customer,
        int deliveryZoneId, decimal deliveryFee)
    {
        Number = Guard.Required(number, "Order number", 20);
        TrackingTokenHash = Guard.Required(trackingTokenHash, "Tracking token hash", 128);
        Type = type;
        Customer = customer ?? throw new DomainException(ErrorCodes.Validation, "Customer details are required.");
        DeliveryZoneId = Guard.Positive(deliveryZoneId, "Delivery zone");
        DeliveryFee = Guard.Money(deliveryFee, "Delivery fee", allowZero: true);
        PaymentMethod = PaymentMethod.CashOnDelivery;
        PaymentStatus = PaymentStatus.Unpaid;
    }

    // ---------- create

    // Lines come already priced and reserved by the application.
    public static Order CreateReady(string number, string trackingTokenHash, CustomerInfo customer,
        int deliveryZoneId, decimal deliveryFee, IReadOnlyCollection<OrderLineDraft> lines, DateTime now)
    {
        if (lines.Count is 0 or > MaxLines)
            throw new DomainException(ErrorCodes.Validation, $"An order needs between 1 and {MaxLines} items.");
        if (lines.Select(l => l.VariantId).Distinct().Count() != lines.Count)
            throw new DomainException(ErrorCodes.Validation, "Each variant may appear only once; merge the quantities.");

        var order = new Order(number, trackingTokenHash, OrderType.Ready, customer, deliveryZoneId, deliveryFee);
        order._lines.AddRange(lines.Select(l => new OrderLine(l)));
        order.SetSubtotal(order._lines.Sum(l => l.LineTotal));
        order.Record(OrderStatus.PendingConfirmation, null, null, now);
        return order;
    }

    public static Order CreateCustom(string number, string trackingTokenHash, CustomerInfo customer,
        int deliveryZoneId, decimal deliveryFee, TailoringSpec tailoring, DateTime now)
    {
        var order = new Order(number, trackingTokenHash, OrderType.Custom, customer, deliveryZoneId, deliveryFee)
        {
            Tailoring = tailoring ?? throw new DomainException(ErrorCodes.Validation, "Tailoring details are required."),
        };
        order.SetSubtotal(tailoring.EstimatedPrice);
        order.Record(OrderStatus.AwaitingQuote, null, null, now);
        return order;
    }

    // ---------- owner actions

    // Returns the stock to give back when a ready-made order is cancelled (empty otherwise).
    public IReadOnlyList<StockReturn> ChangeStatus(OrderStatus to, string? changedByUserId, string? note, DateTime now)
    {
        if (!OwnerMoves.TryGetValue(Status, out var allowed) || !allowed.Contains(to))
            throw new DomainException(ErrorCodes.InvalidStatusTransition, $"An order can't move from {Status} to {to}.");

        Record(to, changedByUserId, note, now);
        if (to == OrderStatus.Delivered) PaymentStatus = PaymentStatus.Paid; // cash collected at the door

        return to == OrderStatus.Cancelled && Type == OrderType.Ready
            ? _lines.Select(l => new StockReturn(l.VariantId, l.Quantity)).ToList()
            : [];
    }

    // The owner confirms or changes the calculator's price.
    // Same price as the estimate on the first quote -> approved straight away (the customer already saw it).
    public void SendQuote(decimal price, string? note, int validDays, string? changedByUserId, DateTime now)
    {
        if (Type != OrderType.Custom || Tailoring is null)
            throw new DomainException(ErrorCodes.InvalidStatusTransition, "Only custom orders get a price quote.");
        if (Status is not (OrderStatus.AwaitingQuote or OrderStatus.QuoteSent))
            throw new DomainException(ErrorCodes.InvalidStatusTransition, $"A quote can't be sent while the order is {Status}.");
        if (validDays is < 1 or > MaxQuoteDays)
            throw new DomainException(ErrorCodes.Validation, $"A quote must be valid for 1 to {MaxQuoteDays} days.");

        Guard.Money(price, "Price");
        Tailoring.SetQuote(price, note, now.AddDays(validDays));
        SetSubtotal(price);

        if (Status == OrderStatus.AwaitingQuote && price == Tailoring.EstimatedPrice)
        {
            Tailoring.MarkApproved(now);
            Record(OrderStatus.QuoteApproved, changedByUserId, "Price confirmed at the estimate", now);
        }
        else
        {
            Record(OrderStatus.QuoteSent, changedByUserId, note, now);
        }
    }

    // A fresh private link (e.g. to send the new price on WhatsApp). The old link stops working.
    public void ReplaceTrackingToken(string trackingTokenHash) =>
        TrackingTokenHash = Guard.Required(trackingTokenHash, "Tracking token hash", 128);

    // ---------- customer actions (from the secure tracking link)

    public void ApproveQuote(DateTime now)
    {
        EnsureWaitingForCustomer();
        if (now > Tailoring!.QuoteValidUntil)
            throw new DomainException(ErrorCodes.QuoteExpired, "This price offer has expired. Please contact the shop.");

        Tailoring.MarkApproved(now);
        Record(OrderStatus.QuoteApproved, null, "Approved by customer", now);
    }

    public void RejectQuote(string? reason, DateTime now)
    {
        EnsureWaitingForCustomer();
        var why = Guard.Optional(reason, "Reason", 300);
        Record(OrderStatus.Cancelled, null, why is null ? "Rejected by customer" : $"Rejected by customer: {why}", now);
    }

    // ---------- helpers

    private void EnsureWaitingForCustomer()
    {
        if (Type != OrderType.Custom || Status != OrderStatus.QuoteSent)
            throw new DomainException(ErrorCodes.InvalidStatusTransition, "There is no price offer waiting for approval.");
    }

    private void SetSubtotal(decimal subtotal)
    {
        Subtotal = subtotal;
        Total = subtotal + DeliveryFee;
    }

    private void Record(OrderStatus to, string? changedByUserId, string? note, DateTime now)
    {
        var from = _history.Count == 0 ? (OrderStatus?)null : Status;
        _history.Add(new OrderStatusHistory(from, to, changedByUserId, Guard.Optional(note, "Note", 500), now));
        Status = to;
    }
}
