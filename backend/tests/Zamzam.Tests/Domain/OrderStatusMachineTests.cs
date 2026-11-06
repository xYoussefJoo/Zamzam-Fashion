using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.ValueObjects;
using static Zamzam.Tests.TestData;

namespace Zamzam.Tests.Domain;

public class OrderStatusMachineTests
{
    [Fact]
    public void New_ready_order_waits_for_confirmation_and_records_its_first_status()
    {
        var order = ReadyOrder(Line(501, quantity: 2), Line(502));

        Assert.Equal(OrderStatus.PendingConfirmation, order.Status);
        Assert.Equal(2550m, order.Subtotal);
        Assert.Equal(2615m, order.Total);
        var first = Assert.Single(order.History);
        Assert.Null(first.FromStatus);
        Assert.Equal(OrderStatus.PendingConfirmation, first.ToStatus);
    }

    [Fact]
    public void Ready_order_follows_the_happy_path_and_is_paid_on_delivery()
    {
        var order = ReadyOrder();

        foreach (var next in new[] { OrderStatus.Confirmed, OrderStatus.Packing, OrderStatus.Shipped, OrderStatus.Delivered })
            order.ChangeStatus(next, "owner-id", null, Now);

        Assert.Equal(OrderStatus.Delivered, order.Status);
        Assert.Equal(PaymentStatus.Paid, order.PaymentStatus);
        Assert.Equal(5, order.History.Count);
    }

    [Theory]
    [InlineData(OrderStatus.Shipped)]
    [InlineData(OrderStatus.Delivered)]
    [InlineData(OrderStatus.InProduction)]
    [InlineData(OrderStatus.QuoteApproved)]
    public void Skipping_steps_is_refused(OrderStatus target)
    {
        var order = ReadyOrder();

        var error = Assert.Throws<DomainException>(() => order.ChangeStatus(target, "owner-id", null, Now));

        Assert.Equal(ErrorCodes.InvalidStatusTransition, error.Code);
        Assert.Equal(OrderStatus.PendingConfirmation, order.Status);
    }

    [Fact]
    public void Delivered_order_cannot_be_cancelled()
    {
        var order = ReadyOrder();
        foreach (var next in new[] { OrderStatus.Confirmed, OrderStatus.Packing, OrderStatus.Shipped, OrderStatus.Delivered })
            order.ChangeStatus(next, "owner-id", null, Now);

        Assert.Throws<DomainException>(() => order.ChangeStatus(OrderStatus.Cancelled, "owner-id", null, Now));
    }

    [Fact]
    public void Cancelling_a_ready_order_returns_every_line_to_stock()
    {
        var order = ReadyOrder(Line(501, quantity: 2), Line(502, quantity: 1));

        var returns = order.ChangeStatus(OrderStatus.Cancelled, "owner-id", "Customer called", Now);

        Assert.Equal([new StockReturn(501, 2), new StockReturn(502, 1)], returns);
        Assert.Equal("Customer called", order.History.Last().Note);
    }

    [Fact]
    public void Cancelling_a_custom_order_returns_no_stock()
    {
        var order = CustomOrder();

        Assert.Empty(order.ChangeStatus(OrderStatus.Cancelled, "owner-id", null, Now));
    }

    [Fact]
    public void An_order_needs_items_and_each_variant_only_once()
    {
        Assert.Throws<DomainException>(() =>
            Order.CreateReady("ZF-1", "hash", Customer(), 1, 65m, [], Now));
        Assert.Throws<DomainException>(() =>
            Order.CreateReady("ZF-1", "hash", Customer(), 1, 65m, [Line(501), Line(501)], Now));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(11)]
    public void Line_quantity_must_be_1_to_10(int quantity)
    {
        Assert.Throws<DomainException>(() => ReadyOrder(Line(501, quantity)));
    }
}
