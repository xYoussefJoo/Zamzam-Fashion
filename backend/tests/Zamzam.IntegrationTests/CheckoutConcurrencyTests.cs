using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Domain.Constants;

namespace Zamzam.IntegrationTests;

[Collection(PostgresCollection.Name)]
public sealed class CheckoutConcurrencyTests(PostgresFixture pg)
{
    // Every buyer runs in its own DbContext (its own connection), started at the same moment.
    private async Task<List<object>> BuyAtTheSameTime(int buyers, int variantId, int zoneId)
    {
        using var start = new ManualResetEventSlim(false);
        var tasks = Enumerable.Range(0, buyers).Select(_ => Task.Run(async () =>
        {
            await using var db = pg.NewContext();
            start.Wait();
            try { return (object)await PostgresFixture.Checkout(db).HandleAsync(PostgresFixture.Command(zoneId, variantId, 1050), CancellationToken.None); }
            catch (Exception ex) { return ex; }
        })).ToList();

        await Task.Delay(200); // let every task reach the starting line
        start.Set();
        return [.. await Task.WhenAll(tasks)];
    }

    private async Task<(int Stock, int Sold)> StockAndSold(int variantId)
    {
        await using var db = pg.NewContext();
        var stock = await db.ProductVariants.Where(v => v.Id == variantId).Select(v => v.Stock).SingleAsync();
        var sold = await db.OrderLines.Where(l => l.VariantId == variantId).SumAsync(l => l.Quantity);
        return (stock, sold);
    }

    [DockerFact]
    public async Task Two_buyers_for_the_last_piece_only_one_wins()
    {
        var (variantId, zoneId) = await pg.SeedAsync(stock: 1);

        var results = await BuyAtTheSameTime(2, variantId, zoneId);

        Assert.Single(results.OfType<PlacedOrderDto>());
        var loser = Assert.IsType<ConflictException>(Assert.Single(results.OfType<Exception>()));
        Assert.Equal(ErrorCodes.OutOfStock, loser.Code);
        Assert.Equal((0, 1), await StockAndSold(variantId));
    }

    [DockerFact]
    public async Task Ten_buyers_for_three_pieces_never_oversell()
    {
        var (variantId, zoneId) = await pg.SeedAsync(stock: 3);

        var results = await BuyAtTheSameTime(10, variantId, zoneId);

        var winners = results.OfType<PlacedOrderDto>().Count();
        var (stock, sold) = await StockAndSold(variantId);
        Assert.True(stock >= 0, "stock went negative");
        Assert.Equal(3, stock + sold);          // every piece is either on the shelf or in exactly one order
        Assert.Equal(winners, sold);
        Assert.All(results.OfType<Exception>(), ex => Assert.True(
            ex is ConflictException { Code: ErrorCodes.OutOfStock } or DbUpdateConcurrencyException,
            $"unexpected {ex.GetType().Name}: {ex.Message}"));
    }

    [DockerFact]
    public async Task Order_numbers_come_from_the_database_sequence()
    {
        var (variantId, zoneId) = await pg.SeedAsync(stock: 5);

        await using var db1 = pg.NewContext();
        var first = await PostgresFixture.Checkout(db1).HandleAsync(PostgresFixture.Command(zoneId, variantId, 1050), CancellationToken.None);
        await using var db2 = pg.NewContext();
        var second = await PostgresFixture.Checkout(db2).HandleAsync(PostgresFixture.Command(zoneId, variantId, 1050), CancellationToken.None);

        Assert.StartsWith("ZF-1", first.Number);
        Assert.Equal(long.Parse(first.Number[3..]) + 1, long.Parse(second.Number[3..]));
    }

    [DockerFact]
    public async Task The_real_schema_lives_in_zamzam_not_public()
    {
        await using var db = pg.NewContext();
        var tables = await db.Database
            .SqlQueryRaw<string>("SELECT table_schema AS \"Value\" FROM information_schema.tables WHERE table_name = 'Orders'")
            .ToListAsync();

        Assert.Equal(["zamzam"], tables);
    }
}
