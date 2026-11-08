using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Settings;
using Zamzam.Infrastructure.Identity;
using Zamzam.Infrastructure.Storage;

namespace Zamzam.Infrastructure.Persistence;

// Fills an empty database with starting data. Safe to run on every start: it only adds what's missing.
public class DatabaseSeeder(
    ZamzamDbContext db,
    UserManager<AppUser> users,
    RoleManager<IdentityRole> roles,
    SupabaseImageStorage storage,
    IConfiguration configuration,
    IHostEnvironment environment,
    ILogger<DatabaseSeeder> logger)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await SeedOwnerAsync();
        await SeedDemoOwnerAsync();

        if (!await db.DeliveryZones.AnyAsync(cancellationToken)) db.DeliveryZones.AddRange(Seed.SeedData.DeliveryZones());
        if (!await db.Colors.AnyAsync(cancellationToken)) db.Colors.AddRange(Seed.SeedData.Colors());
        if (!await db.SiteSettings.AnyAsync(cancellationToken)) db.SiteSettings.Add(new SiteSettings(SiteContent.Default));
        if (!await db.TailoringCatalog.AnyAsync(cancellationToken)) db.TailoringCatalog.Add(new TailoringCatalog(Seed.SeedData.TailoringCatalog()));
        if (!await db.PriceRules.AnyAsync(cancellationToken)) db.PriceRules.Add(new PriceRules(Seed.SeedData.PriceRules()));

        await db.SaveChangesAsync(cancellationToken);

        if (configuration.GetValue<bool>("Seed:DemoCatalog")) await SeedDemoCatalogAsync(cancellationToken);

        // A storage hiccup must not stop the API from starting; uploads will report the problem.
        try { await storage.EnsureBucketsAsync(cancellationToken); }
        catch (Exception ex) { logger.LogWarning(ex, "Could not check the storage buckets."); }
    }

    // Development only (Seed:DemoCatalog = true), and only into an empty catalog.
    private async Task SeedDemoCatalogAsync(CancellationToken ct)
    {
        if (await db.Products.AnyAsync(ct) || await db.Categories.AnyAsync(ct)) return;

        var categories = new Dictionary<string, Category>();
        foreach (var c in Seed.SeedData.DemoCategories())
        {
            var category = new Category(c.NameAr, c.NameEn, c.Slug, c.ParentSlug is null ? null : categories[c.ParentSlug], null, c.SortOrder);
            categories[c.Slug] = category;
            db.Categories.Add(category);
        }
        await db.SaveChangesAsync(ct);

        var colors = await db.Colors.ToDictionaryAsync(c => c.NameEn, ct);
        var demo = Seed.SeedData.DemoProducts();
        var products = demo.Select(d => new Product(categories[d.CategorySlug].Id, d.NameAr, d.NameEn, null,
            d.DescriptionAr, d.DescriptionEn, d.Price)).ToList();
        db.Products.AddRange(products);
        await db.SaveChangesAsync(ct); // ids are needed for the SKUs

        for (var i = 0; i < products.Count; i++)
        {
            var sizes = demo[i].Sizes;
            var colorNames = demo[i].Colors;
            for (var s = 0; s < sizes.Length; s++)
                for (var c = 0; c < colorNames.Length; c++)
                {
                    var color = colors[colorNames[c]];
                    var stock = (i + s * 3 + c * 2) % 7 + 1; // 1–7 pieces, so some show "only N left" / low stock
                    products[i].AddVariant(sizes[s], color.Id, Sku.For(products[i].Id, sizes[s], color.NameEn), stock);
                }
        }
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Demo catalog added: {Categories} categories, {Products} products.", categories.Count, products.Count);
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

    // A second Owner login for testing the dashboard (Seed:DemoOwnerEmail / Seed:DemoOwnerPassword in user-secrets).
    // Development only: in Production it is never created, and an existing one is removed so a known password can't go live.
    private const string DemoName = "Demo (test account)";

    private async Task SeedDemoOwnerAsync()
    {
        if (!environment.IsDevelopment())
        {
            // Found by its marker name, so this works even when Production has no Seed:DemoOwner* settings.
            foreach (var old in (await users.GetUsersInRoleAsync(Roles.Owner)).Where(u => u.FullName == DemoName))
            {
                EnsureSucceeded(await users.DeleteAsync(old), "remove the demo account");
                logger.LogWarning("Demo account {Email} removed: it is for Development only.", old.Email);
            }
            return;
        }

        var email = configuration["Seed:DemoOwnerEmail"]?.Trim().ToLowerInvariant();
        var password = configuration["Seed:DemoOwnerPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password) || await users.FindByEmailAsync(email) is not null) return;

        var demo = new AppUser { UserName = email, Email = email, EmailConfirmed = true, FullName = DemoName, MustChangePassword = false };
        // A test login must never stop the API from starting: report the reason and carry on.
        var created = await users.CreateAsync(demo, password);
        if (!created.Succeeded)
        {
            logger.LogWarning("Demo account not created: {Errors}", string.Join(" ", created.Errors.Select(e => e.Description)));
            return;
        }
        EnsureSucceeded(await users.AddToRoleAsync(demo, Roles.Owner), "give the demo account the Owner role");
        logger.LogInformation("Demo account {Email} created (Development only).", email);
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
