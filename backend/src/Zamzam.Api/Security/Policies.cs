namespace Zamzam.Api.Security;

public static class Policies
{
    // Authorization: only the Owner role reaches the dashboard APIs.
    public const string Owner = "Owner";
}

public static class RateLimitPolicies
{
    // 5 login attempts per minute per IP (docs/API-CONTRACT.md, Conventions).
    public const string Login = "login";
}
