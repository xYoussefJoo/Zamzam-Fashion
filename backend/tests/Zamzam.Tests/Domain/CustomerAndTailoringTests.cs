using Zamzam.Domain.Common;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.Settings;
using Zamzam.Domain.ValueObjects;
using static Zamzam.Tests.TestData;

namespace Zamzam.Tests.Domain;

public class CustomerInfoTests
{
    [Theory]
    [InlineData("01012345678")]
    [InlineData("+201012345678")]
    [InlineData("00201012345678")]
    [InlineData("010 1234-5678")]
    public void Phone_is_stored_in_one_format(string input) =>
        Assert.Equal("+201012345678", EgyptianPhone.Normalize(input));

    [Theory]
    [InlineData("0131234567")]   // wrong operator
    [InlineData("0101234567")]   // too short
    [InlineData("12345")]
    public void Invalid_phone_is_refused(string input) =>
        Assert.Throws<DomainException>(() => EgyptianPhone.Normalize(input));

    [Fact]
    public void Email_is_optional_and_lowercased()
    {
        Assert.Null(Customer(email: null).Email);
        Assert.Null(Customer(email: "  ").Email);
        Assert.Equal("mona@example.com", Customer(email: "Mona@Example.com").Email);
    }

    [Fact]
    public void Invalid_email_is_refused() =>
        Assert.Throws<DomainException>(() => Customer(email: "not-an-email"));

    [Fact]
    public void Address_must_be_detailed() =>
        Assert.Throws<DomainException>(() => new CustomerInfo("Mona Ahmed", "01012345678", null, "Cairo", "Cairo", null));
}

public class TailoringSpecTests
{
    private static TailoringSpec Measured(Dictionary<string, decimal> measurements) =>
        new(null, "pants", "linen", "Beige", "Relaxed", SizingMode.Measurements, null, measurements, false, null, null, 900m);

    [Fact]
    public void Measurements_are_kept()
    {
        var spec = Measured(new() { ["waist"] = 72, ["inseam"] = 76.5m });

        Assert.Equal(76.5m, spec.Measurements["inseam"]);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(301)]
    [InlineData(72.25)]
    public void Each_measurement_is_1_to_300_cm_with_one_decimal(decimal value) =>
        Assert.Throws<DomainException>(() => Measured(new() { ["waist"] = value }));

    [Fact]
    public void Measurement_mode_needs_at_least_one_value() =>
        Assert.Throws<DomainException>(() => Measured([]));

    [Fact]
    public void Standard_size_takes_no_measurements()
    {
        Assert.Throws<DomainException>(() => new TailoringSpec(null, "pants", "linen", "Beige", "Relaxed",
            SizingMode.StandardSize, "XL", new Dictionary<string, decimal> { ["waist"] = 70 }, false, null, null, 900m));
        Assert.Throws<DomainException>(() => new TailoringSpec(null, "pants", "linen", "Beige", "Relaxed",
            SizingMode.StandardSize, "HUGE", null, false, null, null, 900m));
    }
}

public class PriceRulesTests
{
    private static PriceRules Rules() => new(new PriceRulesContent(
        GarmentBasePrices: [new("dress", 1200m)],
        StyleBasePrices: [new("abaya", 1400m)],
        Fabrics: [new("crepe", 250m)],
        LiningPrice: 150m,
        SizeExtras: [new("XL", 100m), new("XXL", 200m)],
        Extras: [new("embroidery", "تطريز", "Embroidery", 300m)]));

    [Fact]
    public void Estimate_adds_every_extra_line_by_line()
    {
        var estimate = Rules().Estimate("abaya", "dress", "crepe", lining: true, SizingMode.StandardSize, "XL", ["embroidery"]);

        Assert.Equal(1400m, estimate.BasePrice);
        Assert.Equal(["fabric", "lining", "size", "embroidery"], estimate.Items.Select(i => i.Key));
        Assert.Equal(2200m, estimate.Total);
    }

    [Fact]
    public void Own_design_uses_the_garment_price_and_the_largest_matching_size_extra() =>
        Assert.Equal(1400m, Rules().Estimate(null, "dress", "linen", false, SizingMode.StandardSize, "3XL", null).Total);

    [Theory]
    [InlineData("M")]
    [InlineData("FreeSize")]
    public void Smaller_sizes_and_free_size_add_nothing(string size) =>
        Assert.Equal(1200m, Rules().Estimate(null, "dress", "linen", false, SizingMode.StandardSize, size, null).Total);

    [Fact]
    public void Unknown_garment_or_extra_is_refused()
    {
        Assert.Throws<DomainException>(() => Rules().Estimate(null, "pants", "linen", false, SizingMode.Measurements, null, null));
        Assert.Throws<DomainException>(() => Rules().Estimate("abaya", "dress", "crepe", false, SizingMode.Measurements, null, ["gold"]));
    }
}

public class TailoringCatalogTests
{
    private static TailoringCatalog Catalog() => new(new TailoringCatalogContent(
        Garments: [new("pants", "بناطيل", "Trousers", ["common", "pants"])],
        Styles: [new("wide_pants", "pants", "وايد ليج", "Wide-leg", "linen", "Relaxed")],
        Fabrics: [new("linen", "كتان", "Linen")],
        Fits: [new("Relaxed", "واسع", "Relaxed")],
        MeasurementGroups: new Dictionary<string, IReadOnlyList<MeasurementField>>
        {
            ["common"] = [new("waist", "الوسط", "Waist", Required: true)],
            ["pants"] = [new("inseam", "الرجل", "Inseam")],
        }));

    [Fact]
    public void Valid_request_passes() =>
        Catalog().EnsureValidRequest("wide_pants", "pants", "linen", "Relaxed", SizingMode.Measurements,
            new Dictionary<string, decimal> { ["waist"] = 70, ["inseam"] = 76 });

    [Fact]
    public void Unknown_or_missing_required_measurement_is_refused()
    {
        Assert.Throws<DomainException>(() => Catalog().EnsureValidRequest(null, "pants", "linen", "Relaxed",
            SizingMode.Measurements, new Dictionary<string, decimal> { ["waist"] = 70, ["bust"] = 90 }));
        Assert.Throws<DomainException>(() => Catalog().EnsureValidRequest(null, "pants", "linen", "Relaxed",
            SizingMode.Measurements, new Dictionary<string, decimal> { ["inseam"] = 76 }));
    }

    [Fact]
    public void A_garment_pointing_to_a_missing_group_is_refused() =>
        Assert.Throws<DomainException>(() => new TailoringCatalog(new TailoringCatalogContent(
            [new("pants", "بناطيل", "Trousers", ["nope"])], [], [], [],
            new Dictionary<string, IReadOnlyList<MeasurementField>>())));
}
