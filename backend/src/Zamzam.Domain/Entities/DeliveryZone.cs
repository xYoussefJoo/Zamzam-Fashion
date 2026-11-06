using System.Text.RegularExpressions;
using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Entities;

// One governorate. The 27 rows are seeded; the owner only changes fee, delivery time and active.
public partial class DeliveryZone : Entity
{
    public const int MaxEtaDays = 30;

    public string Key { get; private set; } = null!;   // "cairo", "giza", ...
    public string NameAr { get; private set; } = null!;
    public string NameEn { get; private set; } = null!;
    public decimal Fee { get; private set; }
    public int EtaDaysMin { get; private set; }
    public int EtaDaysMax { get; private set; }
    public bool IsActive { get; private set; }

    private DeliveryZone() { } // EF Core

    public DeliveryZone(string key, string nameAr, string nameEn, decimal fee, int etaDaysMin, int etaDaysMax, bool isActive = true)
    {
        var cleanKey = Guard.Required(key, "Key", 40).ToLowerInvariant();
        if (!KeyFormat().IsMatch(cleanKey))
            throw new DomainException(ErrorCodes.Validation, "Key may only contain lowercase letters, digits and dashes.");

        Key = cleanKey;
        NameAr = Guard.Required(nameAr, "Arabic name", 60);
        NameEn = Guard.Required(nameEn, "English name", 60);
        UpdateDelivery(fee, etaDaysMin, etaDaysMax, isActive);
    }

    public void UpdateDelivery(decimal fee, int etaDaysMin, int etaDaysMax, bool isActive)
    {
        Fee = Guard.Money(fee, "Delivery fee", allowZero: true);
        if (etaDaysMin < 0 || etaDaysMax < etaDaysMin || etaDaysMax > MaxEtaDays)
            throw new DomainException(ErrorCodes.Validation, $"Delivery days must be 0–{MaxEtaDays}, with min ≤ max.");
        EtaDaysMin = etaDaysMin;
        EtaDaysMax = etaDaysMax;
        IsActive = isActive;
    }

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex KeyFormat();
}
