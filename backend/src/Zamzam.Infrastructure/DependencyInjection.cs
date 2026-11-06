using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Zamzam.Infrastructure.Persistence;

namespace Zamzam.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Zamzam")
            ?? throw new InvalidOperationException(
                "Connection string 'Zamzam' is missing. Set it with: dotnet user-secrets set \"ConnectionStrings:Zamzam\" \"Host=localhost;Port=5432;Database=zamzam;Username=zamzam;Password=...\"");

        services.AddSingleton(TimeProvider.System);
        services.AddDbContext<ZamzamDbContext>(options => options.UseNpgsql(connectionString));

        return services;
    }
}
