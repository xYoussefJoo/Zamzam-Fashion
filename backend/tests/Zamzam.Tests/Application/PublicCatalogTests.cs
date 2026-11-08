using Zamzam.Application.Catalog.Public;
using Zamzam.Application.Common;
using Zamzam.Domain.Entities;

namespace Zamzam.Tests.Application;

public class PublicCatalogTests
{
    private static Task<Paged<Zamzam.Application.Catalog.ProductCard>> Search(TestDb t, SearchProductsQuery query) =>
        new SearchProductsHandler(t.Db, t.Storage).HandleAsync(query, CancellationToken.None);

    [Fact]
    public async Task Category_tree_shows_visible_categories_with_their_children()
    {
        using var t = TestDb.WithCatalog();

        var tree = await new GetCategoryTreeHandler(t.Db).HandleAsync(CancellationToken.None);

        Assert.Equal(["dresses", "trousers"], tree.Select(c => c.Slug));
        Assert.Equal("abayas", Assert.Single(tree[0].Children).Slug);
    }

    [Fact]
    public async Task Hidden_and_out_of_stock_products_are_not_listed_by_default()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Trousers, "Wide Trousers", 850, ("M", t.Beige, 3));
        t.AddProduct(t.Trousers, "Sold Out Trousers", 900, ("M", t.Beige, 0));
        var hidden = t.AddProduct(t.Trousers, "Hidden Trousers", 900, ("M", t.Beige, 3));
        hidden.Update(hidden.CategoryId, hidden.NameAr, hidden.NameEn, hidden.Slug, null, null, hidden.BasePrice, isVisible: false);
        t.Db.SaveChanges();

        var page = await Search(t, new SearchProductsQuery());

        Assert.Equal(["Wide Trousers"], page.Items.Select(p => p.NameEn));
        Assert.Equal(2, (await Search(t, new SearchProductsQuery(InStock: false))).TotalCount);
    }

    [Fact]
    public async Task A_card_shows_the_main_photo_and_a_product_without_photos_shows_none()
    {
        using var t = TestDb.WithCatalog();
        var withPhotos = t.AddProduct(t.Trousers, "Wide Trousers", 850, ("M", t.Beige, 3));
        withPhotos.AddImage("products/1/front", null, "Front");
        withPhotos.AddImage("products/1/back", null, "Back");
        t.AddProduct(t.Trousers, "Plain Trousers", 900, ("M", t.Beige, 3));
        t.Db.SaveChanges();

        var page = await Search(t, new SearchProductsQuery());

        Assert.Equal("Front", page.Items.Single(p => p.NameEn == "Wide Trousers").Image!.AltEn);
        Assert.Null(page.Items.Single(p => p.NameEn == "Plain Trousers").Image);
    }

    [Fact]
    public async Task A_main_category_includes_its_sub_categories()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        t.AddProduct(t.Dresses, "Maxi Dress", 1350, ("L", t.Navy, 2));
        t.AddProduct(t.Trousers, "Wide Trousers", 850, ("M", t.Beige, 2));

        Assert.Equal(2, (await Search(t, new SearchProductsQuery(Category: "dresses"))).TotalCount);
        Assert.Equal(1, (await Search(t, new SearchProductsQuery(Category: "abayas"))).TotalCount);
    }

    [Fact]
    public async Task Filters_by_size_color_price_and_search_text()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Trousers, "Wide Trousers", 850, ("M", t.Beige, 2), ("L", t.Navy, 2));
        t.AddProduct(t.Trousers, "Palazzo", 1050, ("S", t.Navy, 2));

        Assert.Equal(["Wide Trousers"], (await Search(t, new SearchProductsQuery(Size: ["M"]))).Items.Select(p => p.NameEn));
        Assert.Equal(2, (await Search(t, new SearchProductsQuery(Color: [t.Navy.Id]))).TotalCount);
        Assert.Equal(["Palazzo"], (await Search(t, new SearchProductsQuery(MinPrice: 1000))).Items.Select(p => p.NameEn));
        Assert.Equal(["Palazzo"], (await Search(t, new SearchProductsQuery(Q: "pala"))).Items.Select(p => p.NameEn));
    }

    [Fact]
    public async Task Cards_show_price_range_sizes_in_order_and_paging()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Trousers, "Wide Trousers", 850, ("XL", t.Beige, 2), ("S", t.Navy, 2));
        product.UpdateVariant(product.Variants.First(v => v.Size == "XL").Id, "XL", t.Beige.Id, 2, 950);
        t.Db.SaveChanges();
        t.AddProduct(t.Trousers, "Palazzo", 1050, ("S", t.Navy, 2));

        var page = await Search(t, new SearchProductsQuery(Sort: "price_asc", PageSize: 1));
        var card = Assert.Single(page.Items);

        Assert.Equal("Wide Trousers", card.NameEn);
        Assert.Equal((850m, 950m), (card.MinPrice, card.MaxPrice));
        Assert.Equal(["S", "XL"], card.Sizes);
        Assert.Equal((2, 2), (page.TotalCount, page.TotalPages));
    }

    [Fact]
    public async Task Product_page_hides_exact_stock_above_five()
    {
        using var t = TestDb.WithCatalog();
        t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 3), ("L", t.Beige, 12));

        var detail = await new GetProductBySlugHandler(t.Db, t.Storage).HandleAsync("modest-abaya", CancellationToken.None);

        Assert.Equal(3, detail.Variants.Single(v => v.Size == "M").Stock);   // "only 3 left"
        Assert.Null(detail.Variants.Single(v => v.Size == "L").Stock);       // plenty
        Assert.Equal("abayas", detail.Category.Slug);
    }

    [Fact]
    public async Task Unknown_or_hidden_product_is_404()
    {
        using var t = TestDb.WithCatalog();
        var handler = new GetProductBySlugHandler(t.Db, t.Storage);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.HandleAsync("nope", CancellationToken.None));
    }

    [Fact]
    public async Task Search_query_rules()
    {
        var validator = new SearchProductsValidator();

        Assert.False((await validator.ValidateAsync(new SearchProductsQuery(Q: "a"))).IsValid);
        Assert.False((await validator.ValidateAsync(new SearchProductsQuery(Sort: "random"))).IsValid);
        Assert.False((await validator.ValidateAsync(new SearchProductsQuery(MinPrice: 500, MaxPrice: 100))).IsValid);
        Assert.True((await validator.ValidateAsync(new SearchProductsQuery(Q: "abaya", Sort: "price_asc"))).IsValid);
    }
}
