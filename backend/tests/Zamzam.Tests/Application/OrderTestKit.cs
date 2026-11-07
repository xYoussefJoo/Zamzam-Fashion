using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Domain.Entities;

namespace Zamzam.Tests.Application;

internal sealed class FakeOrderNumbers : IOrderNumberGenerator
{
    private int _next = 10001;
    public Task<string> NextAsync(CancellationToken cancellationToken) => Task.FromResult($"ZF-{_next++}");
}

internal sealed class FakeEmailQueue : IEmailQueue
{
    public List<(string To, string Subject)> Sent { get; } = [];
    public void ToOwner(string subject, string htmlBody) => Sent.Add(("owner", subject));
    public void ToCustomer(string email, string subject, string htmlBody) => Sent.Add((email, subject));
}

internal sealed class FakeSiteLinks : ISiteLinks
{
    public string TrackingPage(string orderNumber, string trackingToken) => $"https://shop.test/track/{orderNumber}?t={trackingToken}";
    public string AdminOrderPage(int orderId) => $"https://shop.test/admin/orders/{orderId}";
}

internal sealed class FakeUserDirectory : IUserDirectory
{
    public Task<IReadOnlyDictionary<string, string>> NamesAsync(IEnumerable<string> userIds, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyDictionary<string, string>>(userIds.ToDictionary(id => id, id => $"Name of {id}"));
}

// Everything a Day 3 test needs: the catalog from TestDb plus zones, fakes and handlers.
internal sealed class OrderTestKit : IDisposable
{
    public TestDb T { get; } = TestDb.WithCatalog();
    public FakeEmailQueue Emails { get; } = new();
    public DeliveryZone Cairo { get; }
    public DeliveryZone Closed { get; }

    public OrderTestKit()
    {
        Cairo = new DeliveryZone("cairo", "القاهرة", "Cairo", 65, 1, 3);
        Closed = new DeliveryZone("new-valley", "الوادي الجديد", "New Valley", 120, 4, 7, isActive: false);
        T.Db.DeliveryZones.AddRange(Cairo, Closed);
        T.Db.SaveChanges();
    }

    public PlaceOrderHandler PlaceOrder() =>
        new(T.Db, new FakeOrderNumbers(), T.Storage, Emails, new FakeSiteLinks(), TimeProvider.System, Log.For<PlaceOrderHandler>());

    public ChangeOrderStatusHandler ChangeStatus() => new(T.Db, new FakeUserDirectory(), T.Storage, Emails, TimeProvider.System);

    public PlaceOrderCommand Command(decimal expectedTotal, params CheckoutLine[] lines) =>
        new(new CheckoutCustomer("Mona Ahmed", "0101 234 5678", "mona@example.com", Cairo.Id, "Nasr City",
            "12 Abbas El Akkad St, apt 7", null), lines, "CashOnDelivery", expectedTotal, true);

    public int Stock(int variantId)
    {
        T.Reload();
        return T.Db.ProductVariants.Single(v => v.Id == variantId).Stock;
    }

    public void Dispose() => T.Dispose();
}
