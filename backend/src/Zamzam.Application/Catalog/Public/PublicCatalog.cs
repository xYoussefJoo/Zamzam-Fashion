using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Entities;

namespace Zamzam.Application.Catalog.Public;

// ===================== #5 GET /api/categories =====================

public sealed class GetCategoryTreeHandler(IAppDbContext db)
{
    public async Task<IReadOnlyList<CategoryNode>> HandleAsync(CancellationToken ct)
    {
        var visible = await db.Categories.AsNoTracking()
            .Where(c => c.IsVisible)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.NameEn)
            .Select(c => new { c.Id, c.ParentId, c.Slug, c.NameAr, c.NameEn, c.ImageUrl, c.SortOrder })
            .ToListAsync(ct);

        // A hidden main category hides its sub-categories too (they're only shown under a visible parent).
        return visible.Where(c => c.ParentId is null)
            .Select(root => new CategoryNode(root.Id, root.Slug, root.NameAr, root.NameEn, root.ImageUrl, root.SortOrder,
                visible.Where(c => c.ParentId == root.Id)
                    .Select(c => new CategoryNode(c.Id, c.Slug, c.NameAr, c.NameEn, c.ImageUrl, c.SortOrder, []))
                    .ToList()))
            .ToList();
    }
}

// ===================== #6 GET /api/products =====================

public sealed record SearchProductsQuery(
    string? Category = null,
    string? Q = null,
    string[]? Size = null,
    int[]? Color = null,
    decimal? MinPrice = null,
    decimal? MaxPrice = null,
    bool? InStock = null,
    string? Sort = null,
    int? Page = null,
    int? PageSize = null);

public static class ProductSort
{
    public const string Newest = "newest", PriceAsc = "price_asc", PriceDesc = "price_desc", Name = "name";
    public static readonly string[] All = [Newest, PriceAsc, PriceDesc, Name];
}

public sealed class SearchProductsValidator : AbstractValidator<SearchProductsQuery>
{
    public SearchProductsValidator()
    {
        RuleFor(q => q.Q).Length(2, 100).When(q => !string.IsNullOrWhiteSpace(q.Q));
        RuleFor(q => q.Sort).Must(s => ProductSort.All.Contains(s)).When(q => q.Sort is not null)
            .WithMessage($"Sort must be one of: {string.Join(", ", ProductSort.All)}.");
        RuleFor(q => q.MinPrice).GreaterThanOrEqualTo(0).When(q => q.MinPrice is not null);
        RuleFor(q => q.MaxPrice).GreaterThanOrEqualTo(q => q.MinPrice ?? 0).When(q => q.MaxPrice is not null)
            .WithMessage("Max price must be at least the min price.");
        RuleFor(q => q.Size).Must(s => s!.Length <= 10).When(q => q.Size is not null);
        RuleFor(q => q.Color).Must(c => c!.Length <= 10).When(q => q.Color is not null);
    }
}

public sealed class SearchProductsHandler(IAppDbContext db, IImageStorage storage)
{
    public async Task<Paged<ProductCard>> HandleAsync(SearchProductsQuery query, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        var products = ShopQueries.VisibleProducts(db);

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            // A main category includes its sub-categories.
            var categoryIds = await db.Categories
                .Where(c => c.IsVisible && (c.Slug == query.Category || (c.Parent != null && c.Parent.Slug == query.Category)))
                .Select(c => c.Id).ToListAsync(ct);
            products = products.Where(p => categoryIds.Contains(p.CategoryId));
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var text = query.Q.Trim();
            var lower = text.ToLowerInvariant();
            products = products.Where(p =>
                p.NameEn.ToLower().Contains(lower) || p.NameAr.Contains(text) ||
                p.Variants.Any(v => !v.IsDeleted && v.Sku.ToLower().Contains(lower)));
        }

        var inStockOnly = query.InStock ?? true;
        if (inStockOnly) products = products.Where(p => p.Variants.Any(v => !v.IsDeleted && v.Stock > 0));

        if (query.Size is { Length: > 0 } sizes)
            products = products.Where(p => p.Variants.Any(v => !v.IsDeleted && sizes.Contains(v.Size) && (!inStockOnly || v.Stock > 0)));

        if (query.Color is { Length: > 0 } colors)
            products = products.Where(p => p.Variants.Any(v => !v.IsDeleted && colors.Contains(v.ColorId) && (!inStockOnly || v.Stock > 0)));

        if (query.MinPrice is not null || query.MaxPrice is not null)
        {
            var min = query.MinPrice ?? 0;
            var max = query.MaxPrice ?? decimal.MaxValue;
            products = products.Where(p => p.Variants.Any(v => !v.IsDeleted
                && (v.PriceOverride ?? p.BasePrice) >= min && (v.PriceOverride ?? p.BasePrice) <= max));
        }

        var priced = products.Select(p => new
        {
            Product = p,
            MinPrice = p.Variants.Where(v => !v.IsDeleted).Min(v => (decimal?)(v.PriceOverride ?? p.BasePrice)) ?? p.BasePrice,
        });

        priced = (query.Sort ?? ProductSort.Newest) switch
        {
            ProductSort.PriceAsc => priced.OrderBy(x => x.MinPrice).ThenBy(x => x.Product.Id),
            ProductSort.PriceDesc => priced.OrderByDescending(x => x.MinPrice).ThenBy(x => x.Product.Id),
            ProductSort.Name => priced.OrderBy(x => x.Product.NameEn).ThenBy(x => x.Product.Id),
            _ => priced.OrderByDescending(x => x.Product.CreatedAt).ThenByDescending(x => x.Product.Id),
        };

        var total = await priced.CountAsync(ct);
        var rows = await priced.Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new ShopQueries.ProductRow(x.Product.Id, x.Product.Slug, x.Product.NameAr, x.Product.NameEn,
                x.Product.BasePrice, x.Product.CreatedAt,
                new CategoryRef(x.Product.Category!.Id, x.Product.Category.Slug, x.Product.Category.NameAr, x.Product.Category.NameEn)))
            .ToListAsync(ct);

        var cards = await ShopQueries.ToCardsAsync(db, storage, rows, ct);
        return Paging.Create(cards, page, pageSize, total);
    }
}

// ===================== #7 GET /api/products/{slug} =====================

public sealed class GetProductBySlugHandler(IAppDbContext db, IImageStorage storage)
{
    public async Task<ProductDetail> HandleAsync(string slug, CancellationToken ct)
    {
        var product = await ShopQueries.VisibleProducts(db)
            .Include(p => p.Category)
            .Include(p => p.Images)
            .Include(p => p.Variants.Where(v => !v.IsDeleted)).ThenInclude(v => v.Color)
            .FirstOrDefaultAsync(p => p.Slug == slug, ct)
            ?? throw new NotFoundException("Product");

        var variants = product.Variants
            .OrderBy(v => CatalogRules.OrderSizes(product.Variants.Select(x => x.Size)).ToList().IndexOf(v.Size))
            .ThenBy(v => v.Color!.NameEn)
            .Select(v => new VariantDto(v.Id, v.Sku, v.Size, new ColorDto(v.Color!.Id, v.Color.NameAr, v.Color.NameEn, v.Color.Hex),
                v.PriceFrom(product.BasePrice), v.Stock > 0, CatalogRules.PublicStock(v.Stock)))
            .ToList();

        var prices = variants.Select(v => v.Price).DefaultIfEmpty(product.BasePrice).ToList();
        return new ProductDetail(product.Id, product.Slug, product.NameAr, product.NameEn,
            new CategoryRef(product.Category!.Id, product.Category.Slug, product.Category.NameAr, product.Category.NameEn),
            product.DescriptionAr, product.DescriptionEn, prices.Min(), prices.Max(), variants.Any(v => v.InStock),
            product.Images.OrderBy(i => i.SortOrder).Select(i => storage.ToImageDto(i.Id, i.StorageKey, i.AltAr, i.AltEn, i.SortOrder)).ToList(),
            variants);
    }
}

// ===================== shared shop queries =====================

internal static class ShopQueries
{
    public sealed record ProductRow(int Id, string Slug, string NameAr, string NameEn, decimal BasePrice, DateTime CreatedAt, CategoryRef Category);

    // Visible, not deleted, in a visible category whose parent (if any) is visible too.
    public static IQueryable<Product> VisibleProducts(IAppDbContext db) =>
        db.Products.AsNoTracking().Where(p => p.IsVisible && !p.IsDeleted
            && p.Category!.IsVisible && (p.Category.ParentId == null || p.Category.Parent!.IsVisible));

    // Two small queries for the whole page (variants + main photos) instead of one per product.
    public static async Task<IReadOnlyList<ProductCard>> ToCardsAsync(IAppDbContext db, IImageStorage storage,
        IReadOnlyList<ProductRow> rows, CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();

        var variants = await db.ProductVariants.AsNoTracking()
            .Where(v => ids.Contains(v.ProductId) && !v.IsDeleted)
            .Select(v => new { v.ProductId, v.Size, v.Stock, v.PriceOverride,
                Color = new ColorDto(v.Color!.Id, v.Color.NameAr, v.Color.NameEn, v.Color.Hex) })
            .ToListAsync(ct);

        var mainImages = await db.ProductImages.AsNoTracking()
            .Where(i => ids.Contains(i.ProductId) && i.SortOrder == 0)
            .Select(i => new { i.ProductId, i.Id, i.StorageKey, i.AltAr, i.AltEn, i.SortOrder })
            .ToListAsync(ct);

        return rows.Select(row =>
        {
            var own = variants.Where(v => v.ProductId == row.Id).ToList();
            var inStock = own.Where(v => v.Stock > 0).ToList();
            var shown = inStock.Count > 0 ? inStock : own; // out of stock: still show what it comes in
            var prices = own.Select(v => v.PriceOverride ?? row.BasePrice).DefaultIfEmpty(row.BasePrice).ToList();
            var image = mainImages.FirstOrDefault(i => i.ProductId == row.Id);

            return new ProductCard(row.Id, row.Slug, row.NameAr, row.NameEn, row.Category, prices.Min(), prices.Max(),
                image is null ? null : storage.ToImageDto(image.Id, image.StorageKey, image.AltAr, image.AltEn, image.SortOrder),
                shown.Select(v => v.Color).DistinctBy(c => c.Id).OrderBy(c => c.NameEn).ToList(),
                CatalogRules.OrderSizes(shown.Select(v => v.Size)).ToList(),
                inStock.Count > 0, row.CreatedAt);
        }).ToList();
    }
}
