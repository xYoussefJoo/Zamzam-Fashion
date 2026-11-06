using Zamzam.Domain.Common;

namespace Zamzam.Domain.Entities;

// Created only through Product.AddImage, so the 10-photo limit and ordering always apply.
// StorageKey is where the files live ("products/12/3f9a…"); the URLs are built when reading,
// so changing the storage provider or domain never breaks saved photos.
public class ProductImage : Entity
{
    public int ProductId { get; private set; }
    public string StorageKey { get; private set; } = null!;
    public string? AltAr { get; private set; }
    public string? AltEn { get; private set; }
    public int SortOrder { get; private set; } // 0 = main photo

    private ProductImage() { } // EF Core

    internal ProductImage(string storageKey, string? altAr, string? altEn, int sortOrder)
    {
        StorageKey = Guard.Required(storageKey, "Storage key", 300);
        AltAr = Guard.Optional(altAr, "Arabic alt text", 150);
        AltEn = Guard.Optional(altEn, "English alt text", 150);
        SortOrder = sortOrder;
    }

    internal void SetSortOrder(int sortOrder) => SortOrder = sortOrder;
}
