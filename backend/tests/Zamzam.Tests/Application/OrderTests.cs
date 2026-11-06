using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Tests.Application;

public class PlaceOrderTests
{
    [Fact]
    public async Task Checkout_reserves_stock_prices_on_the_server_and_returns_a_tracking_token()
    {
        using var k = new OrderTestKit();
        var abaya = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1250, ("M", k.T.Beige, 3)).Variants.Single();
        k.T.Reload();

        var placed = await k.PlaceOrder().HandleAsync(k.Command(2565, new CheckoutLine(abaya.Id, 2)), CancellationToken.None);

        Assert.Equal("ZF-10001", placed.Number);
        Assert.Equal(OrderStatus.PendingConfirmation, placed.Status);
        Assert.Equal((2500m, 65m, 2565m), (placed.Subtotal, placed.DeliveryFee, placed.Total));
        Assert.Equal(1, k.Stock(abaya.Id));

        var saved = k.T.Db.Orders.Single();
        Assert.NotEqual(placed.TrackingToken, saved.TrackingTokenHash);              // only the hash is stored
        Assert.True(TrackingTokens.Matches(placed.TrackingToken, saved.TrackingTokenHash));
        Assert.Equal("+201012345678", saved.Customer.Phone);
        Assert.Contains(placed.TrackingToken, placed.TrackingUrl);
    }

    [Fact]
    public async Task The_owner_and_the_customer_are_emailed()
    {
        using var k = new OrderTestKit();
        var v = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1250, ("M", k.T.Beige, 3)).Variants.Single();
        k.T.Reload();

        await k.PlaceOrder().HandleAsync(k.Command(1315, new CheckoutLine(v.Id, 1)), CancellationToken.None);

        Assert.Equal(["owner", "mona@example.com"], k.Emails.Sent.Select(e => e.To));
    }

    [Fact]
    public async Task The_same_item_twice_becomes_one_line()
    {
        using var k = new OrderTestKit();
        var v = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1000, ("M", k.T.Beige, 5)).Variants.Single();
        k.T.Reload();

        var placed = await k.PlaceOrder().HandleAsync(
            k.Command(3065, new CheckoutLine(v.Id, 1), new CheckoutLine(v.Id, 2)), CancellationToken.None);

        Assert.Equal(3, Assert.Single(placed.Lines).Qty);
    }

    [Fact]
    public async Task Every_missing_item_is_listed_and_no_stock_is_taken()
    {
        using var k = new OrderTestKit();
        var p = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1000, ("M", k.T.Beige, 1), ("L", k.T.Beige, 2));
        var m = p.Variants.Single(v => v.Size == "M");
        var l = p.Variants.Single(v => v.Size == "L");
        k.T.Reload();

        var error = await Assert.ThrowsAsync<ConflictException>(() => k.PlaceOrder().HandleAsync(
            k.Command(0, new CheckoutLine(m.Id, 2), new CheckoutLine(l.Id, 3), new CheckoutLine(999, 1)), CancellationToken.None));

        Assert.Equal(ErrorCodes.OutOfStock, error.Code);
        var items = Assert.IsAssignableFrom<IEnumerable<StockShortage>>(error.Details["items"]).ToList();
        Assert.Equal([(m.Id, 1), (l.Id, 2), (999, 0)], items.Select(i => (i.VariantId, i.Available)));
        Assert.Equal((1, 2), (k.Stock(m.Id), k.Stock(l.Id)));
        Assert.Empty(k.T.Db.Orders);
    }

    [Fact]
    public async Task A_hidden_product_cannot_be_bought()
    {
        using var k = new OrderTestKit();
        var product = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1000, ("M", k.T.Beige, 5));
        product.Update(product.CategoryId, product.NameAr, product.NameEn, product.Slug, null, null, 1000, isVisible: false);
        k.T.Db.SaveChanges();
        k.T.Reload();

        var error = await Assert.ThrowsAsync<ConflictException>(() => k.PlaceOrder().HandleAsync(
            k.Command(1065, new CheckoutLine(product.Variants.Single().Id, 1)), CancellationToken.None));

        Assert.Equal(ErrorCodes.OutOfStock, error.Code);
    }

    [Fact]
    public async Task A_changed_price_is_refused_with_the_new_total()
    {
        using var k = new OrderTestKit();
        var v = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1250, ("M", k.T.Beige, 3)).Variants.Single();
        k.T.Reload();

        var error = await Assert.ThrowsAsync<ConflictException>(() => k.PlaceOrder().HandleAsync(
            k.Command(1200, new CheckoutLine(v.Id, 1)), CancellationToken.None));

        Assert.Equal(ErrorCodes.PriceChanged, error.Code);
        Assert.Equal(1315m, error.Details["total"]);
        Assert.Equal(3, k.Stock(v.Id));
    }

    [Fact]
    public async Task An_inactive_governorate_or_a_bad_phone_is_refused()
    {
        using var k = new OrderTestKit();
        var v = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1250, ("M", k.T.Beige, 3)).Variants.Single();
        k.T.Reload();
        var good = k.Command(1315, new CheckoutLine(v.Id, 1));

        await Assert.ThrowsAsync<DomainException>(() => k.PlaceOrder().HandleAsync(
            good with { Customer = good.Customer with { DeliveryZoneId = k.Closed.Id } }, CancellationToken.None));
        await Assert.ThrowsAsync<DomainException>(() => k.PlaceOrder().HandleAsync(
            good with { Customer = good.Customer with { Phone = "12345" } }, CancellationToken.None));
        Assert.Equal(3, k.Stock(v.Id));
    }

    [Fact]
    public async Task Validation_rules()
    {
        using var k = new OrderTestKit();
        var validator = new PlaceOrderValidator();
        var good = k.Command(100, new CheckoutLine(1, 1));

        Assert.True((await validator.ValidateAsync(good)).IsValid);
        Assert.False((await validator.ValidateAsync(good with { AcceptTerms = false })).IsValid);
        Assert.False((await validator.ValidateAsync(good with { PaymentMethod = "Card" })).IsValid);
        Assert.False((await validator.ValidateAsync(good with { Lines = [new(1, 6), new(1, 5)] })).IsValid); // 11 of one item
        Assert.False((await validator.ValidateAsync(good with { Lines = [] })).IsValid);
    }
}

public class TrackOrderTests
{
    private static async Task<(OrderTestKit Kit, PlacedOrderDto Placed)> PlacedOrder()
    {
        var k = new OrderTestKit();
        var v = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1250, ("M", k.T.Beige, 3)).Variants.Single();
        k.T.Reload();
        return (k, await k.PlaceOrder().HandleAsync(k.Command(1315, new CheckoutLine(v.Id, 1)), CancellationToken.None));
    }

    [Fact]
    public async Task The_right_token_shows_the_order_with_personal_data_masked()
    {
        var (k, placed) = await PlacedOrder();
        using var _ = k;

        var order = await new TrackOrderHandler(k.T.Db).HandleAsync(placed.Number, placed.TrackingToken, CancellationToken.None);

        Assert.Equal("Mona A.", order.Customer.Name);
        Assert.Equal("+20101****678", order.Customer.Phone);
        Assert.Equal("Cairo", order.Customer.Zone.NameEn);
        Assert.Equal(OrderStatus.PendingConfirmation, Assert.Single(order.Timeline).To);
    }

    [Theory]
    [InlineData("wrong-token")]
    [InlineData("")]
    [InlineData(null)]
    public async Task A_wrong_or_missing_token_looks_exactly_like_an_unknown_order(string? token)
    {
        var (k, placed) = await PlacedOrder();
        using var _ = k;
        var handler = new TrackOrderHandler(k.T.Db);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.HandleAsync(placed.Number, token, CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => handler.HandleAsync("ZF-99999", placed.TrackingToken, CancellationToken.None));
    }
}

public class AdminOrderTests
{
    private static async Task<(OrderTestKit Kit, int VariantId, int OrderId)> OrderOfTwo()
    {
        var k = new OrderTestKit();
        var v = k.T.AddProduct(k.T.Abayas, "Modest Abaya", 1000, ("M", k.T.Beige, 5)).Variants.Single();
        k.T.Reload();
        await k.PlaceOrder().HandleAsync(k.Command(2065, new CheckoutLine(v.Id, 2)), CancellationToken.None);
        k.T.Reload();
        return (k, v.Id, k.T.Db.Orders.Single().Id);
    }

    [Fact]
    public async Task Cancelling_puts_the_stock_back_and_records_who_did_it()
    {
        var (k, variantId, orderId) = await OrderOfTwo();
        using var _ = k;
        Assert.Equal(3, k.Stock(variantId));

        var detail = await k.ChangeStatus().HandleAsync(orderId,
            new ChangeOrderStatusCommand(OrderStatus.Cancelled, "Customer called"), "owner-1", CancellationToken.None);

        Assert.Equal(OrderStatus.Cancelled, detail.Status);
        Assert.Equal(5, k.Stock(variantId));
        var last = detail.History.Last();
        Assert.Equal(("Name of owner-1", "Customer called"), (last.ChangedBy, last.Note));
        Assert.Contains(k.Emails.Sent, e => e.To == "mona@example.com" && e.Subject.Contains("cancelled"));
    }

    [Fact]
    public async Task Skipping_steps_is_refused()
    {
        var (k, _, orderId) = await OrderOfTwo();
        using var __ = k;

        var error = await Assert.ThrowsAsync<DomainException>(() => k.ChangeStatus().HandleAsync(orderId,
            new ChangeOrderStatusCommand(OrderStatus.Shipped, null), "owner-1", CancellationToken.None));

        Assert.Equal(ErrorCodes.InvalidStatusTransition, error.Code);
    }

    [Fact]
    public async Task Status_moves_in_order_and_delivery_marks_it_paid()
    {
        var (k, _, orderId) = await OrderOfTwo();
        using var __ = k;
        AdminOrderDetail detail = null!;

        foreach (var to in new[] { OrderStatus.Confirmed, OrderStatus.Packing, OrderStatus.Shipped, OrderStatus.Delivered })
        {
            k.T.Reload();
            detail = await k.ChangeStatus().HandleAsync(orderId, new ChangeOrderStatusCommand(to, null), "owner-1", CancellationToken.None);
        }

        Assert.Equal(PaymentStatus.Paid, detail.PaymentStatus);
        Assert.Equal(5, detail.History.Count);
    }

    [Fact]
    public async Task The_board_filters_by_status_and_finds_orders_by_number_or_phone()
    {
        var (k, _, _) = await OrderOfTwo();
        using var __ = k;
        var board = new ListAdminOrdersHandler(k.T.Db);

        Assert.Equal(1, (await board.HandleAsync(new AdminOrdersQuery(Status: [OrderStatus.PendingConfirmation]), CancellationToken.None)).TotalCount);
        Assert.Equal(0, (await board.HandleAsync(new AdminOrdersQuery(Status: [OrderStatus.Shipped]), CancellationToken.None)).TotalCount);
        Assert.Equal(1, (await board.HandleAsync(new AdminOrdersQuery(Q: "zf-10001"), CancellationToken.None)).TotalCount);
        Assert.Equal(1, (await board.HandleAsync(new AdminOrdersQuery(Q: "01012345678"), CancellationToken.None)).TotalCount);
        var row = (await board.HandleAsync(new AdminOrdersQuery(), CancellationToken.None)).Items.Single();
        Assert.Equal(("Cairo", 2), (row.ZoneNameEn, row.ItemsCount));
    }
}

public class DeliveryZoneTests
{
    [Fact]
    public async Task Bulk_update_changes_fees_and_the_shop_only_lists_active_zones()
    {
        using var k = new OrderTestKit();

        var all = await new UpdateDeliveryZonesHandler(k.T.Db).HandleAsync(
            [new ZoneUpdate(k.Cairo.Id, 70, 1, 2, true), new ZoneUpdate(k.Closed.Id, 130, 4, 6, false)], CancellationToken.None);
        var shop = await new ListDeliveryZonesHandler(k.T.Db).HandleAsync(CancellationToken.None);

        Assert.Equal(70m, all.Single(z => z.Key == "cairo").Fee);
        Assert.Equal("cairo", Assert.Single(shop).Key);
    }

    [Fact]
    public async Task Unknown_zone_or_bad_values_are_refused()
    {
        using var k = new OrderTestKit();

        await Assert.ThrowsAsync<DomainException>(() => new UpdateDeliveryZonesHandler(k.T.Db)
            .HandleAsync([new ZoneUpdate(999, 70, 1, 2, true)], CancellationToken.None));
        Assert.False((await new ZoneUpdatesValidator().ValidateAsync([new ZoneUpdate(1, -5, 3, 1, true)])).IsValid);
    }
}

public class TrackingTokenTests
{
    [Fact]
    public void Tokens_are_random_long_and_only_their_hash_matches()
    {
        var (token, hash) = TrackingTokens.Create();
        var (other, _) = TrackingTokens.Create();

        Assert.NotEqual(token, other);
        Assert.True(token.Length >= 40);
        Assert.True(TrackingTokens.Matches(token, hash));
        Assert.False(TrackingTokens.Matches(other, hash));
    }
}
