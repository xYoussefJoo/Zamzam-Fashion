using SkiaSharp;
using Zamzam.Application.Common;

namespace Zamzam.Infrastructure.Storage;

// Phone photo in → three WebP sizes out (400 / 800 / 1600 px wide), upright, with no EXIF/GPS data.
// Re-encoding from raw pixels drops every metadata block the original file carried.
public sealed class SkiaImageProcessor : IImageProcessor
{
    public const int MaxMegapixels = 40;  // refuse "decompression bombs" before decoding
    private const int WebpQuality = 80;

    public async Task<IReadOnlyList<ProcessedImage>> ToWebpSizesAsync(Stream input, CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        await input.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        using var codec = SKCodec.Create(buffer) ?? throw Unreadable();
        if ((long)codec.Info.Width * codec.Info.Height > MaxMegapixels * 1_000_000L)
            throw new FileRejectedException(413, FileRejectedException.TooLarge, $"Photos must be {MaxMegapixels} megapixels or less.");

        using var decoded = SKBitmap.Decode(codec) ?? throw Unreadable();
        using var upright = ApplyOrientation(decoded, codec.EncodedOrigin);

        var results = new List<ProcessedImage>();
        foreach (var width in ImageSizes.Widths)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var targetWidth = Math.Min(width, upright.Width); // never upscale a small photo
            var targetHeight = Math.Max(1, (int)Math.Round(upright.Height * (targetWidth / (double)upright.Width)));

            using var resized = upright.Resize(new SKImageInfo(targetWidth, targetHeight),
                new SKSamplingOptions(SKCubicResampler.Mitchell)) ?? throw Unreadable();
            using var image = SKImage.FromBitmap(resized);
            using var webp = image.Encode(SKEncodedImageFormat.Webp, WebpQuality) ?? throw Unreadable();
            results.Add(new ProcessedImage(width, webp.ToArray()));
        }
        return results;
    }

    private static FileRejectedException Unreadable() =>
        new(415, FileRejectedException.UnsupportedType, "This file isn't a readable photo.");

    // Phones save photos sideways and store "rotate me" in EXIF. We bake the rotation into the pixels,
    // because the EXIF data is removed when we re-encode.
    private static SKBitmap ApplyOrientation(SKBitmap source, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft) return source.Copy();

        var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop
            or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var width = swap ? source.Height : source.Width;
        var height = swap ? source.Width : source.Height;
        var result = new SKBitmap(width, height, source.ColorType, source.AlphaType);

        using var canvas = new SKCanvas(result);
        switch (origin)
        {
            case SKEncodedOrigin.TopRight: canvas.Translate(width, 0); canvas.Scale(-1, 1); break;              // mirrored
            case SKEncodedOrigin.BottomRight: canvas.Translate(width, height); canvas.RotateDegrees(180); break; // upside down
            case SKEncodedOrigin.BottomLeft: canvas.Translate(0, height); canvas.Scale(1, -1); break;           // flipped
            case SKEncodedOrigin.LeftTop: canvas.Scale(-1, 1); canvas.RotateDegrees(90); break;                 // transposed
            case SKEncodedOrigin.RightTop: canvas.Translate(width, 0); canvas.RotateDegrees(90); break;         // 90° clockwise
            case SKEncodedOrigin.RightBottom: canvas.Translate(width, height); canvas.Scale(1, -1); canvas.RotateDegrees(90); break;
            case SKEncodedOrigin.LeftBottom: canvas.Translate(0, height); canvas.RotateDegrees(270); break;     // 90° counter-clockwise
        }
        using var sourceImage = SKImage.FromBitmap(source);
        canvas.DrawImage(sourceImage, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest)); // 90° steps: no resampling needed
        return result;
    }
}
