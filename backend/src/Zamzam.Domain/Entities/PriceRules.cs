using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.Settings;

namespace Zamzam.Domain.Entities;

// Single row. The owner's prices, and the calculator that turns them into an estimate.
public class PriceRules : Entity
{
    public PriceRulesContent Content { get; private set; } = null!;

    private PriceRules() { } // EF Core

    public PriceRules(PriceRulesContent content) => Replace(content);

    public void Replace(PriceRulesContent content)
    {
        if (content is null) throw new DomainException(ErrorCodes.Validation, "Price rules are required.");

        foreach (var g in content.GarmentBasePrices) Guard.Money(g.BasePrice, $"Base price for {g.Garment}");
        foreach (var s in content.StyleBasePrices) Guard.Money(s.BasePrice, $"Base price for {s.StyleId}");
        foreach (var f in content.Fabrics) Guard.Money(f.Extra, $"Extra for {f.Fabric}", allowZero: true);
        Guard.Money(content.LiningPrice, "Lining price", allowZero: true);
        foreach (var e in content.Extras) Guard.Money(e.Price, $"Price for {e.Key}", allowZero: true);
        foreach (var s in content.SizeExtras)
        {
            if (!StandardSizes.IsValid(s.FromSize))
                throw new DomainException(ErrorCodes.Validation, $"'{s.FromSize}' isn't a standard size.");
            Guard.Money(s.Extra, $"Extra from size {s.FromSize}", allowZero: true);
        }

        RequireUnique(content.GarmentBasePrices.Select(g => g.Garment), "garment");
        RequireUnique(content.StyleBasePrices.Select(s => s.StyleId), "style");
        RequireUnique(content.Fabrics.Select(f => f.Fabric), "fabric");
        RequireUnique(content.SizeExtras.Select(s => s.FromSize), "size");
        RequireUnique(content.Extras.Select(e => e.Key), "extra");

        Content = content;
    }

    // Base price (style, or garment for "my own design") + fabric + lining + larger size + extras.
    public PriceEstimate Estimate(string? styleId, string garment, string fabric, bool lining,
        SizingMode sizingMode, string? standardSize, IEnumerable<string>? extras)
    {
        var basePrice = (styleId is null ? null : Content.StyleBasePrices.FirstOrDefault(s => s.StyleId == styleId)?.BasePrice)
            ?? Content.GarmentBasePrices.FirstOrDefault(g => g.Garment == garment)?.BasePrice
            ?? throw new DomainException(ErrorCodes.Validation, "There's no price for this garment yet. Please contact the shop.");

        var items = new List<PriceLine>();

        var fabricExtra = Content.Fabrics.FirstOrDefault(f => f.Fabric == fabric)?.Extra ?? 0;
        if (fabricExtra > 0) items.Add(new PriceLine("fabric", "القماش", "Fabric", fabricExtra));

        if (lining && Content.LiningPrice > 0) items.Add(new PriceLine("lining", "البطانة", "Lining", Content.LiningPrice));

        if (sizingMode == SizingMode.StandardSize && standardSize is not null)
        {
            var sizeIndex = IndexOf(standardSize);
            var sizeExtra = Content.SizeExtras
                .Where(s => IndexOf(s.FromSize) <= sizeIndex)
                .OrderByDescending(s => IndexOf(s.FromSize))
                .FirstOrDefault();
            if (sizeExtra is { Extra: > 0 })
                items.Add(new PriceLine("size", "مقاس كبير", $"Size {standardSize}", sizeExtra.Extra));
        }

        foreach (var key in (extras ?? []).Distinct())
        {
            var extra = Content.Extras.FirstOrDefault(e => e.Key == key)
                ?? throw new DomainException(ErrorCodes.Validation, $"'{key}' isn't an available extra.");
            items.Add(new PriceLine(extra.Key, extra.NameAr, extra.NameEn, extra.Price));
        }

        return new PriceEstimate(basePrice, items, basePrice + items.Sum(i => i.Amount));
    }

    // FreeSize sits last in the list but isn't "larger", so it never gets a size extra.
    private static int IndexOf(string size) =>
        size == "FreeSize" ? -1 : StandardSizes.All.ToList().IndexOf(size);

    private static void RequireUnique(IEnumerable<string> keys, string what)
    {
        var duplicate = keys.GroupBy(k => k).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            throw new DomainException(ErrorCodes.Validation, $"Duplicate {what} '{duplicate.Key}' in price rules.");
    }
}
