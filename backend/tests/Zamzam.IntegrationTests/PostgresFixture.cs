using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Testcontainers.PostgreSql;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Domain.Common;
using Zamzam.Domain.Entities;
using Zamzam.Infrastructure.Orders;
using Zamzam.Infrastructure.Persistence;

namespace Zamzam.IntegrationTests;

// One real PostgreSQL 17 in Docker for all integration tests, with the real migration applied.
// Runs in GitHub Actions (Docker is built in). On a PC without Docker the tests are skipped, not failed.
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17-alpine").Build();

    public async Task InitializeAsync()
    {
        if (!Docker.IsAvailable) return;
        await _container.StartAsync();
        await using var db = NewContext();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (Docker.IsAvailable) await _container.DisposeAsync();
    }

    // A fresh DbContext = a separate "user" with its own connection, like two browsers.
    public ZamzamDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ZamzamDbContext>()
            .UseNpgsql(_container.GetConnectionString(), npgsql => npgsql
                .MigrationsHistoryTable("__EFMigrationsHistory", ZamzamDbContext.Schema)
                .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
            .Options, TimeProvider.System);

    public static PlaceOrderHandler Checkout(ZamzamDbContext db) =>
        new(db, new OrderNumberGenerator(db), new NoStorage(), new NoEmails(), new Links(), TimeProvider.System,
            NullLogger<PlaceOrderHandler>.Instance);

    // A product with one variant (size M) and its own zone, isolated from other tests.
    public async Task<(int VariantId, int ZoneId)> SeedAsync(int stock, decimal price = 1000)
    {
        await using var db = NewContext();
        var id = Guid.NewGuid().ToString("N")[..10];
        var zone = new DeliveryZone($"zone-{id}", "منطقة", $"Zone {id}", 50, 1, 3);
        var color = new Color("بيج", $"Beige {id}", "#d6b995");
        var category = new Category("قسم", $"Category {id}", $"cat-{id}", null);
        db.AddRange(zone, color, category);
        await db.SaveChangesAsync();

        var product = new Product(category.Id, "منتج", $"Product {id}", $"product-{id}", null, null, price);
        db.Products.Add(product);
        await db.SaveChangesAsync();
        var variant = product.AddVariant("M", color.Id, Sku.For(product.Id, "M", "beige"), stock);
        await db.SaveChangesAsync();
        return (variant.Id, zone.Id);
    }

    public static PlaceOrderCommand Command(int zoneId, int variantId, decimal expectedTotal) =>
        new(new CheckoutCustomer("Mona Ahmed", "01012345678", null, zoneId, "Nasr City", "12 Abbas El Akkad St, apt 7", null),
            [new CheckoutLine(variantId, 1)], "CashOnDelivery", expectedTotal, true);

    private sealed class NoStorage : IImageStorage
    {
        public string PublicUrl(string objectKey) => objectKey;
        public Task UploadPublicAsync(string objectKey, byte[] content, string contentType, CancellationToken ct) => Task.CompletedTask;
        public Task DeletePublicAsync(IReadOnlyCollection<string> objectKeys, CancellationToken ct) => Task.CompletedTask;
    }

    private sealed class NoEmails : IEmailQueue
    {
        public void ToOwner(string subject, string htmlBody) { }
        public void ToCustomer(string email, string subject, string htmlBody) { }
    }

    private sealed class Links : ISiteLinks
    {
        public string TrackingPage(string orderNumber, string trackingToken) => $"/track/{orderNumber}";
        public string AdminOrderPage(int orderId) => $"/admin/orders/{orderId}";
    }
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres";
}

public static class Docker
{
    public static bool IsAvailable { get; } = Detect();

    private static bool Detect()
    {
        if (Environment.GetEnvironmentVariable("CI") == "true") return true;      // GitHub Actions
        if (File.Exists("/var/run/docker.sock")) return true;                       // Linux / macOS
        try
        {
            return OperatingSystem.IsWindows()
                && Directory.GetFiles(@"\\.\pipe\").Any(p => p.EndsWith("docker_engine", StringComparison.OrdinalIgnoreCase));
        }
        catch { return false; }
    }
}

// [DockerFact] = a normal test that is skipped (with a reason) when Docker isn't available.
public sealed class DockerFactAttribute : FactAttribute
{
    public DockerFactAttribute()
    {
        if (!Docker.IsAvailable) Skip = "Needs Docker for a real PostgreSQL; runs in GitHub Actions CI.";
    }
}
