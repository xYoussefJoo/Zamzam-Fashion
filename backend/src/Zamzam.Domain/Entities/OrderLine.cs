using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.ValueObjects;

namespace Zamzam.Domain.Entities;

// A snapshot of what was bought. Later product renames or price changes never touch it.
public class OrderLine : Entity
{
    public const int MaxQuantity = 10;

    public int OrderId { get; private set; }
    public int VariantId { get; private set; }
    public string ProductNameAr { get; private set; } = null!;
    public string ProductNameEn { get; private set; } = null!;
    public string Size { get; private set; } = null!;
    public string ColorNameAr { get; private set; } = null!;
    public string ColorNameEn { get; private set; } = null!;
    public decimal UnitPrice { get; private set; }
    public int Quantity { get; private set; }
    public decimal LineTotal { get; private set; }
    public string? ImageUrl { get; private set; }

    private OrderLine() { } // EF Core

    internal OrderLine(OrderLineDraft draft)
    {
        if (draft.Quantity is < 1 or > MaxQuantity)
            throw new DomainException(ErrorCodes.Validation, $"Quantity must be between 1 and {MaxQuantity}.");

        VariantId = Guard.Positive(draft.VariantId, "Variant");
        ProductNameAr = Guard.Required(draft.ProductNameAr, "Product name (Arabic)", 150);
        ProductNameEn = Guard.Required(draft.ProductNameEn, "Product name (English)", 150);
        Size = Guard.Required(draft.Size, "Size", 20);
        ColorNameAr = Guard.Required(draft.ColorNameAr, "Color (Arabic)", 50);
        ColorNameEn = Guard.Required(draft.ColorNameEn, "Color (English)", 50);
        UnitPrice = Guard.Money(draft.UnitPrice, "Unit price");
        Quantity = draft.Quantity;
        LineTotal = UnitPrice * Quantity;
        ImageUrl = Guard.Optional(draft.ImageUrl, "Image URL", 500);
    }
}
