using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Catalog.Admin;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Enums;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Tests.Application;

public class StockTests
{
    [Fact]
    public async Task A_manual_change_updates_stock_and_writes_a_movement()
    {
        using var t = TestDb.WithCatalog();
        var variant = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2)).Variants.Single();

        var updated = await new AdjustStockHandler(t.Db).HandleAsync(variant.Id,
            new AdjustStockCommand(10, StockReason.Received, "Supplier", variant.Version), "owner-1", CancellationToken.None);

        Assert.Equal(12, updated.Stock);
        var movement = await t.Db.StockMovements.SingleAsync();
        Assert.Equal((10, StockReason.Received, "Supplier", "owner-1"), (movement.Change, movement.Reason, movement.Note, movement.CreatedBy));
    }

    [Fact]
    public async Task Stock_never_goes_below_zero()
    {
        using var t = TestDb.WithCatalog();
        var variant = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2)).Variants.Single();

        var error = await Assert.ThrowsAsync<DomainException>(() => new AdjustStockHandler(t.Db).HandleAsync(variant.Id,
            new AdjustStockCommand(-3, StockReason.Damaged, null, variant.Version), "owner-1", CancellationToken.None));

        Assert.Equal(ErrorCodes.NegativeStock, error.Code);
        t.Reload();
        Assert.Equal(2, (await t.Db.ProductVariants.SingleAsync()).Stock);
        Assert.False(await t.Db.StockMovements.AnyAsync());
    }

    [Theory]
    [InlineData(5, StockReason.Sold)]       // written by orders only
    [InlineData(-1, StockReason.Received)]  // received adds
    [InlineData(2, StockReason.Damaged)]    // damaged removes
    [InlineData(0, StockReason.Correction)]
    public void Wrong_reason_or_direction_is_refused(int change, StockReason reason) =>
        Assert.False(new AdjustStockCommandValidator().Validate(new AdjustStockCommand(change, reason, null, 1)).IsValid);
}
