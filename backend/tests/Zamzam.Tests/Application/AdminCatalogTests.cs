using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Catalog.Admin;
using Zamzam.Application.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Tests.Application;

public class AdminCategoryTests
{
    [Fact]
    public async Task Create_then_list_with_product_counts()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 1));

        await new CreateCategoryHandler(t.Db).HandleAsync(new SaveCategoryCommand(null, "جيبات", "Skirts", IsVisible: false), CancellationToken.None);
        var tree = await new ListAdminCategoriesHandler(t.Db).HandleAsync(CancellationToken.None);

        var skirts = tree.Single(c => c.Slug == "skirts");
        Assert.False(skirts.IsVisible);
        Assert.Equal(1, tree.Single(c => c.Slug == "dresses").Children.Single().ProductCount);
    }

    [Fact]
    public async Task Duplicate_link_is_refused()
    {
        using var t = TestDb.WithCatalog();

        var error = await Assert.ThrowsAsync<DomainException>(() =>
            new CreateCategoryHandler(t.Db).HandleAsync(new SaveCategoryCommand(null, "x", "Dresses"), CancellationToken.None));

        Assert.Equal(ErrorCodes.Duplicate, error.Code);
    }

    [Fact]
    public async Task A_category_with_products_or_children_cannot_be_deleted()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Trousers, "Wide Trousers", 850, ("M", t.Beige, 1));
        var handler = new DeleteCategoryHandler(t.Db);

        Assert.Equal(ErrorCodes.InUse, (await Assert.ThrowsAsync<DomainException>(() => handler.HandleAsync(t.Trousers.Id, CancellationToken.None))).Code);
        Assert.Equal(ErrorCodes.InUse, (await Assert.ThrowsAsync<DomainException>(() => handler.HandleAsync(t.Dresses.Id, CancellationToken.None))).Code);

        await handler.HandleAsync(t.Abayas.Id, CancellationToken.None); // empty sub-category: fine
        Assert.False(await t.Db.Categories.AnyAsync(c => c.Slug == "abayas"));
    }

    [Fact]
    public async Task Update_can_move_a_category_under_another()
    {
        using var t = TestDb.WithCatalog();

        var moved = await new UpdateCategoryHandler(t.Db).HandleAsync(t.Trousers.Id,
            new SaveCategoryCommand(t.Dresses.Id, "بناطيل", "Trousers", "trousers", null, true, 5), CancellationToken.None);

        Assert.Equal(t.Dresses.Id, moved.ParentId);
        Assert.Equal(5, moved.SortOrder);
    }
}

public class AdminProductTests
{
    private static CreateProductCommand NewAbaya(int categoryId, int colorId, string? sku = null) =>
        new(categoryId, "عباية", "Modest Abaya", null, null, null, 1250, true,
            [new NewVariant("M", colorId, Sku: sku), new NewVariant("L", colorId, 1300)]);

    [Fact]
    public async Task Create_makes_the_product_and_its_variants_with_default_skus()
    {
        using var t = TestDb.WithCatalog();

        var created = await new CreateProductHandler(t.Db, t.Storage)
            .HandleAsync(NewAbaya(t.Abayas.Id, t.Beige.Id), CancellationToken.None);

        Assert.Equal("modest-abaya", created.Slug);
        Assert.Equal([$"ZF-{created.Id}-M-BEIGE", $"ZF-{created.Id}-L-BEIGE"], created.Variants.Select(v => v.Sku));
        Assert.Equal(1300m, created.Variants.Single(v => v.Size == "L").Price);
    }

    [Fact]
    public async Task Same_link_or_sku_twice_is_a_duplicate()
    {
        using var t = TestDb.WithCatalog();
        var handler = new CreateProductHandler(t.Db, t.Storage);
        await handler.HandleAsync(NewAbaya(t.Abayas.Id, t.Beige.Id, sku: "ABAYA-M"), CancellationToken.None);

        Assert.Equal(ErrorCodes.Duplicate, (await Assert.ThrowsAsync<DomainException>(() =>
            handler.HandleAsync(NewAbaya(t.Abayas.Id, t.Beige.Id), CancellationToken.None))).Code);
        Assert.Equal(ErrorCodes.Duplicate, (await Assert.ThrowsAsync<DomainException>(() =>
            handler.HandleAsync(NewAbaya(t.Abayas.Id, t.Beige.Id, sku: "abaya-m") with { Slug = "other" }, CancellationToken.None))).Code);
    }

    [Fact]
    public async Task Unknown_category_or_color_is_a_validation_error()
    {
        using var t = TestDb.WithCatalog();
        var handler = new CreateProductHandler(t.Db, t.Storage);

        await Assert.ThrowsAsync<DomainException>(() => handler.HandleAsync(NewAbaya(999, t.Beige.Id), CancellationToken.None));
        await Assert.ThrowsAsync<DomainException>(() => handler.HandleAsync(NewAbaya(t.Abayas.Id, 999), CancellationToken.None));
    }

    [Fact]
    public async Task Admin_list_flags_low_stock_and_filters_by_main_category()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        t.AddProduct(t.Trousers, "Wide Trousers", 850, ("M", t.Beige, 20));

        var all = await new ListAdminProductsHandler(t.Db, t.Storage).HandleAsync(new AdminProductsQuery(), CancellationToken.None);
        var low = await new ListAdminProductsHandler(t.Db, t.Storage).HandleAsync(new AdminProductsQuery(LowStock: true), CancellationToken.None);
        var dresses = await new ListAdminProductsHandler(t.Db, t.Storage).HandleAsync(new AdminProductsQuery(CategoryId: t.Dresses.Id), CancellationToken.None);

        Assert.Equal(2, all.TotalCount);
        Assert.Equal("Modest Abaya", Assert.Single(low.Items).NameEn);
        Assert.Equal("Modest Abaya", Assert.Single(dresses.Items).NameEn);
        Assert.Equal(20, all.Items.Single(p => p.NameEn == "Wide Trousers").TotalStock);
    }

    [Fact]
    public async Task A_product_that_was_ordered_cannot_be_deleted()
    {
        using var t = TestDb.WithCatalog();
        var ordered = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        t.OrderVariant(ordered.Variants.Single());
        var handler = new DeleteProductHandler(t.Db, t.Storage, Log.For<DeleteProductHandler>());

        var error = await Assert.ThrowsAsync<DomainException>(() => handler.HandleAsync(ordered.Id, CancellationToken.None));

        Assert.Equal(ErrorCodes.HasOrders, error.Code);
        t.Reload();
        Assert.False((await t.Db.Products.SingleAsync(p => p.Id == ordered.Id)).IsDeleted);
    }

    [Fact]
    public async Task A_never_ordered_product_is_really_deleted_with_its_photo_files()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        await new UploadProductImageHandler(t.Db, t.Storage, new FakeImageProcessor(), Log.For<UploadProductImageHandler>())
            .HandleAsync(new UploadProductImageCommand(product.Id, new MemoryStream(Jpeg), Jpeg.Length, null, null), CancellationToken.None);
        Assert.Equal(3, t.Storage.Files.Count);

        await new DeleteProductHandler(t.Db, t.Storage, Log.For<DeleteProductHandler>()).HandleAsync(product.Id, CancellationToken.None);

        Assert.False(await t.Db.Products.AnyAsync());
        Assert.Empty(t.Storage.Files);
    }

    internal static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1];
}

public class AdminVariantTests
{
    [Fact]
    public async Task Add_variant_creates_a_default_sku_and_refuses_duplicates()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        var handler = new AddVariantHandler(t.Db);

        var added = await handler.HandleAsync(product.Id, new NewVariant("L", t.Navy.Id), CancellationToken.None);

        Assert.Equal($"ZF-{product.Id}-L-NAVY", added.Sku);
        Assert.Equal(ErrorCodes.Duplicate, (await Assert.ThrowsAsync<DomainException>(() =>
            handler.HandleAsync(product.Id, new NewVariant("l", t.Navy.Id), CancellationToken.None))).Code);
    }

    [Fact]
    public async Task Update_with_an_old_version_is_refused()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        var variant = product.Variants.Single();

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => new UpdateVariantHandler(t.Db).HandleAsync(variant.Id,
            new UpdateVariantCommand("M", t.Beige.Id, null, Version: variant.Version + 1), CancellationToken.None));
    }

    [Fact]
    public async Task Update_with_the_current_version_changes_the_price_but_never_the_stock()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        var variant = product.Variants.Single();

        var updated = await new UpdateVariantHandler(t.Db).HandleAsync(variant.Id,
            new UpdateVariantCommand("M", t.Beige.Id, 1300, variant.Version), CancellationToken.None);

        Assert.Equal((2, 1300m), (updated.Stock, updated.Price));
    }

    [Fact]
    public async Task Delete_is_soft_when_ordered_and_hard_otherwise()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2), ("L", t.Beige, 2));
        var ordered = product.Variants.Single(v => v.Size == "M");
        var never = product.Variants.Single(v => v.Size == "L");
        t.OrderVariant(ordered);
        var handler = new DeleteVariantHandler(t.Db);

        await handler.HandleAsync(ordered.Id, CancellationToken.None);
        await handler.HandleAsync(never.Id, CancellationToken.None);

        t.Reload();
        var remaining = await t.Db.ProductVariants.ToListAsync();
        Assert.True(Assert.Single(remaining).IsDeleted);
    }
}

public class AdminColorTests
{
    [Fact]
    public async Task List_counts_usage_and_a_used_color_cannot_be_deleted()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2), ("L", t.Beige, 2));

        var colors = await new ListColorsHandler(t.Db).HandleAsync(CancellationToken.None);
        Assert.Equal(2, colors.Single(c => c.NameEn == "Beige").UsageCount);

        Assert.Equal(ErrorCodes.InUse, (await Assert.ThrowsAsync<DomainException>(() =>
            new DeleteColorHandler(t.Db).HandleAsync(t.Beige.Id, CancellationToken.None))).Code);
        await new DeleteColorHandler(t.Db).HandleAsync(t.Navy.Id, CancellationToken.None);
    }

    [Fact]
    public async Task Same_color_name_twice_is_a_duplicate()
    {
        using var t = TestDb.WithCatalog();

        Assert.Equal(ErrorCodes.Duplicate, (await Assert.ThrowsAsync<DomainException>(() =>
            new CreateColorHandler(t.Db).HandleAsync(new SaveColorCommand("بيج", "beige", "#d6b995"), CancellationToken.None))).Code);
    }
}
