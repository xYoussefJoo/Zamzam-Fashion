using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Zamzam.Api.Errors;
using Zamzam.Api.Security;
using Zamzam.Application.Orders;

namespace Zamzam.Api.Controllers;

// APIs #9–11: what customers use to order and follow their order. No login.
[Route("api")]
[AllowAnonymous]
public sealed class OrdersController : ApiControllerBase
{
    public const string TrackingHeader = "X-Tracking-Token";

    // #9
    [HttpGet("delivery-zones")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public Task<IReadOnlyList<ZoneDto>> DeliveryZones([FromServices] ListDeliveryZonesHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #10 — needs the Idempotency-Key header
    [HttpPost("orders")]
    [Idempotent]
    [EnableRateLimiting(RateLimitPolicies.PlaceOrder)]
    [ProducesResponseType<PlacedOrderDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> PlaceOrder(PlaceOrderCommand command, [FromServices] PlaceOrderHandler handler, CancellationToken ct)
    {
        var placed = await handler.HandleAsync(command, ct);
        return Created($"/api/orders/{placed.Number}", placed);
    }

    // #11 — the token goes in a header, never in the URL, so it doesn't end up in server logs
    [HttpGet("orders/{number}")]
    [EnableRateLimiting(RateLimitPolicies.Tracking)]
    public Task<PublicOrderDto> Track(string number, [FromHeader(Name = TrackingHeader)] string? token,
        [FromServices] TrackOrderHandler handler, CancellationToken ct) =>
        handler.HandleAsync(number, token, ct);
}
