using Microsoft.AspNetCore.Mvc;

namespace Zamzam.Api.Security;

// Cheap CSRF guard on top of the SameSite=Strict cookie: every state-changing request to
// /api/admin or /api/auth must carry a custom header. A plain HTML form on another site can't set
// custom headers, and a cross-site script that tries to is blocked by the browser's CORS check.
public sealed class CsrfHeaderMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Requested-With";
    public const string HeaderValue = "zamzam-admin";
    public const string ErrorCode = "MISSING_CSRF_HEADER";

    public async Task InvokeAsync(HttpContext context, IProblemDetailsService problemDetails)
    {
        var path = context.Request.Path;
        var protectedPath = path.StartsWithSegments("/api/admin") || path.StartsWithSegments("/api/auth");
        var changesState = !(HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)
            || HttpMethods.IsOptions(context.Request.Method));

        if (protectedPath && changesState && context.Request.Headers[HeaderName] != HeaderValue)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            var problem = new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Missing security header",
                Detail = $"Send the header {HeaderName}: {HeaderValue}.",
                Type = "https://zamzam.app/errors/missing-csrf-header",
            };
            problem.Extensions["code"] = ErrorCode;
            await problemDetails.WriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = problem });
            return;
        }

        await next(context);
    }
}
