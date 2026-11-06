using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Zamzam.Infrastructure.Persistence;

// Used only by `dotnet ef` (creating migrations, generating SQL). The app itself uses AddInfrastructure.
// Creating a migration never connects, so a placeholder connection string is enough.
// For `dotnet ef database update`, set ZAMZAM_DB to a real connection string.
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ZamzamDbContext>
{
    public ZamzamDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ZAMZAM_DB")
            ?? "Host=localhost;Port=5432;Database=zamzam;Username=zamzam";

        var options = new DbContextOptionsBuilder<ZamzamDbContext>().UseNpgsql(connectionString).Options;
        return new ZamzamDbContext(options, TimeProvider.System);
    }
}
