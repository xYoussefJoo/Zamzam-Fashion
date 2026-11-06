namespace Zamzam.Domain.Common;

// Default stock-keeping unit: ZF-{productId}-{size}-{color}, e.g. ZF-12-M-BEIGE.
public static class Sku
{
    public static string For(int productId, string size, string colorNameEn) =>
        $"ZF-{productId}-{Slug.From(size)}-{Slug.From(colorNameEn)}".ToUpperInvariant();
}
