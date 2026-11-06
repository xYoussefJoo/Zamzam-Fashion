using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Serilog;
using Zamzam.Api.Errors;
using Zamzam.Api.Security;
using Zamzam.Application;
using Zamzam.Domain.Constants;
using Zamzam.Infrastructure;
using Zamzam.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, config) => config
    .ReadFrom.Configuration(context.Configuration)
    .WriteTo.Console());

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services
    .AddControllers(options => options.Filters.Add<ValidationFilter>())
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();

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
    void PerIp(string policy, int permits, TimeSpan window) => options.AddPolicy(policy, context =>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = permits, Window = window }));

    PerIp(RateLimitPolicies.Login, 5, TimeSpan.FromMinutes(1));
    PerIp(RateLimitPolicies.PlaceOrder, 10, TimeSpan.FromMinutes(10));
    PerIp(RateLimitPolicies.Tracking, 30, TimeSpan.FromMinutes(1));
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
app.MapHealthChecks("/health");

app.Run();

// Lets integration tests start the API with WebApplicationFactory<Program>.
public partial class Program;
