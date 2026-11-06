namespace Zamzam.Domain.Settings;

// Everything the tailoring form offers. The owner edits it from the dashboard (no code changes).
public sealed record TailoringCatalogContent(
    IReadOnlyList<GarmentType> Garments,
    IReadOnlyList<TailoringStyle> Styles,
    IReadOnlyList<FabricOption> Fabrics,
    IReadOnlyList<FitOption> Fits,
    IReadOnlyDictionary<string, IReadOnlyList<MeasurementField>> MeasurementGroups);

// MeasurementGroups lists which field groups this garment uses, e.g. ["common", "pants"].
public sealed record GarmentType(string Key, string NameAr, string NameEn, IReadOnlyList<string> MeasurementGroups, bool IsActive = true);

public sealed record TailoringStyle(string Id, string Garment, string NameAr, string NameEn,
    string DefaultFabric, string DefaultFit, string? ImageUrl = null, bool IsActive = true);

public sealed record FabricOption(string Key, string NameAr, string NameEn, bool IsActive = true);

public sealed record FitOption(string Key, string NameAr, string NameEn, bool IsActive = true);

public sealed record MeasurementField(string Key, string NameAr, string NameEn, bool Required = false);
