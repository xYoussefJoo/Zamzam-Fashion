namespace Zamzam.Api.Security;

// Settings that are fine to skip on a laptop but dangerous to forget on a server. Outside Development the API
// refuses to start without them, so a missing setting shows up at deploy time, not as a bug after launch.
public static class StartupChecks
{
    public static void EnsureServerSettings(IConfiguration configuration, IHostEnvironment environment)
    {
        if (environment.IsDevelopment()) return;

        var problems = new List<string>();

        // Without it every customer comes from Vercel's IP and they all share one rate limit (ClientIpMiddleware).
        if (configuration["Proxy:SharedSecret"] is not { Length: >= 32 })
            problems.Add("Proxy:SharedSecret must be set (32+ characters, the same value as PROXY_SHARED_SECRET on Vercel).");

        // "*" accepts any Host header, which a fake request can use to poison links and logs.
        var hosts = configuration["AllowedHosts"];
        if (string.IsNullOrWhiteSpace(hosts) || hosts.Trim() == "*")
            problems.Add("AllowedHosts must list the API's own host name(s), separated by ';' (not \"*\").");

        // Tracking and quote links in emails are built from it; the fallback is localhost.
        if (!Uri.TryCreate(configuration["Site:PublicUrl"], UriKind.Absolute, out var site) || site.Scheme != Uri.UriSchemeHttps)
            problems.Add("Site:PublicUrl must be the storefront's https address (e.g. https://staging.example.com).");

        // Photos can't be uploaded or shown without them.
        if (string.IsNullOrWhiteSpace(configuration["Storage:SupabaseUrl"]) || string.IsNullOrWhiteSpace(configuration["Storage:ServiceKey"]))
            problems.Add("Storage:SupabaseUrl and Storage:ServiceKey must be set.");

        if (problems.Count > 0)
            throw new InvalidOperationException(
                $"The API can't start in {environment.EnvironmentName}:{Environment.NewLine}- " + string.Join(Environment.NewLine + "- ", problems));
    }
}
