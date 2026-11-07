using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Entities;

// The tailoring sheet of a custom order: what to sew, the sizes, and the agreed price.
// Whether the garment, fabric and measurement keys exist is checked against TailoringCatalog.
public class TailoringSpec : Entity
{
    public const decimal MinCm = 1;
    public const decimal MaxCm = 300;
    public const int MaxMeasurements = 60;

    public int OrderId { get; private set; }
    public string? StyleId { get; private set; }            // null = the customer's own design
    public string Garment { get; private set; } = null!;
    public string Fabric { get; private set; } = null!;
    public string Color { get; private set; } = null!;
    public string Fit { get; private set; } = null!;
    public SizingMode SizingMode { get; private set; }
    public string? StandardSize { get; private set; }
    public IReadOnlyDictionary<string, decimal> Measurements { get; private set; } = new Dictionary<string, decimal>();
    public bool HasLining { get; private set; }
    public IReadOnlyList<string> Extras { get; private set; } = [];
    public string? ReferenceImageKey { get; private set; }  // private bucket key, never a public URL
    public string? Notes { get; private set; }              // the customer's wishes: pockets, sleeve type…

    public decimal EstimatedPrice { get; private set; }     // what the calculator showed the customer
    public decimal? QuotedPrice { get; private set; }       // what the owner confirmed or changed
    public string? QuoteNote { get; private set; }
    public DateTime? QuoteValidUntil { get; private set; }
    public DateTime? QuoteApprovedAt { get; private set; }

    private TailoringSpec() { } // EF Core

    public TailoringSpec(string? styleId, string garment, string fabric, string color, string fit,
        SizingMode sizingMode, string? standardSize, IReadOnlyDictionary<string, decimal>? measurements,
        bool hasLining, IEnumerable<string>? extras, string? referenceImageKey, decimal estimatedPrice, string? notes = null)
    {
        Notes = Guard.Optional(notes, "Tailoring notes", 1000);
        StyleId = Guard.Optional(styleId, "Style", 50);
        Garment = Guard.Required(garment, "Garment", 50);
        Fabric = Guard.Required(fabric, "Fabric", 50);
        Color = Guard.Required(color, "Color", 50);
        Fit = Guard.Required(fit, "Fit", 50);
        SizingMode = sizingMode;
        HasLining = hasLining;
        Extras = (extras ?? []).Select(e => Guard.Required(e, "Extra", 50)).Distinct().ToList();
        ReferenceImageKey = Guard.Optional(referenceImageKey, "Reference image", 300);
        EstimatedPrice = Guard.Money(estimatedPrice, "Estimated price");

        if (sizingMode == SizingMode.StandardSize)
        {
            if (standardSize is null || !StandardSizes.IsValid(standardSize))
                throw new DomainException(ErrorCodes.Validation, "Choose one of the standard sizes.");
            if (measurements is { Count: > 0 })
                throw new DomainException(ErrorCodes.Validation, "Standard size orders don't take body measurements.");
            StandardSize = standardSize;
        }
        else
        {
            Measurements = CleanMeasurements(measurements);
        }
    }

    internal void SetQuote(decimal price, string? note, DateTime validUntil)
    {
        QuotedPrice = price;
        QuoteNote = Guard.Optional(note, "Quote note", 500);
        QuoteValidUntil = validUntil;
        QuoteApprovedAt = null;
    }

    internal void MarkApproved(DateTime at) => QuoteApprovedAt = at;

    private static Dictionary<string, decimal> CleanMeasurements(IReadOnlyDictionary<string, decimal>? input)
    {
        if (input is null || input.Count == 0)
            throw new DomainException(ErrorCodes.Validation, "Enter at least one measurement, or choose a standard size.");
        if (input.Count > MaxMeasurements)
            throw new DomainException(ErrorCodes.Validation, $"At most {MaxMeasurements} measurements.");

        var clean = new Dictionary<string, decimal>();
        foreach (var (key, value) in input)
        {
            var name = Guard.Required(key, "Measurement name", 50);
            if (value is < MinCm or > MaxCm || decimal.Round(value, 1) != value)
                throw new DomainException(ErrorCodes.Validation, $"{name} must be between {MinCm} and {MaxCm} cm (one decimal at most).");
            clean[name] = value;
        }
        return clean;
    }
}
