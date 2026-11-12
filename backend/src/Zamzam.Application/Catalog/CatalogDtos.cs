using Zamzam.Application.Common;
using Zamzam.Domain.Constants;

namespace Zamzam.Application.Catalog;

// ---------- shared

public sealed record ImageDto(int Id, string Url, string SrcSet, string? AltAr, string? AltEn, int SortOrder);

public sealed record ColorDto(int Id, string NameAr, string NameEn, string Hex);

public sealed record CategoryRef(int Id, string Slug, string NameAr, string NameEn);

// ---------- public shop (#5–7)

public sealed record CategoryNode(int Id, string Slug, string NameAr, string NameEn, string? ImageUrl, int SortOrder,
    IReadOnlyList<CategoryNode> Children);

public sealed record ProductCard(int Id, string Slug, string NameAr, string NameEn, CategoryRef Category,
    decimal MinPrice, decimal MaxPrice, ImageDto? Image, IReadOnlyList<ColorDto> Colors, IReadOnlyList<string> Sizes,
    bool InStock, DateTime CreatedAt);

// Stock is null when there are more than 5 pieces; the shop only says "only N left" near the end.
public sealed record VariantDto(int Id, string Sku, string Size, ColorDto Color, decimal Price, bool InStock, int? Stock);

public sealed record ProductDetail(int Id, string Slug, string NameAr, string NameEn, CategoryRef Category,
    string? DescriptionAr, string? DescriptionEn, decimal MinPrice, decimal MaxPrice, bool InStock,
    IReadOnlyList<ImageDto> Images, IReadOnlyList<VariantDto> Variants);

// ---------- admin (#17–34)

public sealed record AdminCategoryNode(int Id, int? ParentId, string Slug, string NameAr, string NameEn, string? ImageUrl,
    int SortOrder, bool IsVisible, int ProductCount, IReadOnlyList<AdminCategoryNode> Children);

public sealed record AdminProductRow(int Id, string Slug, string NameAr, string NameEn, int CategoryId,
    string CategoryNameAr, string CategoryNameEn, decimal BasePrice, int TotalStock, int VariantCount,
    bool IsVisible, string? ThumbnailUrl, bool LowStock, int LowVariants); // LowVariants: low or sold-out variants

public sealed record AdminVariantDto(int Id, string Sku, string Size, ColorDto Color, int Stock,
    decimal? PriceOverride, decimal Price, uint Version);

public sealed record AdminProductDetail(int Id, int CategoryId, string Slug, string NameAr, string NameEn,
    string? DescriptionAr, string? DescriptionEn, decimal BasePrice, bool IsVisible,
    IReadOnlyList<ImageDto> Images, IReadOnlyList<AdminVariantDto> Variants, DateTime CreatedAt, DateTime? UpdatedAt);

public sealed record AdminColorDto(int Id, string NameAr, string NameEn, string Hex, int UsageCount);

public static class CatalogRules
{
    public const int PublicStockShownAtOrBelow = 5; // "only 3 left"
    public const int LowStockAtOrBelow = 3;         // admin warning

    public static int? PublicStock(int stock) => stock <= PublicStockShownAtOrBelow ? stock : null;

    // XS, S, M, L, XL, XXL, 3XL, FreeSize first in that order; custom labels after, A→Z.
    public static IEnumerable<string> OrderSizes(IEnumerable<string> sizes) =>
        sizes.Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(s => StandardSizes.IsValid(s) ? StandardSizes.All.ToList().IndexOf(s) : int.MaxValue)
            .ThenBy(s => s, StringComparer.OrdinalIgnoreCase);

    public static ImageDto ToImageDto(this IImageStorage storage, int id, string storageKey, string? altAr, string? altEn, int sortOrder) =>
        new(id,
            storage.PublicUrl(ImageKeys.ForWidth(storageKey, ImageSizes.Display)),
            string.Join(", ", ImageSizes.Widths.Select(w => $"{storage.PublicUrl(ImageKeys.ForWidth(storageKey, w))} {w}w")),
            altAr, altEn, sortOrder);
}
