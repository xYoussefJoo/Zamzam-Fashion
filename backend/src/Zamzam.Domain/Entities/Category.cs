using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Entities;

// Two levels only: a main category (ParentId = null) and its sub-categories.
public class Category : Entity
{
    private readonly List<Category> _children = [];

    public int? ParentId { get; private set; }
    public Category? Parent { get; private set; }
    public IReadOnlyCollection<Category> Children => _children;

    public string NameAr { get; private set; } = null!;
    public string NameEn { get; private set; } = null!;
    public string Slug { get; private set; } = null!;
    public string? ImageUrl { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsVisible { get; private set; }

    private Category() { } // EF Core

    public Category(string nameAr, string nameEn, string? slug, Category? parent,
        string? imageUrl = null, int sortOrder = 0, bool isVisible = true)
    {
        Update(nameAr, nameEn, slug, imageUrl, sortOrder, isVisible);
        MoveTo(parent);
    }

    public void Update(string nameAr, string nameEn, string? slug, string? imageUrl, int sortOrder, bool isVisible)
    {
        NameAr = Guard.Required(nameAr, "Arabic name", 100);
        NameEn = Guard.Required(nameEn, "English name", 100);
        Slug = Common.Slug.FromOrValidate(slug, NameEn);
        ImageUrl = Guard.Optional(imageUrl, "Image URL", 500);
        SortOrder = Guard.NotNegative(sortOrder, "Sort order");
        IsVisible = isVisible;
    }

    // parent = null makes this a main category.
    public void MoveTo(Category? parent)
    {
        if (parent is null)
        {
            Parent = null;
            ParentId = null;
            return;
        }

        if (ReferenceEquals(parent, this) || (Id != 0 && parent.Id == Id))
            throw new DomainException(ErrorCodes.Validation, "A category can't be its own parent.");
        if (parent.ParentId is not null || parent.Parent is not null)
            throw new DomainException(ErrorCodes.Validation, "Sub-categories can't have their own sub-categories (max 2 levels).");
        if (_children.Count > 0)
            throw new DomainException(ErrorCodes.Validation, "A category with sub-categories can't become a sub-category.");

        Parent = parent;
        ParentId = parent.Id == 0 ? null : parent.Id;
    }
}
