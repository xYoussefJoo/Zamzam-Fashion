using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zamzam.Api.Security;
using Zamzam.Application.Orders;
using Zamzam.Application.Settings;
using Zamzam.Application.Tailoring;
using Zamzam.Domain.Settings;

namespace Zamzam.Api.Controllers.Admin;

// #38 — confirm or change a custom order's price. Lives next to the other order actions.
[Route("api/admin/orders")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminQuotesController : ApiControllerBase
{
    // { "price": 2400, "note": "Lined crepe", "validDays": 7 } → order + customerLink (only when the price changed)
    [HttpPost("{id:int}/quote")]
    public Task<QuoteResult> SendQuote(int id, SendQuoteCommand command, [FromServices] SendQuoteHandler handler, CancellationToken ct) =>
        handler.HandleAsync(id, command, User.FindFirstValue(ClaimTypes.NameIdentifier), ct);
}

[Route("api/admin/tailoring")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminTailoringController : ApiControllerBase
{
    // #39
    [HttpGet("catalog")]
    public Task<TailoringCatalogContent> Catalog([FromServices] GetAdminTailoringCatalogHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #40 — the whole catalog at once
    [HttpPut("catalog")]
    public Task<TailoringCatalogContent> UpdateCatalog(TailoringCatalogContent content, [FromServices] UpdateTailoringCatalogHandler handler,
        CancellationToken ct) => handler.HandleAsync(content, ct);

    // #45
    [HttpGet("pricing")]
    public Task<PriceRulesContent> Pricing([FromServices] GetPriceRulesHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #46 — new estimates use these prices immediately
    [HttpPut("pricing")]
    public Task<PriceRulesContent> UpdatePricing(PriceRulesContent content, [FromServices] UpdatePriceRulesHandler handler, CancellationToken ct) =>
        handler.HandleAsync(content, ct);
}

[Route("api/admin")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminSiteController : ApiControllerBase
{
    // #43
    [HttpGet("site-settings")]
    public Task<SiteContent> SiteSettings([FromServices] GetAdminSiteSettingsHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #44
    [HttpPut("site-settings")]
    public Task<SiteContent> UpdateSiteSettings(SiteContent content, [FromServices] UpdateSiteSettingsHandler handler, CancellationToken ct) =>
        handler.HandleAsync(content, ct);

    // #47
    [HttpGet("dashboard")]
    public Task<DashboardDto> Dashboard([FromServices] GetDashboardHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);
}
