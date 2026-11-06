using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zamzam.Domain.Common;
using Zamzam.Domain.Entities;

namespace Zamzam.Infrastructure.Persistence.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.Property(c => c.NameAr).HasMaxLength(100);
        builder.Property(c => c.NameEn).HasMaxLength(100);
        builder.Property(c => c.Slug).HasMaxLength(Slug.MaxLength);
        builder.Property(c => c.ImageUrl).HasMaxLength(500);
        builder.HasIndex(c => c.Slug).IsUnique();

        // Sub-categories. Restrict: a category with children can't be deleted by accident.
        builder.HasMany(c => c.Children).WithOne(c => c.Parent)
            .HasForeignKey(c => c.ParentId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.Property(p => p.NameAr).HasMaxLength(150);
        builder.Property(p => p.NameEn).HasMaxLength(150);
        builder.Property(p => p.Slug).HasMaxLength(Slug.MaxLength);
        builder.Property(p => p.DescriptionAr).HasMaxLength(4000);
        builder.Property(p => p.DescriptionEn).HasMaxLength(4000);
        builder.HasIndex(p => p.Slug).IsUnique();
        builder.HasIndex(p => new { p.CategoryId, p.IsVisible, p.IsDeleted });

        builder.HasOne(p => p.Category).WithMany()
            .HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);

        // Photos and variants belong to the product (the aggregate).
        builder.HasMany(p => p.Images).WithOne()
            .HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(p => p.Variants).WithOne()
            .HasForeignKey(v => v.ProductId).OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(p => p.MainImage);
        builder.Ignore(p => p.ActiveVariants);
    }
}

internal sealed class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.Property(v => v.Size).HasMaxLength(20);
        builder.Property(v => v.Sku).HasMaxLength(64);
        builder.HasIndex(v => v.Sku).IsUnique();

        // One active variant per size + color. Deleted (kept-for-history) variants don't count.
        builder.HasIndex(v => new { v.ProductId, v.Size, v.ColorId })
            .IsUnique().HasFilter("\"IsDeleted\" = false");

        builder.HasOne(v => v.Color).WithMany()
            .HasForeignKey(v => v.ColorId).OnDelete(DeleteBehavior.Restrict);

        // PostgreSQL's built-in xmin column: the save fails if someone changed the row since we read it.
        builder.Property(v => v.Version).IsRowVersion();
    }
}

internal sealed class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> builder)
    {
        builder.Property(i => i.StorageKey).HasMaxLength(300);
        builder.Property(i => i.AltAr).HasMaxLength(150);
        builder.Property(i => i.AltEn).HasMaxLength(150);
        builder.HasIndex(i => new { i.ProductId, i.SortOrder });
    }
}

internal sealed class ColorConfiguration : IEntityTypeConfiguration<Color>
{
    public void Configure(EntityTypeBuilder<Color> builder)
    {
        builder.Property(c => c.NameAr).HasMaxLength(50);
        builder.Property(c => c.NameEn).HasMaxLength(50);
        builder.Property(c => c.Hex).HasMaxLength(7).IsFixedLength();
    }
}
