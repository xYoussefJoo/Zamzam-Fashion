using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;

namespace Zamzam.Application.Catalog.Admin;

// GET /api/admin/inventory — every size/colour of every product with its stock, for the dashboard's Inventory tab.
// Stock changes go through POST /api/admin/variants/{id}/stock (with a reason and the row's version).
// Every filter combines with AND and runs in the database query.
public sealed record InventoryQuery(string? Q = null, string? Status = null, int? CategoryId = null, int? ColorId = null, string? Size = null,
    int? Page = null, int? PageSize = null);

public sealed record InventoryRow(int VariantId, int ProductId, string ProductNameAr, string ProductNameEn, bool ProductVisible,
    string Sku, string Size, ColorDto Color, int Stock, decimal? PriceOverride, uint Version);

// The totals cover the whole shop (not just this page), so the summary cards stay the same while filtering.
public sealed record InventoryDto(Paged<InventoryRow> Rows, int Variants, int Units, int Low, int SoldOut, int LowStockAtOrBelow,
    IReadOnlyList<string> Sizes);

public static class InventoryStatus
{
    public const string All = "all", Low = "low", SoldOut = "out", InStock = "in";
    public const string LowOrSoldOut = "attention"; // the Warehouse's "low stock only" (low + sold out)
}

public sealed class InventoryQueryValidator : AbstractValidator<InventoryQuery>
{
    public InventoryQueryValidator()
    {
        RuleFor(q => q.Q).MaximumLength(100);
        RuleFor(q => q.Size).MaximumLength(20);
        RuleFor(q => q.ColorId).GreaterThan(0).When(q => q.ColorId is not null);
        RuleFor(q => q.Status).Must(s => s is null or InventoryStatus.All or InventoryStatus.Low or InventoryStatus.SoldOut or InventoryStatus.InStock
                or InventoryStatus.LowOrSoldOut)
            .WithMessage("status must be all, low, out, in or attention.");
    }
}

public sealed class ListInventoryHandler(IAppDbContext db)
{
    public async Task<InventoryDto> HandleAsync(InventoryQuery query, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        const int low = CatalogRules.LowStockAtOrBelow;

        var all = from v in db.ProductVariants.AsNoTracking()
                  join p in db.Products.AsNoTracking() on v.ProductId equals p.Id
                  where !v.IsDeleted && !p.IsDeleted
                  select new { v, p };

        var totals = await all.GroupBy(_ => 1).Select(g => new
        {
            Variants = g.Count(),
            Units = g.Sum(x => x.v.Stock),
            Low = g.Count(x => x.v.Stock > 0 && x.v.Stock <= low),
            SoldOut = g.Count(x => x.v.Stock <= 0),
        }).FirstOrDefaultAsync(ct);

        var rows = all;
        if (query.CategoryId is int categoryId)
            rows = rows.Where(x => x.p.CategoryId == categoryId || x.p.Category!.ParentId == categoryId);
        if (query.ColorId is int colorId)
            rows = rows.Where(x => x.v.ColorId == colorId);
        if (!string.IsNullOrWhiteSpace(query.Size))
        {
            var size = query.Size.Trim();
            rows = rows.Where(x => x.v.Size == size);
        }
        rows = query.Status switch
        {
            InventoryStatus.Low => rows.Where(x => x.v.Stock > 0 && x.v.Stock <= low),
            InventoryStatus.SoldOut => rows.Where(x => x.v.Stock <= 0),
            InventoryStatus.InStock => rows.Where(x => x.v.Stock > low),
            InventoryStatus.LowOrSoldOut => rows.Where(x => x.v.Stock <= low),
            _ => rows,
        };
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var text = query.Q.Trim();
            var lower = text.ToLowerInvariant();
            rows = rows.Where(x => x.p.NameEn.ToLower().Contains(lower) || x.p.NameAr.Contains(text) ||
                x.v.Sku.ToLower().Contains(lower));
        }

        // The sizes actually in use, for the size filter.
        var sizes = await all.Select(x => x.v.Size).Distinct().OrderBy(s => s).ToListAsync(ct);

        var count = await rows.CountAsync(ct);
        var items = await rows
            .OrderBy(x => x.v.Stock).ThenBy(x => x.p.NameEn).ThenBy(x => x.v.Size)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new InventoryRow(x.v.Id, x.p.Id, x.p.NameAr, x.p.NameEn, x.p.IsVisible, x.v.Sku, x.v.Size,
                new ColorDto(x.v.Color!.Id, x.v.Color.NameAr, x.v.Color.NameEn, x.v.Color.Hex), x.v.Stock, x.v.PriceOverride, x.v.Version))
            .ToListAsync(ct);

        return new InventoryDto(Paging.Create(items, page, pageSize, count),
            totals?.Variants ?? 0, totals?.Units ?? 0, totals?.Low ?? 0, totals?.SoldOut ?? 0, low, sizes);
    }
}
