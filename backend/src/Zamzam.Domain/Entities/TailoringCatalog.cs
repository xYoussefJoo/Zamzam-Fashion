using Zamzam.Domain.Constants;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.Settings;

namespace Zamzam.Domain.Entities;

// Single row. Holds the tailoring catalog and checks requests against it.
public class TailoringCatalog : Entity
{
    public TailoringCatalogContent Content { get; private set; } = null!;

    private TailoringCatalog() { } // EF Core

    public TailoringCatalog(TailoringCatalogContent content) => Replace(content);

    public void Replace(TailoringCatalogContent content)
    {
        if (content is null || content.Garments.Count == 0)
            throw new DomainException(ErrorCodes.Validation, "The catalog needs at least one garment type.");

        RequireUnique(content.Garments.Select(g => g.Key), "garment");
        RequireUnique(content.Styles.Select(s => s.Id), "style");
        RequireUnique(content.Fabrics.Select(f => f.Key), "fabric");
        RequireUnique(content.Fits.Select(f => f.Key), "fit");

        foreach (var garment in content.Garments)
            foreach (var group in garment.MeasurementGroups)
                if (!content.MeasurementGroups.ContainsKey(group))
                    throw new DomainException(ErrorCodes.Validation, $"Garment '{garment.Key}' uses unknown measurement group '{group}'.");

        foreach (var (group, fields) in content.MeasurementGroups)
            RequireUnique(fields.Select(f => f.Key), $"measurement in group '{group}'");

        foreach (var style in content.Styles)
        {
            if (content.Garments.All(g => g.Key != style.Garment))
                throw new DomainException(ErrorCodes.Validation, $"Style '{style.Id}' uses unknown garment '{style.Garment}'.");
            if (content.Fabrics.All(f => f.Key != style.DefaultFabric))
                throw new DomainException(ErrorCodes.Validation, $"Style '{style.Id}' uses unknown fabric '{style.DefaultFabric}'.");
            if (content.Fits.All(f => f.Key != style.DefaultFit))
                throw new DomainException(ErrorCodes.Validation, $"Style '{style.Id}' uses unknown fit '{style.DefaultFit}'.");
        }

        Content = content;
    }

    // All measurement fields a garment may use.
    public IReadOnlyList<MeasurementField> FieldsFor(string garmentKey)
    {
        var garment = ActiveGarment(garmentKey);
        return garment.MeasurementGroups.SelectMany(g => Content.MeasurementGroups[g]).DistinctBy(f => f.Key).ToList();
    }

    // Checks a customer's tailoring request against the active catalog.
    public void EnsureValidRequest(string? styleId, string garment, string fabric, string fit,
        SizingMode sizingMode, IReadOnlyDictionary<string, decimal>? measurements)
    {
        var garmentType = ActiveGarment(garment);

        if (styleId is not null && !Content.Styles.Any(s => s.IsActive && s.Id == styleId && s.Garment == garmentType.Key))
            throw new DomainException(ErrorCodes.Validation, "This style isn't available for the chosen garment.");
        if (!Content.Fabrics.Any(f => f.IsActive && f.Key == fabric))
            throw new DomainException(ErrorCodes.Validation, "This fabric isn't available.");
        if (!Content.Fits.Any(f => f.IsActive && f.Key == fit))
            throw new DomainException(ErrorCodes.Validation, "This fit isn't available.");

        if (sizingMode != SizingMode.Measurements) return;

        var fields = FieldsFor(garment);
        var given = measurements ?? new Dictionary<string, decimal>();
        var unknown = given.Keys.FirstOrDefault(k => fields.All(f => f.Key != k));
        if (unknown is not null)
            throw new DomainException(ErrorCodes.Validation, $"'{unknown}' isn't a measurement for this garment.");
        var missing = fields.FirstOrDefault(f => f.Required && !given.ContainsKey(f.Key));
        if (missing is not null)
            throw new DomainException(ErrorCodes.Validation, $"{missing.NameEn} is required for this garment.");
    }

    private GarmentType ActiveGarment(string key) =>
        Content.Garments.FirstOrDefault(g => g.IsActive && g.Key == key)
        ?? throw new DomainException(ErrorCodes.Validation, "This garment type isn't available.");

    private static void RequireUnique(IEnumerable<string> keys, string what)
    {
        var duplicate = keys.GroupBy(k => k).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            throw new DomainException(ErrorCodes.Validation, $"Duplicate {what} key '{duplicate.Key}'.");
    }
}
