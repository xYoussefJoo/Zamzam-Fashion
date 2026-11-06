using Microsoft.EntityFrameworkCore;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;

namespace Zamzam.Infrastructure.Persistence;

public class ZamzamDbContext(DbContextOptions<ZamzamDbContext> options, TimeProvider clock) : DbContext(options)
{
    public const string OrderNumberSequence = "OrderNumbers";

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductVariant> ProductVariants => Set<ProductVariant>();
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();
    public DbSet<Color> Colors => Set<Color>();

    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<OrderStatusHistory> OrderStatusHistory => Set<OrderStatusHistory>();
    public DbSet<TailoringSpec> TailoringSpecs => Set<TailoringSpec>();
    public DbSet<DeliveryZone> DeliveryZones => Set<DeliveryZone>();

    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();
    public DbSet<TailoringCatalog> TailoringCatalog => Set<TailoringCatalog>();
    public DbSet<PriceRules> PriceRules => Set<PriceRules>();
    public DbSet<IdempotencyRecord> IdempotencyKeys => Set<IdempotencyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ZamzamDbContext).Assembly);

        // ZF-10001, ZF-10002, ... Read with nextval() when an order is created.
        modelBuilder.HasSequence<long>(OrderNumberSequence).StartsAt(10001).IncrementsBy(1);
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Money: exact, 2 decimals everywhere.
        configurationBuilder.Properties<decimal>().HavePrecision(18, 2);

        // Enums are stored as readable text ("Shipped"), so reordering an enum never corrupts data.
        configurationBuilder.Properties<OrderStatus>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<OrderType>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<PaymentMethod>().HaveConversion<string>().HaveMaxLength(30);
        configurationBuilder.Properties<PaymentStatus>().HaveConversion<string>().HaveMaxLength(20);
        configurationBuilder.Properties<SizingMode>().HaveConversion<string>().HaveMaxLength(20);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampDates();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampDates();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    // The only place CreatedAt / UpdatedAt are set.
    private void StampDates()
    {
        var now = clock.GetUtcNow().UtcDateTime;
        foreach (var entry in ChangeTracker.Entries<Entity>())
        {
            if (entry.State == EntityState.Added) entry.Property(e => e.CreatedAt).CurrentValue = now;
            else if (entry.State == EntityState.Modified) entry.Property(e => e.UpdatedAt).CurrentValue = now;
        }
    }
}
