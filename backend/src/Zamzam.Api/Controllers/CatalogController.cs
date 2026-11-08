using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zamzam.Application.Catalog;
using Zamzam.Application.Catalog.Public;
using Zamzam.Application.Common;
using Zamzam.Application.Settings;
using Zamzam.Domain.Settings;

namespace Zamzam.Api.Controllers;

// APIs #5–8: what the public shop reads. No login.
[Route("api")]
[AllowAnonymous]
public sealed class CatalogController : ApiControllerBase
{
    // #5
    [HttpGet("categories")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public Task<IReadOnlyList<CategoryNode>> Categories([FromServices] GetCategoryTreeHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #6 ?category=dresses&q=abaya&size=M&size=L&color=3&minPrice=&maxPrice=&inStock=true&sort=newest&page=1&pageSize=20
    // Products are cached 60 s (#6, #7): the shop stays fast and an owner's edit shows within a minute.
    // Checkout re-checks stock and price, so a minute-old card can't sell what isn't there.
    [HttpGet("products")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public Task<Paged<ProductCard>> Products([FromQuery] SearchProductsQuery query,
        [FromServices] SearchProductsHandler handler, CancellationToken ct) =>
        handler.HandleAsync(query, ct);

    // #7
    [HttpGet("products/{slug}")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
    public Task<ProductDetail> Product(string slug, [FromServices] GetProductBySlugHandler handler, CancellationToken ct) =>
        handler.HandleAsync(slug, ct);

    // #8
    [HttpGet("site-settings")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
    public Task<SiteContent> SiteSettings([FromServices] GetSiteSettingsHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);
}
