using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Entities;

// One size × color of a product, with its own stock. Created only through Product.AddVariant.
public class ProductVariant : Entity
{
    public int ProductId { get; private set; }
    public int ColorId { get; private set; }
    public Color? Color { get; private set; }

    public string Size { get; private set; } = null!;   // a standard size or a custom label
    public string Sku { get; private set; } = null!;
    public int Stock { get; private set; }
    public decimal? PriceOverride { get; private set; }  // null = use the product's base price
    public bool IsDeleted { get; private set; }

    // PostgreSQL xmin: stops two buyers from taking the last piece at the same time.
    public uint Version { get; private set; }

    private ProductVariant() { } // EF Core

    internal ProductVariant(string size, int colorId, string sku, int stock, decimal? priceOverride)
    {
        Sku = Guard.Required(sku, "SKU", 64).ToUpperInvariant();
        Change(size, colorId, stock, priceOverride);
    }

    internal void Change(string size, int colorId, int stock, decimal? priceOverride)
    {
        Size = Guard.Required(size, "Size", 20);
        ColorId = Guard.Positive(colorId, "Color");
        Stock = Guard.NotNegative(stock, "Stock");
        PriceOverride = priceOverride is null ? null : Guard.Money(priceOverride.Value, "Price override");
    }

    public decimal PriceFrom(decimal basePrice) => PriceOverride ?? basePrice;

    public bool Matches(string size, int colorId) =>
        ColorId == colorId && string.Equals(Size, size.Trim(), StringComparison.OrdinalIgnoreCase);

    // Called at checkout. Throws OUT_OF_STOCK instead of letting stock go below zero.
    public void Reserve(int quantity)
    {
        Guard.Positive(quantity, "Quantity");
        if (IsDeleted || Stock < quantity)
            throw new DomainException(ErrorCodes.OutOfStock, $"Only {(IsDeleted ? 0 : Stock)} left for {Sku}.");
        Stock -= quantity;
    }

    // Called when an order is cancelled.
    public void Restock(int quantity) => Stock += Guard.Positive(quantity, "Quantity");

    // A manual change from the Warehouse (+received, -damaged, ±correction). Stock never goes below 0.
    public void Adjust(int change)
    {
        if (change == 0) throw new DomainException(ErrorCodes.Validation, "The change can't be 0.");
        if (Stock + change < 0)
            throw new DomainException(ErrorCodes.NegativeStock, $"Only {Stock} in stock for {Sku}; it can't go below 0.");
        Stock += change;
    }

    internal void SoftDelete() => IsDeleted = true;
}
