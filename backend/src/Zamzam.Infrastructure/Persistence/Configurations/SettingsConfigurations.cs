using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Zamzam.Domain.Entities;

namespace Zamzam.Infrastructure.Persistence.Configurations;

internal sealed class DeliveryZoneConfiguration : IEntityTypeConfiguration<DeliveryZone>
{
    public void Configure(EntityTypeBuilder<DeliveryZone> builder)
    {
        builder.Property(z => z.Key).HasMaxLength(40);
        builder.HasIndex(z => z.Key).IsUnique();
        builder.Property(z => z.NameAr).HasMaxLength(60);
        builder.Property(z => z.NameEn).HasMaxLength(60);
    }
}

// The three single-row settings tables keep their whole content in one jsonb column,
// so adding a field (a new social link, a new fabric) needs no migration.
internal sealed class SiteSettingsConfiguration : IEntityTypeConfiguration<SiteSettings>
{
    public void Configure(EntityTypeBuilder<SiteSettings> builder)
    {
        builder.ToTable("SiteSettings");
        builder.Property(s => s.Content).HasJsonConversion();
    }
}

internal sealed class TailoringCatalogConfiguration : IEntityTypeConfiguration<TailoringCatalog>
{
    public void Configure(EntityTypeBuilder<TailoringCatalog> builder)
    {
        builder.ToTable("TailoringCatalog");
        builder.Property(c => c.Content).HasJsonConversion();
    }
}

internal sealed class PriceRulesConfiguration : IEntityTypeConfiguration<PriceRules>
{
    public void Configure(EntityTypeBuilder<PriceRules> builder)
    {
        builder.ToTable("PriceRules");
        builder.Property(p => p.Content).HasJsonConversion();
    }
}

internal sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("IdempotencyKeys");
        builder.HasKey(r => r.Key);
        builder.Property(r => r.Key).HasMaxLength(100);
        builder.Property(r => r.Endpoint).HasMaxLength(100);
        builder.Property(r => r.RequestHash).HasMaxLength(64);
        builder.Property(r => r.ResponseJson).HasColumnType("jsonb");
        builder.HasIndex(r => r.CreatedAt); // daily clean-up of keys older than 24 h
    }
}
