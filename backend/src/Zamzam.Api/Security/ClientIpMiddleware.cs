using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace Zamzam.Api.Security;

// Behind the Vercel proxy every request comes from a Vercel IP, so all customers would share one rate limit.
// Vercel adds the shared secret; only then do we trust X-Forwarded-For. Anyone else can't fake their IP.
public sealed class ClientIpMiddleware(RequestDelegate next, IConfiguration configuration)
{
    public const string SecretHeader = "X-Proxy-Secret";
    private readonly byte[]? _secret = configuration["Proxy:SharedSecret"] is { Length: >= 32 } s ? Encoding.UTF8.GetBytes(s) : null;

    public Task InvokeAsync(HttpContext context)
    {
        var request = context.Request;
        if (_secret is not null && request.Headers.TryGetValue(SecretHeader, out var sent)
            && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(sent.ToString()), _secret))
        {
            // "client, proxy1, proxy2": the first one is the customer.
            var first = request.Headers["X-Forwarded-For"].ToString().Split(',')[0].Trim();
            if (IPAddress.TryParse(first, out var ip)) context.Connection.RemoteIpAddress = ip;
        }
        request.Headers.Remove(SecretHeader); // never reaches logs or controllers
        return next(context);
    }
}
