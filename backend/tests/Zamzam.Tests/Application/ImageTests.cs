using SkiaSharp;
using Zamzam.Application.Catalog.Admin;
using Zamzam.Application.Common;
using Zamzam.Domain.Exceptions;
using Zamzam.Infrastructure.Storage;

namespace Zamzam.Tests.Application;

public class ImageUploadTests
{
    private static UploadProductImageHandler Handler(TestDb t) =>
        new(t.Db, t.Storage, new FakeImageProcessor(), Log.For<UploadProductImageHandler>());

    private static UploadProductImageCommand Upload(int productId, byte[] bytes, long? length = null) =>
        new(productId, new MemoryStream(bytes), length ?? bytes.Length, "عباية", "Abaya front");

    [Fact]
    public async Task Upload_stores_three_sizes_and_the_first_photo_is_the_main_one()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));

        var image = await Handler(t).HandleAsync(Upload(product.Id, AdminProductTests.Jpeg), CancellationToken.None);

        Assert.Equal(0, image.SortOrder);
        Assert.EndsWith("-800.webp", image.Url);
        Assert.Contains("-400.webp 400w", image.SrcSet);
        Assert.Equal(3, t.Storage.Files.Count);
        Assert.All(t.Storage.Files.Keys, key => Assert.StartsWith($"products/{product.Id}/", key));
    }

    [Fact]
    public async Task Too_large_files_are_refused_with_413()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));

        var error = await Assert.ThrowsAsync<FileRejectedException>(() =>
            Handler(t).HandleAsync(Upload(product.Id, AdminProductTests.Jpeg, length: ImageSizes.MaxUploadBytes + 1), CancellationToken.None));

        Assert.Equal(413, error.StatusCode);
        Assert.Empty(t.Storage.Files);
    }

    [Fact]
    public async Task A_renamed_non_image_file_is_refused_with_415()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));

        var error = await Assert.ThrowsAsync<FileRejectedException>(() =>
            Handler(t).HandleAsync(Upload(product.Id, "%PDF-1.7 not a photo"u8.ToArray()), CancellationToken.None));

        Assert.Equal(415, error.StatusCode);
    }

    [Fact]
    public async Task The_eleventh_photo_is_refused_before_anything_is_uploaded()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        for (var i = 0; i < 10; i++) await Handler(t).HandleAsync(Upload(product.Id, AdminProductTests.Jpeg), CancellationToken.None);
        var filesBefore = t.Storage.Files.Count;

        await Assert.ThrowsAsync<DomainException>(() => Handler(t).HandleAsync(Upload(product.Id, AdminProductTests.Jpeg), CancellationToken.None));

        Assert.Equal(filesBefore, t.Storage.Files.Count);
    }

    [Fact]
    public async Task If_storage_fails_halfway_the_uploaded_files_are_cleaned_up()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        t.Storage.FailUploads = true; // first file succeeds, second throws

        await Assert.ThrowsAsync<InvalidOperationException>(() => Handler(t).HandleAsync(Upload(product.Id, AdminProductTests.Jpeg), CancellationToken.None));

        Assert.Empty(t.Storage.Files);
        t.Reload();
        Assert.Empty(t.Db.ProductImages);
    }

    [Fact]
    public async Task Deleting_the_main_photo_promotes_the_next_and_removes_the_files()
    {
        using var t = TestDb.WithCatalog();
        var product = t.AddProduct(t.Abayas, "Modest Abaya", 1250, ("M", t.Beige, 2));
        var first = await Handler(t).HandleAsync(Upload(product.Id, AdminProductTests.Jpeg), CancellationToken.None);
        var second = await Handler(t).HandleAsync(Upload(product.Id, AdminProductTests.Jpeg), CancellationToken.None);

        await new DeleteProductImageHandler(t.Db, t.Storage, Log.For<DeleteProductImageHandler>()).HandleAsync(first.Id, CancellationToken.None);

        Assert.Equal(3, t.Storage.Files.Count);
        t.Reload();
        Assert.Equal(0, t.Db.ProductImages.Single(i => i.Id == second.Id).SortOrder);
    }

    [Theory]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "image/jpeg")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "image/png")]
    [InlineData(new byte[] { 0x47, 0x49, 0x46, 0x38 }, null)] // GIF is not accepted
    public void File_type_comes_from_the_bytes_not_the_name(byte[] header, string? expected) =>
        Assert.Equal(expected, ImageFileType.Detect(header));
}

public class SkiaImageProcessorTests
{
    private static byte[] Photo(int width, int height, SKEncodedImageFormat format = SKEncodedImageFormat.Jpeg)
    {
        using var bitmap = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bitmap)) canvas.Clear(new SKColor(0xD6, 0xB9, 0x95));
        using var image = SKImage.FromBitmap(bitmap);
        return image.Encode(format, 90).ToArray();
    }

    [Fact]
    public async Task A_large_photo_becomes_three_webp_files_400_800_1600_wide()
    {
        var results = await new SkiaImageProcessor().ToWebpSizesAsync(new MemoryStream(Photo(2400, 3200)), CancellationToken.None);

        Assert.Equal([400, 800, 1600], results.Select(r => r.Width));
        foreach (var result in results)
        {
            using var decoded = SKBitmap.Decode(result.Content);
            using var codec = SKCodec.Create(new MemoryStream(result.Content));
            Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat);
            Assert.Equal(result.Width, decoded.Width);
            Assert.Equal((int)Math.Round(result.Width * 4 / 3.0), decoded.Height); // aspect ratio kept
        }
    }

    [Fact]
    public async Task A_small_photo_is_never_upscaled()
    {
        var results = await new SkiaImageProcessor().ToWebpSizesAsync(new MemoryStream(Photo(600, 600, SKEncodedImageFormat.Png)), CancellationToken.None);

        using var largest = SKBitmap.Decode(results.Single(r => r.Width == 1600).Content);
        Assert.Equal(600, largest.Width);
    }

    [Fact]
    public async Task A_huge_jpeg_is_decoded_scaled_down_and_still_gives_a_full_1600_px_file()
    {
        // 6400 x 4800 = 30.7 MP: at full size that's ~123 MB of pixels, over the 16 MP in-memory limit.
        var results = await new SkiaImageProcessor().ToWebpSizesAsync(new MemoryStream(Photo(6400, 4800)), CancellationToken.None);

        using var largest = SKBitmap.Decode(results.Single(r => r.Width == 1600).Content);
        Assert.Equal(1600, largest.Width);
        Assert.Equal(1200, largest.Height);
    }

    [Fact]
    public async Task A_huge_png_that_cant_be_decoded_smaller_is_refused_with_413()
    {
        // PNG has no scaled decoding, so 4500 x 4000 = 18 MP would all sit in memory.
        var error = await Assert.ThrowsAsync<FileRejectedException>(() =>
            new SkiaImageProcessor().ToWebpSizesAsync(new MemoryStream(Photo(4500, 4000, SKEncodedImageFormat.Png)), CancellationToken.None));

        Assert.Equal(413, error.StatusCode);
    }

    [Fact]
    public async Task The_callers_buffer_is_read_in_place_and_left_open()
    {
        var buffer = new MemoryStream(Photo(1000, 800));

        await new SkiaImageProcessor().ToWebpSizesAsync(buffer, CancellationToken.None);

        Assert.True(buffer.CanRead); // not copied and not disposed: PhotoUpload still owns it
    }

    [Fact]
    public async Task Garbage_bytes_are_refused_with_415()
    {
        var bytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4, 5 }; // JPEG header, broken body

        var error = await Assert.ThrowsAsync<FileRejectedException>(() =>
            new SkiaImageProcessor().ToWebpSizesAsync(new MemoryStream(bytes), CancellationToken.None));

        Assert.Equal(415, error.StatusCode);
    }
}
