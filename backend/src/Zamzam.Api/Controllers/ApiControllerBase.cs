using Microsoft.AspNetCore.Mvc;

namespace Zamzam.Api.Controllers;

[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    // A ProblemDetails response with our machine-readable code (and traceId, added by the framework).
    protected ObjectResult ProblemWithCode(int status, string code, string title, string? detail = null,
        IDictionary<string, object?>? extra = null)
    {
        var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, status, title,
            $"https://zamzam.app/errors/{code.ToLowerInvariant().Replace('_', '-')}", detail);
        problem.Extensions["code"] = code;
        foreach (var (key, value) in extra ?? new Dictionary<string, object?>()) problem.Extensions[key] = value;
        return new ObjectResult(problem) { StatusCode = status };
    }
}
