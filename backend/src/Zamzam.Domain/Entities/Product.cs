using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Entities;

public class Product : Entity
{
    public const int MaxImages = 10;

    private readonly List<ProductImage> _images = [];
    private readonly List<ProductVariant> _variants = [];

    public int CategoryId { get; private set; }
    public Category? Category { get; private set; }

    public string NameAr { get; private set; } = null!;
    public string NameEn { get; private set; } = null!;
    public string Slug { get; private set; } = null!;
    public string? DescriptionAr { get; private set; }
    public string? DescriptionEn { get; private set; }
    public decimal BasePrice { get; private set; }
    public bool IsVisible { get; private set; }
    public bool IsDeleted { get; private set; }

    public IReadOnlyCollection<ProductImage> Images => _images;
    public IReadOnlyCollection<ProductVariant> Variants => _variants;

    public ProductImage? MainImage => _images.MinBy(i => i.SortOrder);
    public IEnumerable<ProductVariant> ActiveVariants => _variants.Where(v => !v.IsDeleted);

    private Product() { } // EF Core

    public Product(int categoryId, string nameAr, string nameEn, string? slug,
        string? descriptionAr, string? descriptionEn, decimal basePrice, bool isVisible = true)
    {
        Update(categoryId, nameAr, nameEn, slug, descriptionAr, descriptionEn, basePrice, isVisible);
    }

    public void Update(int categoryId, string nameAr, string nameEn, string? slug,
        string? descriptionAr, string? descriptionEn, decimal basePrice, bool isVisible)
    {
        CategoryId = Guard.Positive(categoryId, "Category");
        NameAr = Guard.Required(nameAr, "Arabic name", 150);
        NameEn = Guard.Required(nameEn, "English name", 150);
        Slug = Common.Slug.FromOrValidate(slug, NameEn);
        DescriptionAr = Guard.Optional(descriptionAr, "Arabic description", 4000);
        DescriptionEn = Guard.Optional(descriptionEn, "English description", 4000);
        BasePrice = Guard.Money(basePrice, "Base price");
        IsVisible = isVisible;
    }

    // ---------- variants (stock per size × color)

    public ProductVariant AddVariant(string size, int colorId, string sku, int stock, decimal? priceOverride = null)
    {
        EnsureNotDeleted();
        if (ActiveVariants.Any(v => v.Matches(size, colorId)))
            throw new DomainException(ErrorCodes.Duplicate, $"This product already has size {size.Trim()} in that color.");

        var variant = new ProductVariant(size, colorId, sku, stock, priceOverride);
        _variants.Add(variant);
        return variant;
    }

    public void UpdateVariant(int variantId, string size, int colorId, int stock, decimal? priceOverride)
    {
        var variant = FindVariant(variantId);
        if (ActiveVariants.Any(v => v.Id != variantId && v.Matches(size, colorId)))
            throw new DomainException(ErrorCodes.Duplicate, $"This product already has size {size.Trim()} in that color.");
        variant.Change(size, colorId, stock, priceOverride);
    }

    // The application decides hard vs soft delete (soft when the variant was ever ordered).
    public void RemoveVariant(int variantId, bool keepForHistory)
    {
        var variant = FindVariant(variantId);
        if (keepForHistory) variant.SoftDelete();
        else _variants.Remove(variant);
    }

    // ---------- images (the first one is the main photo)

    public ProductImage AddImage(string url, string? altAr, string? altEn)
    {
        EnsureNotDeleted();
        if (_images.Count >= MaxImages)
            throw new DomainException(ErrorCodes.Validation, $"A product can have at most {MaxImages} photos.");

        var image = new ProductImage(url, altAr, altEn, _images.Count);
        _images.Add(image);
        return image;
    }

    public ProductImage RemoveImage(int imageId)
    {
        var image = _images.SingleOrDefault(i => i.Id == imageId)
            ?? throw new DomainException(ErrorCodes.Validation, "Photo not found on this product.");
        _images.Remove(image);

        // Close the gap so the next photo becomes the main one.
        var order = 0;
        foreach (var remaining in _images.OrderBy(i => i.SortOrder)) remaining.SetSortOrder(order++);
        return image;
    }

    // ---------- delete

    // Hides the product from the shop but keeps it for old orders.
    public void SoftDelete()
    {
        IsDeleted = true;
        IsVisible = false;
        foreach (var variant in _variants) variant.SoftDelete();
    }

    private ProductVariant FindVariant(int variantId) =>
        _variants.SingleOrDefault(v => v.Id == variantId && !v.IsDeleted)
        ?? throw new DomainException(ErrorCodes.Validation, "Variant not found on this product.");

    private void EnsureNotDeleted()
    {
        if (IsDeleted) throw new DomainException(ErrorCodes.Validation, "This product was deleted.");
    }
}
