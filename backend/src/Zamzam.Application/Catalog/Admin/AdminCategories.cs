using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Application.Catalog.Admin;

public sealed record SaveCategoryCommand(
    int? ParentId,
    string NameAr,
    string NameEn,
    string? Slug = null,
    string? ImageUrl = null,
    bool IsVisible = true,
    int SortOrder = 0);

public sealed class SaveCategoryValidator : AbstractValidator<SaveCategoryCommand>
{
    public SaveCategoryValidator()
    {
        RuleFor(c => c.NameAr).NotEmpty().MaximumLength(100);
        RuleFor(c => c.NameEn).NotEmpty().MaximumLength(100);
        RuleFor(c => c.Slug).MaximumLength(120);
        RuleFor(c => c.ImageUrl).MaximumLength(500)
            .Must(u => Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            .When(c => !string.IsNullOrWhiteSpace(c.ImageUrl)).WithMessage("Image URL must start with https://");
        RuleFor(c => c.SortOrder).GreaterThanOrEqualTo(0);
        RuleFor(c => c.ParentId).GreaterThan(0).When(c => c.ParentId is not null);
    }
}

// #17 GET /api/admin/categories — the full tree, hidden ones included, with product counts.
public sealed class ListAdminCategoriesHandler(IAppDbContext db)
{
    public async Task<IReadOnlyList<AdminCategoryNode>> HandleAsync(CancellationToken ct)
    {
        var categories = await db.Categories.AsNoTracking()
            .OrderBy(c => c.SortOrder).ThenBy(c => c.NameEn).ToListAsync(ct);
        var counts = await db.Products.Where(p => !p.IsDeleted)
            .GroupBy(p => p.CategoryId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        AdminCategoryNode Node(Category c) => new(c.Id, c.ParentId, c.Slug, c.NameAr, c.NameEn, c.ImageUrl, c.SortOrder,
            c.IsVisible, counts.GetValueOrDefault(c.Id),
            categories.Where(child => child.ParentId == c.Id).Select(Node).ToList());

        return categories.Where(c => c.ParentId is null).Select(Node).ToList();
    }
}

// #18 POST /api/admin/categories
public sealed class CreateCategoryHandler(IAppDbContext db)
{
    public async Task<AdminCategoryNode> HandleAsync(SaveCategoryCommand command, CancellationToken ct)
    {
        var parent = await CategoryLookup.ParentAsync(db, command.ParentId, ct);
        var category = new Category(command.NameAr, command.NameEn, command.Slug, parent,
            command.ImageUrl, command.SortOrder, command.IsVisible);
        await CategoryLookup.EnsureSlugIsFreeAsync(db, category.Slug, exceptId: null, ct);

        db.Categories.Add(category);
        await db.SaveChangesAsync(ct);
        return CategoryLookup.ToNode(category, productCount: 0);
    }
}

// #19 PUT /api/admin/categories/{id} — includes parent and menu order (the reorder endpoint was dropped).
public sealed class UpdateCategoryHandler(IAppDbContext db)
{
    public async Task<AdminCategoryNode> HandleAsync(int id, SaveCategoryCommand command, CancellationToken ct)
    {
        var category = await db.Categories.Include(c => c.Children).FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Category");

        category.Update(command.NameAr, command.NameEn, command.Slug, command.ImageUrl, command.SortOrder, command.IsVisible);
        if (command.ParentId != category.ParentId)
            category.MoveTo(await CategoryLookup.ParentAsync(db, command.ParentId, ct));
        await CategoryLookup.EnsureSlugIsFreeAsync(db, category.Slug, exceptId: id, ct);

        await db.SaveChangesAsync(ct);
        var count = await db.Products.CountAsync(p => p.CategoryId == id && !p.IsDeleted, ct);
        return CategoryLookup.ToNode(category, count);
    }
}

// #20 DELETE /api/admin/categories/{id} — only an empty category.
public sealed class DeleteCategoryHandler(IAppDbContext db)
{
    public async Task HandleAsync(int id, CancellationToken ct)
    {
        var category = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Category");

        if (await db.Categories.AnyAsync(c => c.ParentId == id, ct))
            throw new DomainException(ErrorCodes.InUse, "Move or delete its sub-categories first.");
        // Deleted products still count: old orders point at them through their category.
        if (await db.Products.AnyAsync(p => p.CategoryId == id, ct))
            throw new DomainException(ErrorCodes.InUse, "Move its products to another category first.");

        db.Categories.Remove(category);
        await db.SaveChangesAsync(ct);
    }
}

internal static class CategoryLookup
{
    public static async Task<Category?> ParentAsync(IAppDbContext db, int? parentId, CancellationToken ct) =>
        parentId is null ? null
            : await db.Categories.FirstOrDefaultAsync(c => c.Id == parentId, ct)
              ?? throw new DomainException(ErrorCodes.Validation, "The parent category doesn't exist.");

    public static async Task EnsureSlugIsFreeAsync(IAppDbContext db, string slug, int? exceptId, CancellationToken ct)
    {
        if (await db.Categories.AnyAsync(c => c.Slug == slug && c.Id != exceptId, ct))
            throw new DomainException(ErrorCodes.Duplicate, $"Another category already uses the link '{slug}'.");
    }

    public static AdminCategoryNode ToNode(Category c, int productCount) =>
        new(c.Id, c.ParentId, c.Slug, c.NameAr, c.NameEn, c.ImageUrl, c.SortOrder, c.IsVisible, productCount, []);
}
