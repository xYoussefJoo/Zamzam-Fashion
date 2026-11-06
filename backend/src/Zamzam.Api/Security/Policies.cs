namespace Zamzam.Api.Security;

public static class Policies
{
    // Authorization: only the Owner role reaches the dashboard APIs.
    public const string Owner = "Owner";
}

public static class RateLimitPolicies
{
    // Per IP (docs/API-CONTRACT.md, Conventions).
    public const string Login = "login";       // 5 per minute
    public const string PlaceOrder = "orders"; // 10 per 10 minutes
    public const string Tracking = "tracking"; // 30 per minute
}
