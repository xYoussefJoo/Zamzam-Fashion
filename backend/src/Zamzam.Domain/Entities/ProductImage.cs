using Zamzam.Domain.Common;

namespace Zamzam.Domain.Entities;

// Created only through Product.AddImage, so the 10-photo limit and ordering always apply.
public class ProductImage : Entity
{
    public int ProductId { get; private set; }
    public string Url { get; private set; } = null!;
    public string? AltAr { get; private set; }
    public string? AltEn { get; private set; }
    public int SortOrder { get; private set; } // 0 = main photo

    private ProductImage() { } // EF Core

    internal ProductImage(string url, string? altAr, string? altEn, int sortOrder)
    {
        Url = Guard.Required(url, "Image URL", 500);
        AltAr = Guard.Optional(altAr, "Arabic alt text", 150);
        AltEn = Guard.Optional(altEn, "English alt text", 150);
        SortOrder = sortOrder;
    }

    internal void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}
