using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Zamzam.Application.Common;
using Zamzam.Domain.Common;
using Zamzam.Domain.Entities;
using Zamzam.Domain.ValueObjects;
using Zamzam.Infrastructure.Persistence;

namespace Zamzam.Tests.Application;

// A fresh in-memory database per test, with a few colors, categories and products.
// The real PostgreSQL behaviour (SQL, indexes, xmin) is covered by integration tests in CI.
internal sealed class TestDb : IDisposable
{
    public ZamzamDbContext Db { get; }
    public FakeImageStorage Storage { get; } = new();

    public Color Beige { get; private set; } = null!;
    public Color Navy { get; private set; } = null!;
    public Category Dresses { get; private set; } = null!;
    public Category Abayas { get; private set; } = null!;
    public Category Trousers { get; private set; } = null!;

    public TestDb()
    {
        var options = new DbContextOptionsBuilder<ZamzamDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        Db = new ZamzamDbContext(options, TimeProvider.System);
    }

    public static TestDb WithCatalog()
    {
        var t = new TestDb();
        t.Beige = new Color("بيج", "Beige", "#d6b995");
        t.Navy = new Color("كحلي", "Navy", "#19344a");
        t.Db.Colors.AddRange(t.Beige, t.Navy);

        t.Dresses = new Category("فساتين", "Dresses", null, null, sortOrder: 0);
        t.Abayas = new Category("عبايات", "Abayas", null, t.Dresses);
        t.Trousers = new Category("بناطيل", "Trousers", null, null, sortOrder: 1);
        t.Db.Categories.AddRange(t.Dresses, t.Abayas, t.Trousers);
        t.Db.SaveChanges();
        return t;
    }

    // Adds a product with (size, color, stock) variants and returns it saved.
    public Product AddProduct(Category category, string nameEn, decimal price,
        params (string Size, Color Color, int Stock)[] variants)
    {
        var product = new Product(category.Id, nameEn + " ar", nameEn, null, null, null, price);
        Db.Products.Add(product);
        Db.SaveChanges();
        foreach (var (size, color, stock) in variants)
            product.AddVariant(size, color.Id, Sku.For(product.Id, size, color.NameEn), stock);
        Db.SaveChanges();
        return product;
    }

    public void OrderVariant(ProductVariant variant)
    {
        var zone = Db.DeliveryZones.FirstOrDefault() ?? new DeliveryZone("cairo", "القاهرة", "Cairo", 65, 1, 3);
        if (zone.Id == 0) { Db.DeliveryZones.Add(zone); Db.SaveChanges(); }
        Db.Orders.Add(Order.CreateReady("ZF-1", "hash", TestData.Customer(), zone.Id, 65,
            [new OrderLineDraft(variant.Id, "a", "A", variant.Size, "c", "C", 100, 1, null)], TestData.Now));
        Db.SaveChanges();
    }

    // A second context on the same data, to check what was really saved.
    public void Reload() => Db.ChangeTracker.Clear();

    public void Dispose() => Db.Dispose();
}

internal sealed class FakeImageStorage : IImageStorage
{
    public Dictionary<string, byte[]> Files { get; } = new();
    public bool FailUploads { get; set; }

    public string PublicUrl(string objectKey) => $"https://img.test/{objectKey}";

    public Task UploadPublicAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken)
    {
        if (FailUploads && Files.Count > 0) throw new InvalidOperationException("storage down");
        Files[objectKey] = content;
        return Task.CompletedTask;
    }

    public Task DeletePublicAsync(IReadOnlyCollection<string> objectKeys, CancellationToken cancellationToken)
    {
        foreach (var key in objectKeys) Files.Remove(key);
        return Task.CompletedTask;
    }

    public Dictionary<string, byte[]> PrivateFiles { get; } = new();

    public Task UploadPrivateAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken)
    {
        PrivateFiles[objectKey] = content;
        return Task.CompletedTask;
    }

    public Task DeletePrivateAsync(IReadOnlyCollection<string> objectKeys, CancellationToken cancellationToken)
    {
        foreach (var key in objectKeys) PrivateFiles.Remove(key);
        return Task.CompletedTask;
    }

    public Task<string> SignedPrivateUrlAsync(string objectKey, TimeSpan validFor, CancellationToken cancellationToken) =>
        Task.FromResult($"https://img.test/private/{objectKey}?expires={(int)validFor.TotalSeconds}");
}

internal sealed class FakeImageProcessor : IImageProcessor
{
    public Task<IReadOnlyList<ProcessedImage>> ToWebpSizesAsync(Stream input, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<ProcessedImage>>(ImageSizes.Widths.Select(w => new ProcessedImage(w, [1, 2, 3])).ToList());
}

internal static class Log
{
    public static NullLogger<T> For<T>() => NullLogger<T>.Instance;
}
