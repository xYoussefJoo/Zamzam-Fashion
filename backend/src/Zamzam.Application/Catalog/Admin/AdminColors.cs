using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Application.Catalog.Admin;

public sealed record SaveColorCommand(string NameAr, string NameEn, string Hex);

public sealed class SaveColorValidator : AbstractValidator<SaveColorCommand>
{
    public SaveColorValidator()
    {
        RuleFor(c => c.NameAr).NotEmpty().MaximumLength(50);
        RuleFor(c => c.NameEn).NotEmpty().MaximumLength(50);
        RuleFor(c => c.Hex).NotEmpty().Matches("^#[0-9A-Fa-f]{6}$").WithMessage("Hex must look like #d6b995.");
    }
}

// #31 GET /api/admin/colors
public sealed class ListColorsHandler(IAppDbContext db)
{
    public async Task<IReadOnlyList<AdminColorDto>> HandleAsync(CancellationToken ct) =>
        await db.Colors.AsNoTracking().OrderBy(c => c.NameEn)
            .Select(c => new AdminColorDto(c.Id, c.NameAr, c.NameEn, c.Hex,
                db.ProductVariants.Count(v => v.ColorId == c.Id && !v.IsDeleted)))
            .ToListAsync(ct);
}

// #32 POST /api/admin/colors
public sealed class CreateColorHandler(IAppDbContext db)
{
    public async Task<AdminColorDto> HandleAsync(SaveColorCommand command, CancellationToken ct)
    {
        var color = new Color(command.NameAr, command.NameEn, command.Hex);
        await EnsureNameIsFreeAsync(db, color.NameEn, exceptId: null, ct);
        db.Colors.Add(color);
        await db.SaveChangesAsync(ct);
        return new AdminColorDto(color.Id, color.NameAr, color.NameEn, color.Hex, 0);
    }

    internal static async Task EnsureNameIsFreeAsync(IAppDbContext db, string nameEn, int? exceptId, CancellationToken ct)
    {
        var lower = nameEn.ToLower();
        if (await db.Colors.AnyAsync(c => c.NameEn.ToLower() == lower && c.Id != exceptId, ct))
            throw new DomainException(ErrorCodes.Duplicate, $"The color '{nameEn}' already exists.");
    }
}

// #33 PUT /api/admin/colors/{id}
public sealed class UpdateColorHandler(IAppDbContext db)
{
    public async Task<AdminColorDto> HandleAsync(int id, SaveColorCommand command, CancellationToken ct)
    {
        var color = await db.Colors.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Color");
        color.Update(command.NameAr, command.NameEn, command.Hex);
        await CreateColorHandler.EnsureNameIsFreeAsync(db, color.NameEn, exceptId: id, ct);
        await db.SaveChangesAsync(ct);
        return new AdminColorDto(color.Id, color.NameAr, color.NameEn, color.Hex,
            await db.ProductVariants.CountAsync(v => v.ColorId == id && !v.IsDeleted, ct));
    }
}

// #34 DELETE /api/admin/colors/{id} — only if no variant (even a deleted one) uses it.
public sealed class DeleteColorHandler(IAppDbContext db)
{
    public async Task HandleAsync(int id, CancellationToken ct)
    {
        var color = await db.Colors.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException("Color");
        if (await db.ProductVariants.AnyAsync(v => v.ColorId == id, ct))
            throw new DomainException(ErrorCodes.InUse, "Some products still use this color.");
        db.Colors.Remove(color);
        await db.SaveChangesAsync(ct);
    }
}
