using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Serilog;
using Zamzam.Api.Errors;
using Zamzam.Api.Security;
using Zamzam.Application;
using Zamzam.Domain.Constants;
using Zamzam.Infrastructure;
using Zamzam.Infrastructure.Health;
using Zamzam.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
// Don't tell attackers which server we run (the header is added after the middleware, so turn it off here).
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .WriteTo.Console());

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);
builder.Services
    .AddControllers(options => options.Filters.Add<ValidationFilter>())
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// OpenAPI reads these JSON options, not the MVC ones above. Without them openapi.json shows enums as numbers
// and every number as "integer or string", which gives the generated TypeScript types the wrong shape.
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddOpenApi(options => options.AddOperationTransformer<IdempotencyHeaderTransformer>());

// Errors: every failure becomes ProblemDetails. A 400 without its own code is a validation error.
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    if (context.ProblemDetails.Status == StatusCodes.Status400BadRequest
        && !context.ProblemDetails.Extensions.ContainsKey("code"))
        context.ProblemDetails.Extensions["code"] = ErrorCodes.Validation;
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.Owner, policy => policy.RequireRole(Roles.Owner));

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // The IP is the real customer's, thanks to ClientIpMiddleware (behind Vercel).
    static string Ip(HttpContext context) => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    void PerIp(string policy, int permits, TimeSpan window) => options.AddPolicy(policy, context =>
        RateLimitPartition.GetFixedWindowLimiter(Ip(context),
            _ => new FixedWindowRateLimiterOptions { PermitLimit = permits, Window = window }));

    // Every request, on top of the per-endpoint limits: stops one IP from hammering the whole API.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(Ip(context),
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1) }));

    PerIp(RateLimitPolicies.Login, 5, TimeSpan.FromMinutes(1));
    PerIp(RateLimitPolicies.PlaceOrder, 10, TimeSpan.FromMinutes(10));
    PerIp(RateLimitPolicies.Tracking, 30, TimeSpan.FromMinutes(1));
    PerIp(RateLimitPolicies.PublicRead, 120, TimeSpan.FromMinutes(1));
    PerIp(RateLimitPolicies.Estimate, 60, TimeSpan.FromMinutes(1));
    options.OnRejected = (context, _) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        return ValueTask.CompletedTask;
    };
});

var app = builder.Build();

if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
    await app.Services.MigrateAndSeedAsync();

// First: the real client IP (for logs and rate limits) and the security headers (also on errors).
app.UseMiddleware<ClientIpMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

// Request logging wraps the exception handler, so it logs the final status (409, 404…), not a 500.
app.UseSerilogRequestLogging();
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// HTTPS is terminated by Caddy/Cloudflare in production, so no HTTPS redirection here.
app.UseMiddleware<CsrfHeaderMiddleware>();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// GET /health -> { "status": "Healthy", "db": "Healthy", "storage": "Healthy" }. 503 only when the database is down.
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResultStatusCodes =
    {
        [HealthStatus.Healthy] = StatusCodes.Status200OK,
        [HealthStatus.Degraded] = StatusCodes.Status200OK,
        [HealthStatus.Unhealthy] = StatusCodes.Status503ServiceUnavailable,
    },
    ResponseWriter = (context, report) =>
    {
        context.Response.ContentType = "application/json";
        context.Response.Headers.CacheControl = "no-store";
        string Status(string name) => report.Entries.TryGetValue(name, out var e) ? e.Status.ToString() : "Unknown";
        return context.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            db = Status(HealthCheckNames.Database),
            storage = Status(HealthCheckNames.Storage),
        }));
    },
}).DisableRateLimiting();

app.Run();

// Lets integration tests start the API with WebApplicationFactory<Program>.
public partial class Program;
