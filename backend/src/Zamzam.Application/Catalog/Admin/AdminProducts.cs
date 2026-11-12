using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Zamzam.Application.Common;
using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Application.Catalog.Admin;

public sealed record AdminProductsQuery(
    int? CategoryId = null,
    string? Q = null,
    bool? IsVisible = null,
    bool? LowStock = null,
    int? ColorId = null,       // these three match on the same variant (AND):
    string? Size = null,       // e.g. "has an M in Navy that is low"
    string? Status = null,     // all | low | out | in (see InventoryStatus)
    string? Sort = null,
    int? Page = null,
    int? PageSize = null);

// New variants start at 0: stock is added in the Warehouse (with a reason), never here.
public sealed record NewVariant(string Size, int ColorId, decimal? PriceOverride = null, string? Sku = null);

public sealed record CreateProductCommand(
    int CategoryId,
    string NameAr,
    string NameEn,
    string? Slug,
    string? DescriptionAr,
    string? DescriptionEn,
    decimal BasePrice,
    bool IsVisible = true,
    IReadOnlyList<NewVariant>? Variants = null);

public sealed record UpdateProductCommand(
    int CategoryId,
    string NameAr,
    string NameEn,
    string? Slug,
    string? DescriptionAr,
    string? DescriptionEn,
    decimal BasePrice,
    bool IsVisible);

// ---------- validators

public sealed class AdminProductsQueryValidator : AbstractValidator<AdminProductsQuery>
{
    public AdminProductsQueryValidator()
    {
        RuleFor(q => q.Q).MaximumLength(100);
        RuleFor(q => q.Size).MaximumLength(20);
        RuleFor(q => q.ColorId).GreaterThan(0).When(q => q.ColorId is not null);
        RuleFor(q => q.Status).Must(s => s is null or InventoryStatus.All or InventoryStatus.Low or InventoryStatus.SoldOut or InventoryStatus.InStock)
            .WithMessage("status must be all, low, out or in.");
        RuleFor(q => q.Sort).Must(s => s is "newest" or "name" or "price_asc" or "price_desc" or "stock_asc")
            .When(q => q.Sort is not null).WithMessage("Sort must be newest, name, price_asc, price_desc or stock_asc.");
    }
}

public sealed class NewVariantValidator : AbstractValidator<NewVariant>
{
    public NewVariantValidator()
    {
        RuleFor(v => v.Size).NotEmpty().MaximumLength(20);
        RuleFor(v => v.ColorId).GreaterThan(0);
        RuleFor(v => v.PriceOverride).GreaterThan(0).PrecisionScale(18, 2, true).When(v => v.PriceOverride is not null);
        RuleFor(v => v.Sku).MaximumLength(64).Matches("^[A-Za-z0-9-]+$").When(v => !string.IsNullOrWhiteSpace(v.Sku))
            .WithMessage("SKU may only contain letters, digits and dashes.");
    }
}

public sealed class CreateProductValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductValidator()
    {
        RuleFor(c => c.CategoryId).GreaterThan(0);
        RuleFor(c => c.NameAr).NotEmpty().MaximumLength(150);
        RuleFor(c => c.NameEn).NotEmpty().MaximumLength(150);
        RuleFor(c => c.Slug).MaximumLength(120);
        RuleFor(c => c.DescriptionAr).MaximumLength(4000);
        RuleFor(c => c.DescriptionEn).MaximumLength(4000);
        RuleFor(c => c.BasePrice).GreaterThan(0).PrecisionScale(18, 2, true);
        RuleFor(c => c.Variants).Must(v => v!.Count <= 100).When(c => c.Variants is not null)
            .WithMessage("At most 100 variants at once.");
        RuleForEach(c => c.Variants).SetValidator(new NewVariantValidator());
    }
}

public sealed class UpdateProductValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductValidator()
    {
        RuleFor(c => c.CategoryId).GreaterThan(0);
        RuleFor(c => c.NameAr).NotEmpty().MaximumLength(150);
        RuleFor(c => c.NameEn).NotEmpty().MaximumLength(150);
        RuleFor(c => c.Slug).MaximumLength(120);
        RuleFor(c => c.DescriptionAr).MaximumLength(4000);
        RuleFor(c => c.DescriptionEn).MaximumLength(4000);
        RuleFor(c => c.BasePrice).GreaterThan(0).PrecisionScale(18, 2, true);
    }
}

// ===================== #21 GET /api/admin/products =====================

public sealed class ListAdminProductsHandler(IAppDbContext db, IImageStorage storage)
{
    public async Task<Paged<AdminProductRow>> HandleAsync(AdminProductsQuery query, CancellationToken ct)
    {
        var (page, pageSize) = Paging.Normalize(query.Page, query.PageSize);
        var products = db.Products.AsNoTracking().Where(p => !p.IsDeleted);

        if (query.CategoryId is int categoryId)
            products = products.Where(p => p.CategoryId == categoryId || p.Category!.ParentId == categoryId);
        if (query.IsVisible is bool visible)
            products = products.Where(p => p.IsVisible == visible);
        if (query.LowStock == true)
            products = products.Where(p => p.Variants.Any(v => !v.IsDeleted && v.Stock <= CatalogRules.LowStockAtOrBelow));
        var colorId = query.ColorId;
        var size = string.IsNullOrWhiteSpace(query.Size) ? null : query.Size.Trim();
        var status = query.Status is InventoryStatus.Low or InventoryStatus.SoldOut or InventoryStatus.InStock ? query.Status : null;
        if (colorId is not null || size is not null || status is not null)
        {
            const int low = CatalogRules.LowStockAtOrBelow;
            products = products.Where(p => p.Variants.Any(v => !v.IsDeleted
                && (colorId == null || v.ColorId == colorId)
                && (size == null || v.Size == size)
                && (status == null
                    || (status == InventoryStatus.Low && v.Stock > 0 && v.Stock <= low)
                    || (status == InventoryStatus.SoldOut && v.Stock <= 0)
                    || (status == InventoryStatus.InStock && v.Stock > low))));
        }
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var text = query.Q.Trim();
            var lower = text.ToLowerInvariant();
            products = products.Where(p => p.NameEn.ToLower().Contains(lower) || p.NameAr.Contains(text) ||
                p.Slug.Contains(lower) || p.Variants.Any(v => v.Sku.ToLower().Contains(lower)));
        }

        var rows = products.Select(p => new
        {
            p.Id, p.Slug, p.NameAr, p.NameEn, p.CategoryId, p.BasePrice, p.IsVisible, p.CreatedAt,
            CategoryNameAr = p.Category!.NameAr,
            CategoryNameEn = p.Category.NameEn,
            TotalStock = p.Variants.Where(v => !v.IsDeleted).Sum(v => (int?)v.Stock) ?? 0,
            VariantCount = p.Variants.Count(v => !v.IsDeleted),
            LowStock = p.Variants.Any(v => !v.IsDeleted && v.Stock <= CatalogRules.LowStockAtOrBelow),
            LowVariants = p.Variants.Count(v => !v.IsDeleted && v.Stock <= CatalogRules.LowStockAtOrBelow),
        });

        rows = query.Sort switch
        {
            "name" => rows.OrderBy(r => r.NameEn).ThenBy(r => r.Id),
            "price_asc" => rows.OrderBy(r => r.BasePrice).ThenBy(r => r.Id),
            "price_desc" => rows.OrderByDescending(r => r.BasePrice).ThenBy(r => r.Id),
            "stock_asc" => rows.OrderBy(r => r.TotalStock).ThenBy(r => r.Id),
            _ => rows.OrderByDescending(r => r.CreatedAt).ThenByDescending(r => r.Id),
        };

        var total = await rows.CountAsync(ct);
        var pageRows = await rows.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        var ids = pageRows.Select(r => r.Id).ToList();
        var thumbs = await db.ProductImages.AsNoTracking()
            .Where(i => ids.Contains(i.ProductId) && i.SortOrder == 0)
            .ToDictionaryAsync(i => i.ProductId, i => i.StorageKey, ct);

        var items = pageRows.Select(r => new AdminProductRow(r.Id, r.Slug, r.NameAr, r.NameEn, r.CategoryId,
            r.CategoryNameAr, r.CategoryNameEn, r.BasePrice, r.TotalStock, r.VariantCount, r.IsVisible,
            thumbs.TryGetValue(r.Id, out var key) ? storage.PublicUrl(ImageKeys.ForWidth(key, ImageSizes.Thumbnail)) : null,
            r.LowStock, r.LowVariants)).ToList();

        return Paging.Create(items, page, pageSize, total);
    }
}

// ===================== #22 GET /api/admin/products/{id} =====================

public sealed class GetAdminProductHandler(IAppDbContext db, IImageStorage storage)
{
    public async Task<AdminProductDetail> HandleAsync(int id, CancellationToken ct)
    {
        var product = await ProductLookup.LoadAsync(db, id, tracking: false, ct);
        return ProductLookup.ToDetail(product, storage);
    }
}

// ===================== #23 POST /api/admin/products =====================

public sealed class CreateProductHandler(IAppDbContext db, IImageStorage storage)
{
    public async Task<AdminProductDetail> HandleAsync(CreateProductCommand command, CancellationToken ct)
    {
        await ProductLookup.EnsureCategoryExistsAsync(db, command.CategoryId, ct);
        var colors = await ProductLookup.ColorsAsync(db, (command.Variants ?? []).Select(v => v.ColorId), ct);

        var product = new Product(command.CategoryId, command.NameAr, command.NameEn, command.Slug,
            command.DescriptionAr, command.DescriptionEn, command.BasePrice, command.IsVisible);
        await ProductLookup.EnsureSlugIsFreeAsync(db, product.Slug, exceptId: null, ct);

        // The default SKU needs the product's id, which exists after the first save — so both saves
        // share one transaction: the product and its variants are created together or not at all.
        await db.InTransactionAsync(async token =>
        {
            db.Products.Add(product);
            await db.SaveChangesAsync(token);

            foreach (var v in command.Variants ?? [])
            {
                var sku = await ProductLookup.ResolveSkuAsync(db, v.Sku, product.Id, v.Size, colors[v.ColorId], token);
                product.AddVariant(v.Size, v.ColorId, sku, 0, v.PriceOverride);
            }
            await db.SaveChangesAsync(token);
            return product.Id;
        }, ct);

        return ProductLookup.ToDetail(await ProductLookup.LoadAsync(db, product.Id, tracking: false, ct), storage);
    }
}

// ===================== #24 PUT /api/admin/products/{id} =====================

public sealed class UpdateProductHandler(IAppDbContext db, IImageStorage storage)
{
    public async Task<AdminProductDetail> HandleAsync(int id, UpdateProductCommand command, CancellationToken ct)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct)
            ?? throw new NotFoundException("Product");
        if (command.CategoryId != product.CategoryId)
            await ProductLookup.EnsureCategoryExistsAsync(db, command.CategoryId, ct);

        product.Update(command.CategoryId, command.NameAr, command.NameEn, command.Slug,
            command.DescriptionAr, command.DescriptionEn, command.BasePrice, command.IsVisible);
        await ProductLookup.EnsureSlugIsFreeAsync(db, product.Slug, exceptId: id, ct);

        await db.SaveChangesAsync(ct);
        return ProductLookup.ToDetail(await ProductLookup.LoadAsync(db, id, tracking: false, ct), storage);
    }
}

// ===================== #25 DELETE /api/admin/products/{id} =====================

public sealed class DeleteProductHandler(IAppDbContext db, IImageStorage storage, ILogger<DeleteProductHandler> logger)
{
    public async Task HandleAsync(int id, CancellationToken ct)
    {
        var product = await db.Products.Include(p => p.Variants).Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct)
            ?? throw new NotFoundException("Product");

        var variantIds = product.Variants.Select(v => v.Id).ToList();
        var wasOrdered = await db.OrderLines.AnyAsync(l => variantIds.Contains(l.VariantId), ct);

        // Old orders point at this product, so it can't go. Hiding it (isVisible = false) is the way out of the shop.
        if (wasOrdered)
            throw new DomainException(ErrorCodes.HasOrders, "This product has orders and can't be deleted. Hide it instead.");

        var files = product.Images.SelectMany(i => ImageKeys.AllFiles(i.StorageKey)).ToList();
        db.Products.Remove(product);
        await db.SaveChangesAsync(ct);
        await StorageCleanup.DeleteQuietlyAsync(storage, files, logger, ct);
    }
}

// ===================== variants: #26–28 =====================

// Size, colour and price only; stock is changed in the Warehouse (AdjustStockCommand).
public sealed record UpdateVariantCommand(string Size, int ColorId, decimal? PriceOverride, uint Version);

public sealed class UpdateVariantValidator : AbstractValidator<UpdateVariantCommand>
{
    public UpdateVariantValidator()
    {
        RuleFor(v => v.Size).NotEmpty().MaximumLength(20);
        RuleFor(v => v.ColorId).GreaterThan(0);
        RuleFor(v => v.PriceOverride).GreaterThan(0).PrecisionScale(18, 2, true).When(v => v.PriceOverride is not null);
    }
}

// #26 POST /api/admin/products/{id}/variants
public sealed class AddVariantHandler(IAppDbContext db)
{
    public async Task<AdminVariantDto> HandleAsync(int productId, NewVariant command, CancellationToken ct)
    {
        var product = await db.Products.Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == productId && !p.IsDeleted, ct)
            ?? throw new NotFoundException("Product");
        var color = (await ProductLookup.ColorsAsync(db, [command.ColorId], ct))[command.ColorId];

        // Same size + color first: the clearer message, before the SKU (which would also collide) is checked.
        if (product.ActiveVariants.Any(v => v.Matches(command.Size, command.ColorId)))
            throw new DomainException(ErrorCodes.Duplicate, $"This product already has size {command.Size.Trim()} in {color.NameEn}.");

        var sku = await ProductLookup.ResolveSkuAsync(db, command.Sku, product.Id, command.Size, color, ct);
        var variant = product.AddVariant(command.Size, command.ColorId, sku, 0, command.PriceOverride);
        await db.SaveChangesAsync(ct);

        return ProductLookup.ToVariantDto(variant, color, product.BasePrice);
    }
}

// #27 PUT /api/admin/variants/{id} — refuses with 409 if someone changed it since the admin loaded it.
public sealed class UpdateVariantHandler(IAppDbContext db)
{
    public async Task<AdminVariantDto> HandleAsync(int id, UpdateVariantCommand command, CancellationToken ct)
    {
        var (product, variant) = await ProductLookup.VariantWithProductAsync(db, id, ct);
        var color = (await ProductLookup.ColorsAsync(db, [command.ColorId], ct))[command.ColorId];

        // Optimistic concurrency: the save only succeeds if the row still has the version the admin saw.
        db.Entry(variant).Property(v => v.Version).OriginalValue = command.Version;
        product.UpdateVariant(id, command.Size, command.ColorId, variant.Stock, command.PriceOverride);
        await db.SaveChangesAsync(ct);

        return ProductLookup.ToVariantDto(variant, color, product.BasePrice);
    }
}

// #28 DELETE /api/admin/variants/{id} — soft delete if it was ever ordered.
public sealed class DeleteVariantHandler(IAppDbContext db)
{
    public async Task HandleAsync(int id, CancellationToken ct)
    {
        var (product, _) = await ProductLookup.VariantWithProductAsync(db, id, ct);
        var wasOrdered = await db.OrderLines.AnyAsync(l => l.VariantId == id, ct);

        product.RemoveVariant(id, keepForHistory: wasOrdered);
        await db.SaveChangesAsync(ct);
    }
}

// ===================== shared =====================

internal static class ProductLookup
{
    public static async Task<Product> LoadAsync(IAppDbContext db, int id, bool tracking, CancellationToken ct)
    {
        IQueryable<Product> query = db.Products
            .Include(p => p.Images)
            .Include(p => p.Variants.Where(v => !v.IsDeleted)).ThenInclude(v => v.Color);
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct) ?? throw new NotFoundException("Product");
    }

    public static async Task<(Product Product, ProductVariant Variant)> VariantWithProductAsync(IAppDbContext db, int variantId, CancellationToken ct)
    {
        var productId = await db.ProductVariants.Where(v => v.Id == variantId && !v.IsDeleted)
            .Select(v => (int?)v.ProductId).FirstOrDefaultAsync(ct) ?? throw new NotFoundException("Variant");
        var product = await db.Products.Include(p => p.Variants)
            .FirstOrDefaultAsync(p => p.Id == productId && !p.IsDeleted, ct) ?? throw new NotFoundException("Variant");
        return (product, product.Variants.Single(v => v.Id == variantId));
    }

    public static async Task EnsureCategoryExistsAsync(IAppDbContext db, int categoryId, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
            throw new DomainException(ErrorCodes.Validation, "The category doesn't exist.");
    }

    public static async Task EnsureSlugIsFreeAsync(IAppDbContext db, string slug, int? exceptId, CancellationToken ct)
    {
        if (await db.Products.AnyAsync(p => p.Slug == slug && p.Id != exceptId, ct))
            throw new DomainException(ErrorCodes.Duplicate, $"Another product already uses the link '{slug}'.");
    }

    public static async Task<Dictionary<int, Color>> ColorsAsync(IAppDbContext db, IEnumerable<int> ids, CancellationToken ct)
    {
        var wanted = ids.Distinct().ToList();
        var colors = await db.Colors.AsNoTracking().Where(c => wanted.Contains(c.Id)).ToDictionaryAsync(c => c.Id, ct);
        var missing = wanted.FirstOrDefault(id => !colors.ContainsKey(id));
        if (missing != 0) throw new DomainException(ErrorCodes.Validation, $"Color {missing} doesn't exist.");
        return colors;
    }

    // The admin's own SKU (checked for duplicates) or the default ZF-{product}-{size}-{color}.
    public static async Task<string> ResolveSkuAsync(IAppDbContext db, string? wanted, int productId, string size, Color color, CancellationToken ct)
    {
        var sku = string.IsNullOrWhiteSpace(wanted) ? Sku.For(productId, size, color.NameEn) : wanted.Trim().ToUpperInvariant();
        if (await db.ProductVariants.AnyAsync(v => v.Sku == sku, ct))
            throw new DomainException(ErrorCodes.Duplicate, $"SKU {sku} is already used.");
        return sku;
    }

    public static AdminVariantDto ToVariantDto(ProductVariant v, Color color, decimal basePrice) =>
        new(v.Id, v.Sku, v.Size, new ColorDto(color.Id, color.NameAr, color.NameEn, color.Hex), v.Stock,
            v.PriceOverride, v.PriceFrom(basePrice), v.Version);

    public static AdminProductDetail ToDetail(Product p, IImageStorage storage)
    {
        var active = p.Variants.Where(v => !v.IsDeleted).ToList();
        var sizeOrder = CatalogRules.OrderSizes(active.Select(v => v.Size)).ToList();

        return new AdminProductDetail(p.Id, p.CategoryId, p.Slug, p.NameAr, p.NameEn, p.DescriptionAr, p.DescriptionEn,
            p.BasePrice, p.IsVisible,
            p.Images.OrderBy(i => i.SortOrder).Select(i => storage.ToImageDto(i.Id, i.StorageKey, i.AltAr, i.AltEn, i.SortOrder)).ToList(),
            active.OrderBy(v => sizeOrder.IndexOf(v.Size)).ThenBy(v => v.Color!.NameEn)
                .Select(v => ToVariantDto(v, v.Color!, p.BasePrice)).ToList(),
            p.CreatedAt, p.UpdatedAt);
    }
}

internal static class StorageCleanup
{
    // Files are removed after the database change is saved; a failure here only leaves unused files behind.
    public static async Task DeleteQuietlyAsync(IImageStorage storage, IReadOnlyCollection<string> files, ILogger logger, CancellationToken ct)
    {
        if (files.Count == 0) return;
        try { await storage.DeletePublicAsync(files, ct); }
        catch (Exception ex) { logger.LogWarning(ex, "Could not delete {Count} image files from storage", files.Count); }
    }
}
