using Microsoft.EntityFrameworkCore;
using Zamzam.Domain.Entities;
using Zamzam.Infrastructure.Identity;
using Zamzam.Infrastructure.Persistence;
using Zamzam.Infrastructure.Persistence.Seed;

namespace Zamzam.Tests.Infrastructure;

public class SeedDataTests
{
    [Fact]
    public void There_are_27_governorates_with_unique_keys()
    {
        var zones = SeedData.DeliveryZones().ToList();

        Assert.Equal(27, zones.Count);
        Assert.Equal(27, zones.Select(z => z.Key).Distinct().Count());
    }

    [Fact]
    public void Seeded_tailoring_catalog_is_valid_and_every_style_has_a_price()
    {
        var catalog = new TailoringCatalog(SeedData.TailoringCatalog()); // throws if anything is inconsistent
        var prices = new PriceRules(SeedData.PriceRules());

        Assert.Equal(6, catalog.Content.Garments.Count);
        Assert.Equal(12, catalog.Content.Styles.Count);
        foreach (var style in catalog.Content.Styles)
            Assert.True(prices.Estimate(style.Id, style.Garment, style.DefaultFabric, false,
                Zamzam.Domain.Enums.SizingMode.StandardSize, "M", null).Total > 0);
    }

    [Fact]
    public void Ten_valid_colors() => Assert.Equal(10, SeedData.Colors().Count());
}

public class DatabaseModelTests
{
    // Builds the real EF model and the SQL it would create, without needing a database.
    private static string CreateScript()
    {
        var options = new DbContextOptionsBuilder<ZamzamDbContext>().UseNpgsql("Host=localhost;Database=model-only").Options;
        using var db = new ZamzamDbContext(options, TimeProvider.System);
        return db.Database.GenerateCreateScript();
    }

    [Fact]
    public void Schema_has_the_expected_shape()
    {
        var sql = CreateScript();

        Assert.Contains("CREATE SEQUENCE \"OrderNumbers\" START WITH 10001", sql);        // order numbers
        Assert.Contains("\"CustomerName\" character varying(100) NOT NULL", sql);        // value object columns
        Assert.Contains("\"Measurements\" jsonb", sql);                                  // jsonb documents
        Assert.Contains("\"Content\" jsonb", sql);
        Assert.Contains("\"Status\" character varying(30) NOT NULL", sql);               // enums as text
        Assert.Contains("numeric(18,2)", sql);                                           // money
        Assert.Contains("WHERE \"IsDeleted\" = false", sql);                             // one active size+color
        Assert.Contains("CREATE TABLE \"AspNetUsers\"", sql);                            // Identity
        Assert.Contains("CREATE TABLE \"DataProtectionKeys\"", sql);
        Assert.DoesNotContain("\"Version\"", sql);                                       // xmin is a system column
    }

    [Fact]
    public void A_variant_that_was_ordered_cannot_be_hard_deleted()
    {
        Assert.Contains("REFERENCES \"ProductVariants\" (\"Id\") ON DELETE RESTRICT", CreateScript());
    }
}

public class CommonPasswordValidatorTests
{
    private static async Task<bool> IsAccepted(string password, string email = "owner@zamzam.com") =>
        (await new CommonPasswordValidator().ValidateAsync(null!, new AppUser { Email = email }, password)).Succeeded;

    [Theory]
    [InlineData("1234567890")]
    [InlineData("Password123")]
    [InlineData("zamzam2026!")]
    [InlineData("owner-secret-1")] // contains the email name
    public async Task Easy_passwords_are_refused(string password) => Assert.False(await IsAccepted(password));

    [Fact]
    public async Task A_long_unusual_password_is_accepted() => Assert.True(await IsAccepted("blue tailor cactus 77"));
}
