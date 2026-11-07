using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.Settings;

namespace Zamzam.Application.Tailoring;

// ===================== #12 GET /api/tailoring/catalog =====================

public sealed record PublicExtra(string Key, string NameAr, string NameEn, decimal Price);

public sealed record PublicTailoringCatalog(
    IReadOnlyList<GarmentType> Garments,
    IReadOnlyList<TailoringStyle> Styles,
    IReadOnlyList<FabricOption> Fabrics,
    IReadOnlyList<FitOption> Fits,
    IReadOnlyDictionary<string, IReadOnlyList<MeasurementField>> MeasurementGroups,
    IReadOnlyList<string> StandardSizes,
    IReadOnlyList<PublicExtra> Extras,
    decimal LiningPrice);

// What the custom-order form shows: only active items, plus the extras with their prices.
public sealed class GetPublicTailoringCatalogHandler(IAppDbContext db)
{
    public async Task<PublicTailoringCatalog> HandleAsync(CancellationToken ct)
    {
        var catalog = (await TailoringData.CatalogAsync(db, ct)).Content;
        var prices = (await TailoringData.PricesAsync(db, ct)).Content;
        var garments = catalog.Garments.Where(g => g.IsActive).ToList();
        var usedGroups = garments.SelectMany(g => g.MeasurementGroups).ToHashSet();

        return new PublicTailoringCatalog(
            garments,
            catalog.Styles.Where(s => s.IsActive && garments.Any(g => g.Key == s.Garment)).ToList(),
            catalog.Fabrics.Where(f => f.IsActive).ToList(),
            catalog.Fits.Where(f => f.IsActive).ToList(),
            catalog.MeasurementGroups.Where(g => usedGroups.Contains(g.Key)).ToDictionary(g => g.Key, g => g.Value),
            Domain.Constants.StandardSizes.All,
            prices.Extras.Select(e => new PublicExtra(e.Key, e.NameAr, e.NameEn, e.Price)).ToList(),
            prices.LiningPrice);
    }
}

// ===================== #39 / #40 admin tailoring catalog =====================

public sealed class GetAdminTailoringCatalogHandler(IAppDbContext db)
{
    public async Task<TailoringCatalogContent> HandleAsync(CancellationToken ct) => (await TailoringData.CatalogAsync(db, ct)).Content;
}

public sealed class TailoringCatalogValidator : AbstractValidator<TailoringCatalogContent>
{
    public TailoringCatalogValidator()
    {
        RuleFor(c => c.Garments).NotEmpty().Must(g => g.Count <= 30);
        RuleFor(c => c.Styles).NotNull().Must(s => s.Count <= 200);
        RuleFor(c => c.Fabrics).NotEmpty().Must(f => f.Count <= 100);
        RuleFor(c => c.Fits).NotEmpty().Must(f => f.Count <= 20);
        RuleFor(c => c.MeasurementGroups).NotNull().Must(g => g.Count <= 30 && g.Values.All(fields => fields.Count <= 60));
        RuleForEach(c => c.Garments).ChildRules(g =>
        {
            g.RuleFor(x => x.Key).NotEmpty().MaximumLength(50);
            g.RuleFor(x => x.NameAr).NotEmpty().MaximumLength(100);
            g.RuleFor(x => x.NameEn).NotEmpty().MaximumLength(100);
        });
        RuleForEach(c => c.Styles).ChildRules(s =>
        {
            s.RuleFor(x => x.Id).NotEmpty().MaximumLength(50);
            s.RuleFor(x => x.NameAr).NotEmpty().MaximumLength(100);
            s.RuleFor(x => x.NameEn).NotEmpty().MaximumLength(100);
            s.RuleFor(x => x.ImageUrl).MaximumLength(500)
                .Must(u => Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
                .When(x => !string.IsNullOrWhiteSpace(x.ImageUrl)).WithMessage("Style image must be an https:// link.");
        });
    }
}

// Replaces the whole catalog. Orders already placed keep the keys they were made with.
public sealed class UpdateTailoringCatalogHandler(IAppDbContext db)
{
    public async Task<TailoringCatalogContent> HandleAsync(TailoringCatalogContent content, CancellationToken ct)
    {
        var catalog = await db.TailoringCatalog.FirstOrDefaultAsync(ct);
        if (catalog is null) db.TailoringCatalog.Add(catalog = new TailoringCatalog(content));
        else catalog.Replace(content); // the domain checks keys, groups and references

        // Every active garment needs a price, or the calculator couldn't price "my own design".
        var prices = (await TailoringData.PricesAsync(db, ct)).Content;
        var unpriced = content.Garments.Where(g => g.IsActive)
            .FirstOrDefault(g => prices.GarmentBasePrices.All(p => p.Garment != g.Key));
        if (unpriced is not null)
            throw new DomainException(ErrorCodes.Validation, $"Set a base price for '{unpriced.NameEn}' in the price rules first.");

        await db.SaveChangesAsync(ct);
        return catalog.Content;
    }
}

// ===================== #45 / #46 price rules =====================

public sealed class GetPriceRulesHandler(IAppDbContext db)
{
    public async Task<PriceRulesContent> HandleAsync(CancellationToken ct) => (await TailoringData.PricesAsync(db, ct)).Content;
}

public sealed class PriceRulesValidator : AbstractValidator<PriceRulesContent>
{
    public PriceRulesValidator()
    {
        RuleFor(p => p.GarmentBasePrices).NotNull().Must(x => x.Count <= 50);
        RuleFor(p => p.StyleBasePrices).NotNull().Must(x => x.Count <= 300);
        RuleFor(p => p.Fabrics).NotNull().Must(x => x.Count <= 100);
        RuleFor(p => p.SizeExtras).NotNull().Must(x => x.Count <= 10);
        RuleFor(p => p.Extras).NotNull().Must(x => x.Count <= 50);
        RuleFor(p => p.LiningPrice).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
        RuleForEach(p => p.Extras).ChildRules(e =>
        {
            e.RuleFor(x => x.Key).NotEmpty().MaximumLength(50);
            e.RuleFor(x => x.NameAr).NotEmpty().MaximumLength(100);
            e.RuleFor(x => x.NameEn).NotEmpty().MaximumLength(100);
        });
    }
}

public sealed class UpdatePriceRulesHandler(IAppDbContext db)
{
    public async Task<PriceRulesContent> HandleAsync(PriceRulesContent content, CancellationToken ct)
    {
        var rules = await db.PriceRules.FirstOrDefaultAsync(ct);
        if (rules is null) db.PriceRules.Add(rules = new PriceRules(content));
        else rules.Replace(content); // the domain checks amounts, sizes and duplicates
        await db.SaveChangesAsync(ct);
        return rules.Content;
    }
}

// ===================== #13 POST /api/tailoring/estimate =====================

public sealed record EstimateCommand(string? StyleId, string Garment, string Fabric, string Fit, bool Lining,
    SizingMode SizingMode, string? StandardSize, string[]? Extras);

public sealed class EstimateValidator : AbstractValidator<EstimateCommand>
{
    public EstimateValidator()
    {
        RuleFor(c => c.StyleId).MaximumLength(50);
        RuleFor(c => c.Garment).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Fabric).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Fit).NotEmpty().MaximumLength(50);
        RuleFor(c => c.SizingMode).IsInEnum();
        RuleFor(c => c.StandardSize).NotEmpty().When(c => c.SizingMode == SizingMode.StandardSize);
        RuleFor(c => c.Extras).Must(e => e!.Length <= 20).When(c => c.Extras is not null);
    }
}

public sealed record EstimateResult(decimal BasePrice, IReadOnlyList<PriceLine> Items, decimal EstimatedPrice, string Currency, string NoteAr, string NoteEn);

// The live price while the customer fills in the form. The same calculation runs again when the request is sent,
// so the customer can never see one price and be charged another.
public sealed class EstimateHandler(IAppDbContext db)
{
    public async Task<EstimateResult> HandleAsync(EstimateCommand c, CancellationToken ct)
    {
        var catalog = await TailoringData.CatalogAsync(db, ct);
        // Style, garment, fabric and fit must exist. Measurements aren't needed to show a price.
        catalog.EnsureValidRequest(c.StyleId, c.Garment, c.Fabric, c.Fit, SizingMode.StandardSize, measurements: null);
        var estimate = (await TailoringData.PricesAsync(db, ct))
            .Estimate(c.StyleId, c.Garment, c.Fabric, c.Lining, c.SizingMode, c.StandardSize, c.Extras);

        return new EstimateResult(estimate.BasePrice, estimate.Items, estimate.Total, "EGP",
            "السعر النهائي يؤكده المحل.", "The final price is confirmed by the shop.");
    }
}

internal static class TailoringData
{
    public static async Task<TailoringCatalog> CatalogAsync(IAppDbContext db, CancellationToken ct) =>
        await db.TailoringCatalog.AsNoTracking().FirstOrDefaultAsync(ct)
        ?? throw new DomainException(ErrorCodes.Validation, "The tailoring catalog isn't set up yet.");

    public static async Task<PriceRules> PricesAsync(IAppDbContext db, CancellationToken ct) =>
        await db.PriceRules.AsNoTracking().FirstOrDefaultAsync(ct)
        ?? throw new DomainException(ErrorCodes.Validation, "The tailoring prices aren't set up yet.");
}
