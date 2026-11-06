using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Zamzam.Infrastructure.Persistence;

namespace Zamzam.Api.Errors;

// Put [Idempotent] on an action that creates an order. The client sends "Idempotency-Key: <uuid>" once per
// attempt; a double click or refresh with the same key gets the first answer back instead of a second order.
[AttributeUsage(AttributeTargets.Method)]
public sealed class IdempotentAttribute : TypeFilterAttribute
{
    public IdempotentAttribute() : base(typeof(IdempotencyFilter)) { }
}

public sealed class IdempotencyFilter(ZamzamDbContext db, ProblemDetailsFactory problems, TimeProvider clock,
    IOptions<JsonOptions> mvcJson) : IAsyncActionFilter
{
    public const string HeaderName = "Idempotency-Key";
    private static readonly TimeSpan KeepFor = TimeSpan.FromHours(24);
    private const int InProgress = 0;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var http = context.HttpContext;
        var key = http.Request.Headers[HeaderName].ToString().Trim();
        if (key.Length is < 8 or > 100)
        {
            context.Result = Problem(http, 400, "IDEMPOTENCY_KEY_REQUIRED", "Send a unique Idempotency-Key header (a UUID) with this request.");
            return;
        }

        var endpoint = $"{http.Request.Method} {context.ActionDescriptor.AttributeRouteInfo?.Template}";
        // Only what the client sent (body, route, form) — never injected services.
        var sent = context.ActionDescriptor.Parameters
            .Where(p => p.BindingInfo?.BindingSource is { } source
                && (source == BindingSource.Body || source == BindingSource.Path || source == BindingSource.Form))
            .Select(p => context.ActionArguments.TryGetValue(p.Name, out var value) ? value : null);
        var requestHash = Hash(endpoint, sent, mvcJson.Value.JsonSerializerOptions);
        var now = clock.GetUtcNow().UtcDateTime;

        // Housekeeping: keys older than 24 h are forgotten.
        await db.IdempotencyKeys.Where(r => r.CreatedAt < now - KeepFor).ExecuteDeleteAsync(http.RequestAborted);

        var existing = await db.IdempotencyKeys.AsNoTracking().FirstOrDefaultAsync(r => r.Key == key, http.RequestAborted);
        if (existing is not null)
        {
            context.Result = Replay(http, existing, endpoint, requestHash);
            return;
        }

        // Reserve the key first, so two identical requests arriving together can't both create an order.
        try
        {
            db.IdempotencyKeys.Add(new IdempotencyRecord
            {
                Key = key, Endpoint = endpoint, RequestHash = requestHash, StatusCode = InProgress, ResponseJson = "null", CreatedAt = now,
            });
            await db.SaveChangesAsync(http.RequestAborted);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            var other = await db.IdempotencyKeys.AsNoTracking().FirstAsync(r => r.Key == key, http.RequestAborted);
            context.Result = Replay(http, other, endpoint, requestHash);
            return;
        }
        db.ChangeTracker.Clear();

        var executed = await next();

        // Remember successful answers; forget the key after a failure so the client can simply try again.
        var record = await db.IdempotencyKeys.FirstAsync(r => r.Key == key);
        if (executed.Exception is null && executed.Result is ObjectResult { StatusCode: >= 200 and < 300 } ok)
        {
            record.StatusCode = ok.StatusCode!.Value;
            record.ResponseJson = JsonSerializer.Serialize(ok.Value, mvcJson.Value.JsonSerializerOptions);
        }
        else
        {
            db.IdempotencyKeys.Remove(record);
        }
        await db.SaveChangesAsync(CancellationToken.None);
    }

    private IActionResult Replay(HttpContext http, IdempotencyRecord record, string endpoint, string requestHash)
    {
        if (record.Endpoint != endpoint || record.RequestHash != requestHash)
            return Problem(http, 422, "IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for a different request.");
        if (record.StatusCode == InProgress)
            return Problem(http, 409, "REQUEST_IN_PROGRESS", "The same request is still being processed. Wait a moment and check again.");

        http.Response.Headers["Idempotent-Replay"] = "true";
        return new ContentResult { StatusCode = record.StatusCode, Content = record.ResponseJson, ContentType = "application/json" };
    }

    private ObjectResult Problem(HttpContext http, int status, string code, string detail)
    {
        var problem = problems.CreateProblemDetails(http, status, "Request refused", $"https://zamzam.app/errors/{code.ToLowerInvariant().Replace('_', '-')}", detail);
        problem.Extensions["code"] = code;
        return new ObjectResult(problem) { StatusCode = status };
    }

    private static string Hash(string endpoint, IEnumerable<object?> arguments, JsonSerializerOptions json)
    {
        var body = string.Join("|", arguments.Select(a => JsonSerializer.Serialize(a, json)));
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(endpoint + "\n" + body)));
    }
}
