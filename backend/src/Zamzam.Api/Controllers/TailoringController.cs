using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Zamzam.Api.Errors;
using Zamzam.Api.Security;
using Zamzam.Application.Orders;
using Zamzam.Application.Tailoring;

namespace Zamzam.Api.Controllers;

// APIs #12–16: the made-to-measure flow for customers. No login; quote answers use the private tracking token.
[Route("api")]
[AllowAnonymous]
public sealed class TailoringController : ApiControllerBase
{
    // #12
    [HttpGet("tailoring/catalog")]
    [EnableRateLimiting(RateLimitPolicies.PublicRead)]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public Task<PublicTailoringCatalog> Catalog([FromServices] GetPublicTailoringCatalogHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #13 — the live price while the customer fills in the form
    [HttpPost("tailoring/estimate")]
    [EnableRateLimiting(RateLimitPolicies.Estimate)]
    public Task<EstimateResult> Estimate(EstimateCommand command, [FromServices] EstimateHandler handler, CancellationToken ct) =>
        handler.HandleAsync(command, ct);

    // #14 multipart/form-data: "data" = the request as JSON, "referenceImage" = optional photo (max 5 MB)
    [HttpPost("tailoring/requests")]
    [Idempotent]
    [EnableRateLimiting(RateLimitPolicies.PlaceOrder)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [ProducesResponseType<PlacedTailoringRequestDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> PlaceRequest([FromForm] string data, IFormFile? referenceImage,
        [FromServices] IValidator<TailoringRequestCommand> validator, [FromServices] IOptions<JsonOptions> json,
        [FromServices] PlaceTailoringRequestHandler handler, CancellationToken ct)
    {
        TailoringRequestCommand? command;
        try { command = JsonSerializer.Deserialize<TailoringRequestCommand>(data, json.Value.JsonSerializerOptions); }
        catch (JsonException) { command = null; }
        if (command is null)
        {
            ModelState.AddModelError("data", "The 'data' field must be the request as JSON.");
            return ValidationProblem(ModelState);
        }

        var result = await validator.ValidateAsync(command, ct);
        if (!result.IsValid)
        {
            foreach (var error in result.Errors) ModelState.AddModelError(ValidationFilter.CamelCase(error.PropertyName), error.ErrorMessage);
            return ValidationProblem(ModelState);
        }

        await using var photo = referenceImage?.OpenReadStream();
        var placed = await handler.HandleAsync(command, photo, referenceImage?.Length ?? 0, ct);
        return Created($"/api/orders/{placed.Number}", placed);
    }

    // #15 — header X-Tracking-Token
    [HttpPost("orders/{number}/quote/approve")]
    [EnableRateLimiting(RateLimitPolicies.Tracking)]
    public Task<PublicOrderDto> Approve(string number, [FromHeader(Name = OrdersController.TrackingHeader)] string? token,
        [FromServices] AnswerQuoteHandler handler, CancellationToken ct) =>
        handler.ApproveAsync(number, token, ct);

    // #16 — header X-Tracking-Token, body { "reason": "Too expensive" } (optional)
    [HttpPost("orders/{number}/quote/reject")]
    [EnableRateLimiting(RateLimitPolicies.Tracking)]
    public Task<PublicOrderDto> Reject(string number, [FromHeader(Name = OrdersController.TrackingHeader)] string? token,
        [FromBody] RejectQuoteCommand? command, [FromServices] AnswerQuoteHandler handler, CancellationToken ct) =>
        handler.RejectAsync(number, token, command ?? new RejectQuoteCommand(null), ct);
}
