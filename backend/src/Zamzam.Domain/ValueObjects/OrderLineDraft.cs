namespace Zamzam.Domain.ValueObjects;

// What the application hands to Order.CreateReady after it has priced and reserved each variant.
public sealed record OrderLineDraft(
    int VariantId,
    string ProductNameAr,
    string ProductNameEn,
    string Size,
    string ColorNameAr,
    string ColorNameEn,
    decimal UnitPrice,
    int Quantity,
    string? ImageUrl);

// What a cancelled ready-made order gives back to stock.
public sealed record StockReturn(int VariantId, int Quantity);
