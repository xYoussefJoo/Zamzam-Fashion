using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;

namespace Zamzam.Application.Catalog.Admin;

// The Warehouse owns stock: every change goes through here (or through an order) and leaves a movement.

// POST /api/admin/variants/{id}/stock { "change": 12, "reason": "Received", "note": "Supplier delivery", "version": 3 }
public sealed record AdjustStockCommand(int Change, StockReason Reason, string? Note, uint Version);

public sealed record StockMovementDto(int Id, int Change, StockReason Reason, string? Note, DateTime CreatedAt, string CreatedBy);

public sealed class AdjustStockCommandValidator : AbstractValidator<AdjustStockCommand>
{
    public AdjustStockCommandValidator()
    {
        RuleFor(c => c.Change).NotEqual(0).InclusiveBetween(-100_000, 100_000);
        RuleFor(c => c.Reason).IsInEnum()
            .NotEqual(StockReason.Sold).WithMessage("\"Sold\" is written by orders, not by hand.");
        RuleFor(c => c.Change).GreaterThan(0).When(c => c.Reason is StockReason.Received or StockReason.Returned)
            .WithMessage("Received and Returned add stock, so the change must be positive.");
        RuleFor(c => c.Change).LessThan(0).When(c => c.Reason == StockReason.Damaged)
            .WithMessage("Damaged removes stock, so the change must be negative.");
        RuleFor(c => c.Note).MaximumLength(200);
    }
}

public sealed class AdjustStockHandler(IAppDbContext db)
{
    public async Task<AdminVariantDto> HandleAsync(int variantId, AdjustStockCommand command, string? userId, CancellationToken ct)
    {
        var (product, variant) = await ProductLookup.VariantWithProductAsync(db, variantId, ct);
        var color = (await ProductLookup.ColorsAsync(db, [variant.ColorId], ct))[variant.ColorId];

        // Optimistic concurrency: refused with 409 if the stock changed since the owner loaded the row.
        db.Entry(variant).Property(v => v.Version).OriginalValue = command.Version;
        variant.Adjust(command.Change); // NEGATIVE_STOCK (409) instead of going below 0
        db.StockMovements.Add(new StockMovement(variant.Id, command.Change, command.Reason, command.Note, userId));
        await db.SaveChangesAsync(ct); // stock + movement in one transaction

        return ProductLookup.ToVariantDto(variant, color, product.BasePrice);
    }
}

// GET /api/admin/variants/{id}/movements — newest first (last 100).
public sealed class ListStockMovementsHandler(IAppDbContext db, IUserDirectory users)
{
    public async Task<IReadOnlyList<StockMovementDto>> HandleAsync(int variantId, CancellationToken ct)
    {
        if (!await db.ProductVariants.AnyAsync(v => v.Id == variantId, ct)) throw new NotFoundException("Variant");

        var rows = await db.StockMovements.AsNoTracking()
            .Where(m => m.VariantId == variantId)
            .OrderByDescending(m => m.CreatedAt).ThenByDescending(m => m.Id)
            .Take(100).ToListAsync(ct);

        var names = await users.NamesAsync(rows.Where(r => r.CreatedBy is not null).Select(r => r.CreatedBy!).Distinct(), ct);
        return rows.Select(r => new StockMovementDto(r.Id, r.Change, r.Reason, r.Note, r.CreatedAt,
            r.CreatedBy is null ? "Checkout" : names.GetValueOrDefault(r.CreatedBy, "Owner"))).ToList();
    }
}
