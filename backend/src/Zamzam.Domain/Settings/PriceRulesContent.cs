namespace Zamzam.Domain.Settings;

// The prices behind the tailoring calculator. Stored as one jsonb document.
public sealed record PriceRulesContent(
    IReadOnlyList<GarmentPrice> GarmentBasePrices,   // used for "my own design" (no style chosen)
    IReadOnlyList<StylePrice> StyleBasePrices,
    IReadOnlyList<FabricPrice> Fabrics,
    decimal LiningPrice,
    IReadOnlyList<SizeExtra> SizeExtras,             // e.g. from XL: +100
    IReadOnlyList<ExtraOption> Extras);              // e.g. embroidery: +300

public sealed record GarmentPrice(string Garment, decimal BasePrice);

public sealed record StylePrice(string StyleId, decimal BasePrice);

public sealed record FabricPrice(string Fabric, decimal Extra);

public sealed record SizeExtra(string FromSize, decimal Extra);

public sealed record ExtraOption(string Key, string NameAr, string NameEn, decimal Price);

// The calculator's answer, shown to the customer line by line.
public sealed record PriceEstimate(decimal BasePrice, IReadOnlyList<PriceLine> Items, decimal Total);

public sealed record PriceLine(string Key, string LabelAr, string LabelEn, decimal Amount);
