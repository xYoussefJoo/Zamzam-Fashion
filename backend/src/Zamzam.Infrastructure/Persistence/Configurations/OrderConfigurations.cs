using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zamzam.Domain.Entities;
using Zamzam.Infrastructure.Identity;

namespace Zamzam.Infrastructure.Persistence.Configurations;

internal sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.Property(o => o.Number).HasMaxLength(20);
        builder.HasIndex(o => o.Number).IsUnique();
        builder.Property(o => o.TrackingTokenHash).HasMaxLength(128);
        builder.HasIndex(o => new { o.Status, o.CreatedAt });

        // Customer details live as columns inside Orders (a value object, not a table).
        builder.OwnsOne(o => o.Customer, customer =>
        {
            customer.Property(c => c.Name).HasColumnName("CustomerName").HasMaxLength(100);
            customer.Property(c => c.Phone).HasColumnName("Phone").HasMaxLength(16);
            customer.Property(c => c.Email).HasColumnName("Email").HasMaxLength(254);
            customer.Property(c => c.City).HasColumnName("City").HasMaxLength(100);
            customer.Property(c => c.Address).HasColumnName("Address").HasMaxLength(500);
            customer.Property(c => c.Notes).HasColumnName("Notes").HasMaxLength(500);
            customer.HasIndex(c => c.Phone); // find all orders of one customer
        });
        builder.Navigation(o => o.Customer).IsRequired();

        builder.HasOne<DeliveryZone>().WithMany()
            .HasForeignKey(o => o.DeliveryZoneId).OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.Lines).WithOne()
            .HasForeignKey(l => l.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(o => o.History).WithOne()
            .HasForeignKey(h => h.OrderId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(o => o.Tailoring).WithOne()
            .HasForeignKey<TailoringSpec>(t => t.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> builder)
    {
        builder.Property(l => l.ProductNameAr).HasMaxLength(150);
        builder.Property(l => l.ProductNameEn).HasMaxLength(150);
        builder.Property(l => l.Size).HasMaxLength(20);
        builder.Property(l => l.ColorNameAr).HasMaxLength(50);
        builder.Property(l => l.ColorNameEn).HasMaxLength(50);
        builder.Property(l => l.ImageUrl).HasMaxLength(500);

        // Restrict: a variant that was ever ordered can't be hard-deleted (it gets soft-deleted).
        builder.HasOne<ProductVariant>().WithMany()
            .HasForeignKey(l => l.VariantId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
{
    public void Configure(EntityTypeBuilder<OrderStatusHistory> builder)
    {
        builder.ToTable("OrderStatusHistory");
        builder.Property(h => h.Note).HasMaxLength(500);
        builder.HasIndex(h => new { h.OrderId, h.ChangedAt });

        // Who changed it. If that account is ever deleted, the history row stays with no user.
        builder.Property(h => h.ChangedByUserId).HasMaxLength(450);
        builder.HasOne<AppUser>().WithMany()
            .HasForeignKey(h => h.ChangedByUserId).OnDelete(DeleteBehavior.SetNull);
    }
}

internal sealed class TailoringSpecConfiguration : IEntityTypeConfiguration<TailoringSpec>
{
    public void Configure(EntityTypeBuilder<TailoringSpec> builder)
    {
        builder.Property(t => t.StyleId).HasMaxLength(50);
        builder.Property(t => t.Garment).HasMaxLength(50);
        builder.Property(t => t.Fabric).HasMaxLength(50);
        builder.Property(t => t.Color).HasMaxLength(50);
        builder.Property(t => t.Fit).HasMaxLength(50);
        builder.Property(t => t.StandardSize).HasMaxLength(10);
        builder.Property(t => t.ReferenceImageKey).HasMaxLength(300);
        builder.Property(t => t.QuoteNote).HasMaxLength(500);

        builder.Property(t => t.Measurements).HasJsonConversion(); // { "waist": 72, "hips": 98 }
        builder.Property(t => t.Extras).HasJsonConversion();       // [ "embroidery" ]
    }
}
