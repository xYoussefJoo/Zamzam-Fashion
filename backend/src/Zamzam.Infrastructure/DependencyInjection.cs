using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;
using Zamzam.Infrastructure.Health;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Infrastructure.Email;
using Zamzam.Infrastructure.Identity;
using Zamzam.Infrastructure.Orders;
using Zamzam.Infrastructure.Persistence;
using Zamzam.Infrastructure.Storage;

namespace Zamzam.Infrastructure;

public static class DependencyInjection
{
    public const string AuthCookieName = "zz.auth";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration,
        IHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("Zamzam")
            ?? throw new InvalidOperationException(
                "Connection string 'Zamzam' is missing. Set it with: dotnet user-secrets set \"ConnectionStrings:Zamzam\" \"Host=localhost;Port=5432;Database=zamzam;Username=zamzam;Password=...\"");

        // Supabase's pooler allows only a few connections per project. Npgsql would open up to 100, so cap it
        // (Database:MaxPoolSize, default 10) unless the connection string already sets its own limit.
        var connection = new NpgsqlConnectionStringBuilder(connectionString);
        if (connection.MaxPoolSize == new NpgsqlConnectionStringBuilder().MaxPoolSize)
            connection.MaxPoolSize = configuration.GetValue("Database:MaxPoolSize", 10);
        connectionString = connection.ConnectionString;

        services.AddSingleton(TimeProvider.System);
        services.AddDbContext<ZamzamDbContext>(options => options.UseNpgsql(connectionString, npgsql => npgsql
            .MigrationsHistoryTable("__EFMigrationsHistory", ZamzamDbContext.Schema)
            // A product with 10 photos and 20 variants is 30 rows, not 200 (one query per list).
            .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));

        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<ZamzamDbContext>());

        services.AddOptions<StorageOptions>().Bind(configuration.GetSection(StorageOptions.Section));
        services.AddHttpClient<SupabaseImageStorage>(client => client.Timeout = TimeSpan.FromSeconds(60));
        services.AddScoped<IImageStorage>(provider => provider.GetRequiredService<SupabaseImageStorage>());
        services.AddSingleton<IImageProcessor, SkiaImageProcessor>();

        services.AddScoped<IOrderNumberGenerator, OrderNumberGenerator>();
        services.AddScoped<IUserDirectory, UserDirectory>();
        services.AddSingleton<ISiteLinks, SiteLinks>();
        services.AddSingleton<EmailQueue>();
        services.AddSingleton<IEmailQueue>(provider => provider.GetRequiredService<EmailQueue>());
        services.AddSingleton<IEmailSender, LogOnlyEmailSender>(); // Day 4: a real provider at deploy
        services.AddHostedService<EmailBackgroundService>();

        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>(HealthCheckNames.Database)
            .AddCheck<StorageHealthCheck>(HealthCheckNames.Storage);

        services.AddOwnerIdentity(configuration, environment);
        services.AddScoped<DatabaseSeeder>();

        return services;
    }

    private static void AddOwnerIdentity(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        services
            .AddIdentity<AppUser, IdentityRole>(options =>
            {
                // Length beats complexity rules; the common-password list blocks the easy ones.
                options.Password.RequiredLength = 10;
                options.Password.RequiredUniqueChars = 4;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;

                // 5 wrong passwords -> locked for 15 minutes.
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;

                options.User.RequireUniqueEmail = true;
            })
            .AddEntityFrameworkStores<ZamzamDbContext>()
            .AddPasswordValidator<CommonPasswordValidator>();

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = AuthCookieName;
            options.Cookie.HttpOnly = true;                          // JavaScript can't read it (XSS can't steal it)
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always; // HTTPS only (browsers allow localhost)
            options.Cookie.SameSite = SameSiteMode.Strict;           // other sites can't use the owner's login
            options.ExpireTimeSpan = TimeSpan.FromHours(8);
            options.SlidingExpiration = true;

            // This is an API: answer 401/403 instead of redirecting to a login page.
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        // The keys that encrypt the cookie live in the database, so redeploys don't log the owner out.
        var dataProtection = services.AddDataProtection()
            .PersistKeysToDbContext<ZamzamDbContext>()
            .SetApplicationName("Zamzam");

        // Someone who reads the database must not be able to forge the owner's cookie, so the keys are encrypted.
        // Development keeps them plain: the dev database is shared and each PC would encrypt them differently.
        if (environment.IsDevelopment()) return;
        // A .pfx in config (MonsterASP env var), made once with scripts/new-dataprotection-cert.ps1. It works on any
        // server the app moves to. No fallback: DPAPI on a shared host lets other sites on the machine read the keys.
        if (configuration["DataProtection:CertificateBase64"] is not { Length: > 0 } pfx)
            throw new InvalidOperationException(
                "DataProtection:CertificateBase64 is required outside Development (run scripts/new-dataprotection-cert.ps1).");
        // MachineKeySet: IIS app pools on shared hosts (MonsterASP) have no user profile, so the default (key in the
        // profile) fails with "The system cannot find the file specified"; EphemeralKeySet failed there too.
        var certificate = X509CertificateLoader.LoadPkcs12(Convert.FromBase64String(pfx), configuration["DataProtection:CertificatePassword"],
            X509KeyStorageFlags.MachineKeySet);
        // Decrypt with this certificate directly too, instead of looking it up in a machine certificate store.
        dataProtection.ProtectKeysWithCertificate(certificate).UnprotectKeysWithAnyCertificate(certificate);
    }
}
