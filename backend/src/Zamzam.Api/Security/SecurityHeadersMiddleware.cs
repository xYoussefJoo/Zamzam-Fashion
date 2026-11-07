namespace Zamzam.Api.Security;

// The API only returns JSON, so the browser may run nothing from it, frame it, or guess its content type.
public sealed class SecurityHeadersMiddleware(RequestDelegate next, IWebHostEnvironment environment)
{
    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Cross-Origin-Resource-Policy"] = "same-site";
            // The OpenAPI page in development needs nothing either: it is plain JSON.
            headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
            // HTTPS only for a year. Not in development: it would stick to localhost in the browser.
            if (!environment.IsDevelopment()) headers.StrictTransportSecurity = "max-age=31536000; includeSubDomains";
            headers.Remove("Server");
            headers.Remove("X-Powered-By");
            return Task.CompletedTask;
        });
        return next(context);
    }
}
