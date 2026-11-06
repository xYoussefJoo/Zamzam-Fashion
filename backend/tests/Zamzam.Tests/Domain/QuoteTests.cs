using Zamzam.Domain.Constants;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using static Zamzam.Tests.TestData;

namespace Zamzam.Tests.Domain;

public class QuoteTests
{
    [Fact]
    public void New_custom_order_waits_for_the_owner_and_uses_the_estimate()
    {
        var order = CustomOrder(estimate: 2200m);

        Assert.Equal(OrderStatus.AwaitingQuote, order.Status);
        Assert.Equal(2265m, order.Total);
    }

    [Fact]
    public void Same_price_as_the_estimate_is_approved_without_asking_the_customer_again()
    {
        var order = CustomOrder(estimate: 2200m);

        order.SendQuote(2200m, null, validDays: 7, "owner-id", Now);

        Assert.Equal(OrderStatus.QuoteApproved, order.Status);
        Assert.Equal(Now, order.Tailoring!.QuoteApprovedAt);
    }

    [Fact]
    public void Changed_price_waits_for_the_customer()
    {
        var order = CustomOrder(estimate: 2200m);

        order.SendQuote(2500m, "Lined crepe", validDays: 7, "owner-id", Now);

        Assert.Equal(OrderStatus.QuoteSent, order.Status);
        Assert.Equal(2565m, order.Total);
        Assert.Equal(Now.AddDays(7), order.Tailoring!.QuoteValidUntil);
    }

    [Fact]
    public void Customer_can_approve_before_the_offer_expires()
    {
        var order = CustomOrder();
        order.SendQuote(2500m, null, 7, "owner-id", Now);

        order.ApproveQuote(Now.AddDays(3));

        Assert.Equal(OrderStatus.QuoteApproved, order.Status);
        Assert.Null(order.History.Last().ChangedByUserId); // the customer, not the owner
    }

    [Fact]
    public void Approving_after_expiry_is_refused()
    {
        var order = CustomOrder();
        order.SendQuote(2500m, null, 7, "owner-id", Now);

        var error = Assert.Throws<DomainException>(() => order.ApproveQuote(Now.AddDays(8)));

        Assert.Equal(ErrorCodes.QuoteExpired, error.Code);
    }

    [Fact]
    public void Rejecting_cancels_the_order_with_the_reason()
    {
        var order = CustomOrder();
        order.SendQuote(2500m, null, 7, "owner-id", Now);

        order.RejectQuote("Too expensive", Now);

        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.Equal("Rejected by customer: Too expensive", order.History.Last().Note);
    }

    [Fact]
    public void The_owner_cannot_approve_for_the_customer()
    {
        var order = CustomOrder();
        order.SendQuote(2500m, null, 7, "owner-id", Now);

        Assert.Throws<DomainException>(() => order.ChangeStatus(OrderStatus.QuoteApproved, "owner-id", null, Now));
    }

    [Fact]
    public void Ready_orders_never_get_a_quote()
    {
        var error = Assert.Throws<DomainException>(() => ReadyOrder().SendQuote(100m, null, 7, "owner-id", Now));

        Assert.Equal(ErrorCodes.InvalidStatusTransition, error.Code);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(31)]
    public void Offer_is_valid_for_1_to_30_days(int days)
    {
        Assert.Throws<DomainException>(() => CustomOrder().SendQuote(2500m, null, days, "owner-id", Now));
    }
}
