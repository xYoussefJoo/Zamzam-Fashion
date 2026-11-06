using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Exceptions;
using static Zamzam.Tests.TestData;

namespace Zamzam.Tests.Domain;

public class ProductVariantTests
{
    [Fact]
    public void Reserve_takes_from_stock()
    {
        var variant = Product().AddVariant("M", colorId: 3, sku: "zf-1-m-beige", stock: 3);

        variant.Reserve(2);

        Assert.Equal(1, variant.Stock);
        Assert.Equal("ZF-1-M-BEIGE", variant.Sku);
    }

    [Fact]
    public void Reserving_more_than_the_stock_throws_out_of_stock_and_changes_nothing()
    {
        var variant = Product().AddVariant("M", 3, "sku-1", stock: 1);

        var error = Assert.Throws<DomainException>(() => variant.Reserve(2));

        Assert.Equal(ErrorCodes.OutOfStock, error.Code);
        Assert.Equal(1, variant.Stock);
    }

    [Fact]
    public void Restock_gives_back()
    {
        var variant = Product().AddVariant("M", 3, "sku-1", stock: 0);

        variant.Restock(2);

        Assert.Equal(2, variant.Stock);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Quantity_must_be_positive(int quantity)
    {
        var variant = Product().AddVariant("M", 3, "sku-1", stock: 5);

        Assert.Throws<DomainException>(() => variant.Reserve(quantity));
        Assert.Throws<DomainException>(() => variant.Restock(quantity));
    }

    [Fact]
    public void Price_override_wins_over_the_base_price()
    {
        var product = Product(basePrice: 1250m);

        Assert.Equal(1250m, product.AddVariant("M", 3, "s1", 1).PriceFrom(product.BasePrice));
        Assert.Equal(1300m, product.AddVariant("XL", 3, "s2", 1, priceOverride: 1300m).PriceFrom(product.BasePrice));
    }
}

public class ProductTests
{
    [Fact]
    public void Same_size_and_color_twice_is_a_duplicate_even_with_different_spacing_or_case()
    {
        var product = Product();
        product.AddVariant("M", 3, "s1", 1);

        var error = Assert.Throws<DomainException>(() => product.AddVariant(" m ", 3, "s2", 1));

        Assert.Equal(ErrorCodes.Duplicate, error.Code);
    }

    [Fact]
    public void Same_size_in_another_color_is_fine()
    {
        var product = Product();
        product.AddVariant("M", 3, "s1", 1);
        product.AddVariant("M", 4, "s2", 1);

        Assert.Equal(2, product.Variants.Count);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(10.555)]
    public void Base_price_must_be_positive_with_two_decimals(decimal price)
    {
        Assert.Throws<DomainException>(() => Product(price));
    }

    [Fact]
    public void Slug_is_built_from_the_english_name()
    {
        Assert.Equal("modest-abaya", Product().Slug);
    }

    [Fact]
    public void At_most_10_photos_and_the_first_is_the_main_one()
    {
        var product = Product();
        for (var i = 0; i < Zamzam.Domain.Entities.Product.MaxImages; i++) product.AddImage($"https://cdn.example/{i}.webp", null, null);

        Assert.Throws<DomainException>(() => product.AddImage("https://cdn.example/11.webp", null, null));
        Assert.Equal(0, product.MainImage!.SortOrder);
    }

    [Fact]
    public void Soft_delete_hides_the_product_and_its_variants()
    {
        var product = Product();
        product.AddVariant("M", 3, "s1", 1);

        product.SoftDelete();

        Assert.True(product.IsDeleted);
        Assert.False(product.IsVisible);
        Assert.Empty(product.ActiveVariants);
        Assert.Throws<DomainException>(() => product.AddVariant("L", 3, "s2", 1));
    }
}

public class CategoryTests
{
    [Fact]
    public void A_category_cannot_be_its_own_parent()
    {
        var dresses = new Category("فساتين", "Dresses", null, parent: null);

        Assert.Throws<DomainException>(() => dresses.MoveTo(dresses));
    }

    [Fact]
    public void Only_two_levels_are_allowed()
    {
        var dresses = new Category("فساتين", "Dresses", null, parent: null);
        var abayas = new Category("عبايات", "Abayas", null, parent: dresses);

        Assert.Throws<DomainException>(() => new Category("طويلة", "Long Abayas", null, parent: abayas));
    }

    [Fact]
    public void Slug_can_be_given_but_must_be_clean()
    {
        Assert.Equal("summer-dresses", new Category("ف", "Dresses", "summer-dresses", null).Slug);
        Assert.Throws<DomainException>(() => new Category("ف", "Dresses", "Summer Dresses!", null));
    }
}

public class SlugAndColorTests
{
    [Theory]
    [InlineData("Modest Abaya", "modest-abaya")]
    [InlineData("  Wide--Leg  Pants 2026! ", "wide-leg-pants-2026")]
    public void Slug_from_text(string text, string expected) => Assert.Equal(expected, Slug.From(text));

    [Fact]
    public void Arabic_only_text_has_no_slug() => Assert.Throws<DomainException>(() => Slug.From("عباية"));

    [Fact]
    public void Hex_is_checked_and_stored_lowercase()
    {
        Assert.Equal("#d6b995", new Color("بيج", "Beige", "#D6B995").Hex);
        Assert.Throws<DomainException>(() => new Color("بيج", "Beige", "beige"));
    }
}
