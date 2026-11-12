using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Zamzam.Domain.Entities;

namespace Zamzam.Application.Common;

// What the use cases need from the database. Infrastructure implements it with EF Core + PostgreSQL;
// tests implement it with an in-memory database.
public interface IAppDbContext
{
    DbSet<Category> Categories { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductVariant> ProductVariants { get; }
    DbSet<StockMovement> StockMovements { get; }
    DbSet<ProductImage> ProductImages { get; }
    DbSet<Color> Colors { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderLine> OrderLines { get; }
    DbSet<DeliveryZone> DeliveryZones { get; }
    DbSet<SiteSettings> SiteSettings { get; }
    DbSet<TailoringCatalog> TailoringCatalog { get; }
    DbSet<PriceRules> PriceRules { get; }

    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    // Forgets everything loaded so far, so a retry starts from fresh database values.
    void ClearChanges();

    // Runs the work in one database transaction: everything is saved, or nothing is.
    Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken);
}
