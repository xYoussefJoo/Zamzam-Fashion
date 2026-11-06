using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Settings;
using Zamzam.Infrastructure.Identity;

namespace Zamzam.Infrastructure.Persistence;

// Fills an empty database with starting data. Safe to run on every start: it only adds what's missing.
public class DatabaseSeeder(
    ZamzamDbContext db,
    UserManager<AppUser> users,
    RoleManager<IdentityRole> roles,
    IConfiguration configuration,
    ILogger<DatabaseSeeder> logger)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await SeedOwnerAsync();

        if (!await db.DeliveryZones.AnyAsync(cancellationToken)) db.DeliveryZones.AddRange(Seed.SeedData.DeliveryZones());
        if (!await db.Colors.AnyAsync(cancellationToken)) db.Colors.AddRange(Seed.SeedData.Colors());
        if (!await db.SiteSettings.AnyAsync(cancellationToken)) db.SiteSettings.Add(new SiteSettings(SiteContent.Default));
        if (!await db.TailoringCatalog.AnyAsync(cancellationToken)) db.TailoringCatalog.Add(new TailoringCatalog(Seed.SeedData.TailoringCatalog()));
        if (!await db.PriceRules.AnyAsync(cancellationToken)) db.PriceRules.Add(new PriceRules(Seed.SeedData.PriceRules()));

        await db.SaveChangesAsync(cancellationToken);
    }

    // The owner's first login comes from user-secrets / environment variables, never from code.
    private async Task SeedOwnerAsync()
    {
        if (!await roles.RoleExistsAsync(Roles.Owner))
            EnsureSucceeded(await roles.CreateAsync(new IdentityRole(Roles.Owner)), "create the Owner role");

        if ((await users.GetUsersInRoleAsync(Roles.Owner)).Count > 0) return;

        var email = configuration["Seed:OwnerEmail"];
        var password = configuration["Seed:OwnerPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("No Owner account yet. Set Seed:OwnerEmail and Seed:OwnerPassword (user-secrets) and restart.");
            return;
        }

        var owner = new AppUser
        {
            UserName = email.Trim().ToLowerInvariant(),
            Email = email.Trim().ToLowerInvariant(),
            EmailConfirmed = true,
            FullName = configuration["Seed:OwnerName"] ?? "Owner",
            MustChangePassword = true, // the first password was typed by the developer
        };
        EnsureSucceeded(await users.CreateAsync(owner, password), "create the Owner account");
        EnsureSucceeded(await users.AddToRoleAsync(owner, Roles.Owner), "give the Owner role");
        logger.LogInformation("Owner account {Email} created.", owner.Email);
    }

    private static void EnsureSucceeded(IdentityResult result, string action)
    {
        if (!result.Succeeded)
            throw new InvalidOperationException($"Could not {action}: {string.Join(" ", result.Errors.Select(e => e.Description))}");
    }
}

public static class DatabaseStartup
{
    // Applies pending migrations, then seeds. Called once when the API starts.
    public static async Task MigrateAndSeedAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ZamzamDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
        await scope.ServiceProvider.GetRequiredService<DatabaseSeeder>().SeedAsync(cancellationToken);
    }
}
