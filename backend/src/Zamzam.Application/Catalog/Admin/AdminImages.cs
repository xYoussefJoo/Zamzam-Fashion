using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Zamzam.Application.Common;

namespace Zamzam.Application.Catalog.Admin;

public sealed record UploadProductImageCommand(int ProductId, Stream Content, long Length, string? AltAr, string? AltEn);

// #29 POST /api/admin/products/{id}/images
// check size → check real file type → resize to WebP 400/800/1600 without EXIF → upload → save.
public sealed class UploadProductImageHandler(IAppDbContext db, IImageStorage storage, IImageProcessor processor,
    ILogger<UploadProductImageHandler> logger)
{
    public async Task<ImageDto> HandleAsync(UploadProductImageCommand command, CancellationToken ct)
    {
        using var buffer = await PhotoUpload.ReadCheckedAsync(command.Content, command.Length, ct);

        var product = await db.Products.Include(p => p.Images)
            .FirstOrDefaultAsync(p => p.Id == command.ProductId && !p.IsDeleted, ct)
            ?? throw new NotFoundException("Product");

        // The domain checks the 10-photo limit before any file is processed or uploaded.
        var storageKey = $"products/{product.Id}/{Guid.NewGuid():N}";
        var image = product.AddImage(storageKey, command.AltAr, command.AltEn);

        buffer.Position = 0;
        var sizes = await processor.ToWebpSizesAsync(buffer, ct);

        var uploaded = new List<string>();
        try
        {
            foreach (var size in sizes)
            {
                var file = ImageKeys.ForWidth(storageKey, size.Width);
                await storage.UploadPublicAsync(file, size.Content, "image/webp", ct);
                uploaded.Add(file);
            }
            await db.SaveChangesAsync(ct);
        }
        catch
        {
            await StorageCleanup.DeleteQuietlyAsync(storage, uploaded, logger, CancellationToken.None);
            throw;
        }

        return storage.ToImageDto(image.Id, image.StorageKey, image.AltAr, image.AltEn, image.SortOrder);
    }
}

// #30 DELETE /api/admin/images/{id} — the next photo becomes the main one.
public sealed class DeleteProductImageHandler(IAppDbContext db, IImageStorage storage, ILogger<DeleteProductImageHandler> logger)
{
    public async Task HandleAsync(int id, CancellationToken ct)
    {
        var productId = await db.ProductImages.Where(i => i.Id == id).Select(i => (int?)i.ProductId).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Photo");
        var product = await db.Products.Include(p => p.Images).FirstAsync(p => p.Id == productId, ct);

        var removed = product.RemoveImage(id);
        await db.SaveChangesAsync(ct);
        await StorageCleanup.DeleteQuietlyAsync(storage, ImageKeys.AllFiles(removed.StorageKey), logger, ct);
    }
}
