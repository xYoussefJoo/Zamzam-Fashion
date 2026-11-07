using Microsoft.Extensions.Diagnostics.HealthChecks;
using Zamzam.Infrastructure.Persistence;
using Zamzam.Infrastructure.Storage;

namespace Zamzam.Infrastructure.Health;

public static class HealthCheckNames
{
    public const string Database = "db";
    public const string Storage = "storage";
}

// Can we open a connection and run a query? Without the database nothing works: Unhealthy (503).
internal sealed class DatabaseHealthCheck(ZamzamDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await db.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("Cannot connect to the database.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Database check failed.", ex);
        }
    }
}

// Is Supabase Storage answering? Without it only photo uploads fail, so the site is Degraded, not down.
internal sealed class StorageHealthCheck(SupabaseImageStorage storage) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await storage.IsReachableAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Degraded("Storage is not configured or not reachable.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Degraded("Storage check failed.", ex);
        }
    }
}
