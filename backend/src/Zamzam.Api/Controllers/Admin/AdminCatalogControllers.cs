using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zamzam.Api.Security;
using Zamzam.Application.Catalog;
using Zamzam.Application.Catalog.Admin;
using Zamzam.Application.Common;

namespace Zamzam.Api.Controllers.Admin;

// APIs #17–34: the owner's catalog management. Controllers only translate HTTP <-> use case.

[Route("api/admin/categories")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminCategoriesController : ApiControllerBase
{
    // #17
    [HttpGet]
    public Task<IReadOnlyList<AdminCategoryNode>> List([FromServices] ListAdminCategoriesHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #18
    [HttpPost]
    public async Task<IActionResult> Create(SaveCategoryCommand command, [FromServices] CreateCategoryHandler handler, CancellationToken ct)
    {
        var created = await handler.HandleAsync(command, ct);
        return Created($"/api/admin/categories/{created.Id}", created);
    }

    // #19
    [HttpPut("{id:int}")]
    public Task<AdminCategoryNode> Update(int id, SaveCategoryCommand command, [FromServices] UpdateCategoryHandler handler, CancellationToken ct) =>
        handler.HandleAsync(id, command, ct);

    // #20
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromServices] DeleteCategoryHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }
}

[Route("api/admin/products")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminProductsController : ApiControllerBase
{
    // #21
    [HttpGet]
    public Task<Paged<AdminProductRow>> List([FromQuery] AdminProductsQuery query, [FromServices] ListAdminProductsHandler handler, CancellationToken ct) =>
        handler.HandleAsync(query, ct);

    // #22
    [HttpGet("{id:int}")]
    public Task<AdminProductDetail> Get(int id, [FromServices] GetAdminProductHandler handler, CancellationToken ct) =>
        handler.HandleAsync(id, ct);

    // #23
    [HttpPost]
    public async Task<IActionResult> Create(CreateProductCommand command, [FromServices] CreateProductHandler handler, CancellationToken ct)
    {
        var created = await handler.HandleAsync(command, ct);
        return Created($"/api/admin/products/{created.Id}", created);
    }

    // #24 (show/hide is part of the update: isVisible)
    [HttpPut("{id:int}")]
    public Task<AdminProductDetail> Update(int id, UpdateProductCommand command, [FromServices] UpdateProductHandler handler, CancellationToken ct) =>
        handler.HandleAsync(id, command, ct);

    // #25 — soft delete when the product was ever ordered
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromServices] DeleteProductHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }

    // #26
    [HttpPost("{id:int}/variants")]
    public async Task<IActionResult> AddVariant(int id, NewVariant command, [FromServices] AddVariantHandler handler, CancellationToken ct)
    {
        var created = await handler.HandleAsync(id, command, ct);
        return Created($"/api/admin/variants/{created.Id}", created);
    }

    // #29 multipart/form-data: file, altAr, altEn
    [HttpPost("{id:int}/images")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(int id, IFormFile file, [FromForm] string? altAr, [FromForm] string? altEn,
        [FromServices] UploadProductImageHandler handler, CancellationToken ct)
    {
        await using var content = file.OpenReadStream();
        var image = await handler.HandleAsync(new UploadProductImageCommand(id, content, file.Length, altAr, altEn), ct);
        return Created($"/api/admin/images/{image.Id}", image);
    }
}

[Route("api/admin/variants")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminVariantsController : ApiControllerBase
{
    // #27 — send the "version" you loaded; 409 CONCURRENCY_CONFLICT if it changed meanwhile
    [HttpPut("{id:int}")]
    public Task<AdminVariantDto> Update(int id, UpdateVariantCommand command, [FromServices] UpdateVariantHandler handler, CancellationToken ct) =>
        handler.HandleAsync(id, command, ct);

    // #28
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromServices] DeleteVariantHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }
}

[Route("api/admin/images")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminImagesController : ApiControllerBase
{
    // #30
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromServices] DeleteProductImageHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }
}

[Route("api/admin/colors")]
[Authorize(Policy = Policies.Owner)]
public sealed class AdminColorsController : ApiControllerBase
{
    // #31
    [HttpGet]
    public Task<IReadOnlyList<AdminColorDto>> List([FromServices] ListColorsHandler handler, CancellationToken ct) =>
        handler.HandleAsync(ct);

    // #32
    [HttpPost]
    public async Task<IActionResult> Create(SaveColorCommand command, [FromServices] CreateColorHandler handler, CancellationToken ct)
    {
        var created = await handler.HandleAsync(command, ct);
        return Created($"/api/admin/colors/{created.Id}", created);
    }

    // #33
    [HttpPut("{id:int}")]
    public Task<AdminColorDto> Update(int id, SaveColorCommand command, [FromServices] UpdateColorHandler handler, CancellationToken ct) =>
        handler.HandleAsync(id, command, ct);

    // #34
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromServices] DeleteColorHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }
}
