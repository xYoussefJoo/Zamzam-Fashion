using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zamzam.Api.Security;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;

namespace Zamzam.Api.Controllers.Admin;

[Route("api/admin/orders")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminOrdersController : ApiControllerBase
{
    // #35 ?status=PendingConfirmation&status=Confirmed&type=Ready&q=ZF-10001&from=&to=&page=1
    [HttpGet]
    public Task<Paged<AdminOrderRow>> List([FromQuery] AdminOrdersQuery query, [FromServices] ListAdminOrdersHandler handler, CancellationToken ct) =>
        handler.HandleAsync(query, ct);

    // #36
    [HttpGet("{id:int}")]
    public Task<AdminOrderDetail> Get(int id, [FromServices] GetAdminOrderHandler handler, CancellationToken ct) =>
        handler.HandleAsync(id, ct);

    // #37 { "to": "Confirmed", "note": "Confirmed by phone" }
    [HttpPost("{id:int}/status")]
    public Task<AdminOrderDetail> ChangeStatus(int id, ChangeOrderStatusCommand command, [FromServices] ChangeOrderStatusHandler handler,
        CancellationToken ct) =>
        handler.HandleAsync(id, command, User.FindFirstValue(ClaimTypes.NameIdentifier), ct);
}

[Route("api/admin/delivery-zones")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminDeliveryZonesController : ApiControllerBase
{
    // #41
    [HttpGet]
    public Task<IReadOnlyList<AdminZoneDto>> List([FromServices] ListAdminDeliveryZonesHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #42 [ { "id": 1, "fee": 65, "etaDaysMin": 1, "etaDaysMax": 3, "isActive": true } ]
    [HttpPut]
    public Task<IReadOnlyList<AdminZoneDto>> Update(List<ZoneUpdate> zones, [FromServices] UpdateDeliveryZonesHandler handler, CancellationToken ct) =>
        handler.HandleAsync(zones, ct);
}
