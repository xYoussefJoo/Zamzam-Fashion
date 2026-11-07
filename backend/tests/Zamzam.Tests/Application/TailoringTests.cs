using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Application.Settings;
using Zamzam.Application.Tailoring;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.Settings;
using Zamzam.Infrastructure.Persistence.Seed;

namespace Zamzam.Tests.Application;

// Day 4: the custom-order flow — estimate → request → owner's price → customer's answer.
public sealed class TailoringTests : IDisposable
{
    private readonly OrderTestKit _k = new();
    private TestDb T => _k.T;

    public TailoringTests()
    {
        T.Db.TailoringCatalog.Add(new TailoringCatalog(SeedData.TailoringCatalog()));
        T.Db.PriceRules.Add(new PriceRules(SeedData.PriceRules()));
        T.Db.SaveChanges();
    }

    public void Dispose() => _k.Dispose();

    private PlaceTailoringRequestHandler Place() => new(T.Db, new FakeOrderNumbers(), T.Storage, new FakeImageProcessor(), _k.Emails,
        new FakeSiteLinks(), TimeProvider.System, Log.For<PlaceTailoringRequestHandler>());

    private SendQuoteHandler Quote() => new(T.Db, new FakeUserDirectory(), T.Storage, _k.Emails, new FakeSiteLinks(), TimeProvider.System);

    private AnswerQuoteHandler Answer() => new(T.Db, _k.Emails, new FakeSiteLinks(), TimeProvider.System, new TrackOrderHandler(T.Db));

    private TailoringRequestCommand Request(SizingMode mode = SizingMode.StandardSize, Dictionary<string, decimal>? measurements = null,
        bool lining = true, string[]? extras = null) =>
        new(new CheckoutCustomer("Mona Ahmed", "0101 234 5678", "mona@example.com", _k.Cairo.Id, "Nasr City", "12 Abbas El Akkad St, apt 7", null),
            "maxi", "dress", "crepe", "Navy", "Relaxed", mode, mode == SizingMode.StandardSize ? "M" : null, measurements,
            lining, extras ?? ["embroidery"], "Longer sleeves please", true);

    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, (byte)'J', (byte)'F', (byte)'I', (byte)'F', 0, 1, 1, 0, 0, 1];

    private async Task<(int Id, string Number, string Token)> PlacedAsync()
    {
        var placed = await Place().HandleAsync(Request(), null, 0, CancellationToken.None);
        T.Reload();
        return (T.Db.Orders.Single(o => o.Number == placed.Number).Id, placed.Number, placed.TrackingToken);
    }

    // ---------- #12 / #13

    [Fact]
    public async Task Public_catalog_shows_only_active_items_with_prices()
    {
        var catalog = await new GetPublicTailoringCatalogHandler(T.Db).HandleAsync(CancellationToken.None);

        Assert.Equal(6, catalog.Garments.Count);
        Assert.Contains("sleeves", catalog.MeasurementGroups.Keys);
        Assert.Equal(150, catalog.LiningPrice);
        Assert.Contains(catalog.Extras, e => e.Key == "embroidery" && e.Price == 300);
    }

    [Fact]
    public async Task Estimate_adds_style_fabric_lining_size_and_extras()
    {
        var result = await new EstimateHandler(T.Db).HandleAsync(
            new EstimateCommand("maxi", "dress", "crepe", "Relaxed", true, SizingMode.StandardSize, "XXL", ["embroidery"]), CancellationToken.None);

        Assert.Equal(1350, result.BasePrice);
        Assert.Equal(1350 + 150 + 150 + 100 + 300, result.EstimatedPrice); // style + crepe + lining + XXL + embroidery
        Assert.Equal("EGP", result.Currency);
    }

    [Fact]
    public async Task Estimate_rejects_an_unknown_fabric()
    {
        await Assert.ThrowsAsync<DomainException>(() => new EstimateHandler(T.Db).HandleAsync(
            new EstimateCommand("maxi", "dress", "silk-from-mars", "Relaxed", false, SizingMode.StandardSize, "M", null), CancellationToken.None));
    }

    // ---------- #14

    [Fact]
    public async Task Request_is_saved_awaiting_a_quote_with_the_server_price()
    {
        var placed = await Place().HandleAsync(Request(), null, 0, CancellationToken.None);

        Assert.Equal(OrderStatus.AwaitingQuote, placed.Status);
        Assert.Equal(1350 + 150 + 150 + 300, placed.EstimatedPrice);
        Assert.Equal(placed.EstimatedPrice + 65, placed.EstimatedTotal);
        T.Reload();
        var order = T.Db.Orders.Single();
        Assert.Equal(OrderType.Custom, order.Type);
        Assert.Equal("Longer sleeves please", T.Db.Set<TailoringSpec>().Single().Notes);
        Assert.Contains(_k.Emails.Sent, e => e.To == "owner");
    }

    [Fact]
    public async Task Measurements_must_belong_to_the_garment()
    {
        // "inseam" is a trousers measurement, not a dress one.
        var command = Request(SizingMode.Measurements, new() { ["bust"] = 92, ["inseam"] = 78 });
        await Assert.ThrowsAsync<DomainException>(() => Place().HandleAsync(command, null, 0, CancellationToken.None));
        Assert.Empty(T.Db.Orders);
    }

    [Fact]
    public async Task Reference_photo_goes_to_the_private_bucket()
    {
        var placed = await Place().HandleAsync(Request(), new MemoryStream(Jpeg), Jpeg.Length, CancellationToken.None);

        var key = Assert.Single(T.Storage.PrivateFiles.Keys);
        Assert.StartsWith("tailoring/", key);
        Assert.Empty(T.Storage.Files); // nothing public

        T.Reload();
        var id = T.Db.Orders.Single(o => o.Number == placed.Number).Id;
        var detail = await new GetAdminOrderHandler(T.Db, new FakeUserDirectory(), T.Storage).HandleAsync(id, CancellationToken.None);
        Assert.StartsWith($"https://img.test/private/{key}", detail.Tailoring!.ReferenceImageUrl);
    }

    [Fact]
    public async Task A_fake_photo_is_rejected_and_nothing_is_saved()
    {
        var notAnImage = "hello, I am a script"u8.ToArray();
        await Assert.ThrowsAsync<FileRejectedException>(() =>
            Place().HandleAsync(Request(), new MemoryStream(notAnImage), notAnImage.Length, CancellationToken.None));
        Assert.Empty(T.Storage.PrivateFiles);
        Assert.Empty(T.Db.Orders);
    }

    // ---------- #38

    [Fact]
    public async Task Confirming_the_estimate_approves_without_a_new_link()
    {
        var (id, _, _) = await PlacedAsync();

        var result = await Quote().HandleAsync(id, new SendQuoteCommand(1950, null), "owner-1", CancellationToken.None);

        Assert.Equal(OrderStatus.QuoteApproved, result.Order.Status);
        Assert.Null(result.CustomerLink);
    }

    [Fact]
    public async Task A_new_price_gives_a_new_link_and_the_old_one_stops_working()
    {
        var (id, number, oldToken) = await PlacedAsync();

        var result = await Quote().HandleAsync(id, new SendQuoteCommand(2400, "Lined crepe", 7), "owner-1", CancellationToken.None);

        Assert.Equal(OrderStatus.QuoteSent, result.Order.Status);
        Assert.Equal(2400 + 65, result.Order.Total);
        Assert.NotNull(result.CustomerLink);
        T.Reload();
        await Assert.ThrowsAsync<NotFoundException>(() => new TrackOrderHandler(T.Db).HandleAsync(number, oldToken, CancellationToken.None));
        var newToken = result.CustomerLink!.Split("?t=")[1];
        Assert.Equal(OrderStatus.QuoteSent, (await new TrackOrderHandler(T.Db).HandleAsync(number, newToken, CancellationToken.None)).Status);
    }

    [Fact]
    public async Task Ready_made_orders_cannot_get_a_quote()
    {
        var dress = T.AddProduct(T.Dresses, "Dress", 1000, ("M", T.Beige, 3));
        var placed = await _k.PlaceOrder().HandleAsync(_k.Command(1065, new CheckoutLine(dress.Variants.First().Id, 1)), CancellationToken.None);
        T.Reload();
        var id = T.Db.Orders.Single(o => o.Number == placed.Number).Id;

        await Assert.ThrowsAsync<DomainException>(() => Quote().HandleAsync(id, new SendQuoteCommand(900, null), null, CancellationToken.None));
    }

    // ---------- #15 / #16

    private async Task<(string Number, string Token)> QuotedAsync()
    {
        var (id, number, _) = await PlacedAsync();
        var result = await Quote().HandleAsync(id, new SendQuoteCommand(2400, null), "owner-1", CancellationToken.None);
        T.Reload();
        return (number, result.CustomerLink!.Split("?t=")[1]);
    }

    [Fact]
    public async Task Customer_approves_the_new_price()
    {
        var (number, token) = await QuotedAsync();

        var view = await Answer().ApproveAsync(number, token, CancellationToken.None);

        Assert.Equal(OrderStatus.QuoteApproved, view.Status);
        Assert.Contains(_k.Emails.Sent, e => e.To == "owner" && e.Subject.Contains(number));
    }

    [Fact]
    public async Task Customer_rejects_the_price_and_the_order_is_cancelled()
    {
        var (number, token) = await QuotedAsync();

        var view = await Answer().RejectAsync(number, token, new RejectQuoteCommand("Too expensive"), CancellationToken.None);

        Assert.Equal(OrderStatus.Cancelled, view.Status);
    }

    [Fact]
    public async Task A_wrong_token_looks_like_a_missing_order()
    {
        var (number, _) = await QuotedAsync();
        await Assert.ThrowsAsync<NotFoundException>(() => Answer().ApproveAsync(number, "wrong-token", CancellationToken.None));
    }

    [Fact]
    public async Task Cannot_answer_before_the_owner_sends_a_price()
    {
        var (_, number, token) = await PlacedAsync();
        await Assert.ThrowsAsync<DomainException>(() => Answer().ApproveAsync(number, token, CancellationToken.None));
    }

    // ---------- #40 / #46

    [Fact]
    public async Task A_new_garment_needs_a_base_price_first()
    {
        var content = SeedData.TailoringCatalog();
        var withCapes = content with { Garments = [.. content.Garments, new("cape", "كاب", "Capes", ["common"])] };

        await Assert.ThrowsAsync<DomainException>(() =>
            new UpdateTailoringCatalogHandler(T.Db).HandleAsync(withCapes, CancellationToken.None));
    }

    [Fact]
    public async Task New_prices_are_used_by_the_next_estimate()
    {
        var rules = SeedData.PriceRules() with { LiningPrice = 200 };
        await new UpdatePriceRulesHandler(T.Db).HandleAsync(rules, CancellationToken.None);
        T.Reload();

        var result = await new EstimateHandler(T.Db).HandleAsync(
            new EstimateCommand("maxi", "dress", "crepe", "Relaxed", true, SizingMode.StandardSize, "M", null), CancellationToken.None);
        Assert.Equal(1350 + 150 + 200, result.EstimatedPrice);
    }

    // ---------- #43 / #44 / #47

    [Fact]
    public async Task Site_settings_are_created_then_replaced()
    {
        Assert.Equal(SiteContent.Default.AnnouncementEn, (await new GetAdminSiteSettingsHandler(T.Db).HandleAsync(CancellationToken.None)).AnnouncementEn);

        await new UpdateSiteSettingsHandler(T.Db).HandleAsync(SiteContent.Default with { AnnouncementEn = "Eid sale" }, CancellationToken.None);
        await new UpdateSiteSettingsHandler(T.Db).HandleAsync(SiteContent.Default with { AnnouncementEn = "Summer sale" }, CancellationToken.None);
        T.Reload();

        Assert.Equal("Summer sale", Assert.Single(T.Db.SiteSettings).Content.AnnouncementEn);
    }

    [Fact]
    public async Task Dashboard_counts_what_needs_attention()
    {
        var dress = T.AddProduct(T.Dresses, "Dress", 1000, ("M", T.Beige, 3), ("L", T.Beige, 1));
        await _k.PlaceOrder().HandleAsync(_k.Command(1065, new CheckoutLine(dress.Variants.First().Id, 1)), CancellationToken.None);
        await Place().HandleAsync(Request(), null, 0, CancellationToken.None); // its own fake numbers: don't look it up by number

        var dashboard = await new GetDashboardHandler(T.Db, new ListAdminOrdersHandler(T.Db), TimeProvider.System)
            .HandleAsync(CancellationToken.None);

        Assert.Equal(2, dashboard.OrdersToday);
        Assert.Equal(1, dashboard.PendingConfirmation);
        Assert.Equal(1, dashboard.AwaitingQuote);
        Assert.Equal(2, dashboard.LatestOrders.Count);
        Assert.Contains(dashboard.LowStock, s => s.Size == "L" && s.Stock == 1);
    }
}
