using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Catalog;
using Zamzam.Application.Common;
using Zamzam.Domain.Enums;

namespace Zamzam.Application.Orders;

public sealed record LowStockItem(int VariantId, string Sku, string ProductNameAr, string ProductNameEn, string Size, int Stock);

public sealed record DashboardDto(
    int OrdersToday,
    int PendingConfirmation,   // new ready-made orders: call the customer and confirm
    int AwaitingQuote,         // new custom orders: confirm or change the price
    int WaitingForCustomer,    // price sent, waiting for the customer's answer
    int InProduction,          // sewing or quality check
    int ReadyToShip,           // packed
    decimal DeliveredRevenueLast30Days,
    IReadOnlyList<LowStockItem> LowStock,
    IReadOnlyList<AdminOrderRow> LatestOrders);

// #47 GET /api/admin/dashboard — the owner's home screen: what needs attention right now.
public sealed class GetDashboardHandler(IAppDbContext db, ListAdminOrdersHandler orders, TimeProvider clock)
{
    private static readonly TimeZoneInfo Cairo = FindCairo();

    public async Task<DashboardDto> HandleAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        // "Today" means today in Egypt, not in UTC.
        var cairoNow = TimeZoneInfo.ConvertTime(now, Cairo);
        var startOfToday = new DateTimeOffset(cairoNow.Date, cairoNow.Offset).UtcDateTime;
        var since = now.UtcDateTime.AddDays(-30);

        var counts = await db.Orders.AsNoTracking()
            .GroupBy(o => o.Status).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        int Count(params OrderStatus[] statuses) => statuses.Sum(s => counts.GetValueOrDefault(s));

        var revenue = await db.Orders.AsNoTracking()
            .Where(o => o.Status == OrderStatus.Delivered
                && o.History.Any(h => h.ToStatus == OrderStatus.Delivered && h.ChangedAt >= since))
            .SumAsync(o => (decimal?)o.Total, ct) ?? 0;

        var lowStock = await (from v in db.ProductVariants.AsNoTracking()
                              join p in db.Products on v.ProductId equals p.Id
                              where !v.IsDeleted && !p.IsDeleted && v.Stock <= CatalogRules.LowStockAtOrBelow
                              orderby v.Stock, p.NameEn
                              select new LowStockItem(v.Id, v.Sku, p.NameAr, p.NameEn, v.Size, v.Stock))
            .Take(20).ToListAsync(ct);

        var latest = await orders.HandleAsync(new AdminOrdersQuery(PageSize: 5), ct);

        return new DashboardDto(
            await db.Orders.CountAsync(o => o.CreatedAt >= startOfToday, ct),
            Count(OrderStatus.PendingConfirmation),
            Count(OrderStatus.AwaitingQuote),
            Count(OrderStatus.QuoteSent),
            Count(OrderStatus.InProduction, OrderStatus.QualityCheck),
            Count(OrderStatus.Packing),
            revenue, lowStock, latest.Items);
    }

    private static TimeZoneInfo FindCairo()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo"); } // Linux + modern Windows (ICU)
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time"); }
    }
}
