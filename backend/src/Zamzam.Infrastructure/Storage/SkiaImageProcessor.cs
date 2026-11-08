using SkiaSharp;
using Zamzam.Application.Common;

namespace Zamzam.Infrastructure.Storage;

// Phone photo in → three WebP sizes out (400 / 800 / 1600 px wide), upright, with no EXIF/GPS data.
// Re-encoding from raw pixels drops every metadata block the original file carried.
public sealed class SkiaImageProcessor : IImageProcessor
{
    public const int MaxMegapixels = 40;         // the photo as taken: refuse "decompression bombs" before decoding
    public const int MaxDecodedMegapixels = 16;  // what we hold in memory at once (about 64 MB)
    private const int WebpQuality = 80;

    public async Task<IReadOnlyList<ProcessedImage>> ToWebpSizesAsync(Stream input, CancellationToken cancellationToken)
    {
        // PhotoUpload has already read the upload into memory: decode it there instead of copying it again.
        var buffer = input as MemoryStream;
        if (buffer is null)
        {
            buffer = new MemoryStream();
            await input.CopyToAsync(buffer, cancellationToken);
        }
        buffer.Position = 0;

        try
        {
            using var stream = new SKManagedStream(buffer, disposeManagedStream: false);
            using var codec = SKCodec.Create(stream) ?? throw Unreadable();
            if ((long)codec.Info.Width * codec.Info.Height > MaxMegapixels * 1_000_000L)
                throw TooLarge($"Photos must be {MaxMegapixels} megapixels or less.");

            using var decoded = DecodeScaled(codec) ?? throw Unreadable();
            using var upright = ApplyOrientation(decoded, codec.EncodedOrigin);
            return Encode(upright, cancellationToken);
        }
        finally
        {
            if (!ReferenceEquals(buffer, input)) buffer.Dispose();
        }
    }

    private static IReadOnlyList<ProcessedImage> Encode(SKBitmap upright, CancellationToken cancellationToken)
    {
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

    // A 6000 px phone photo only needs about 1600 px. JPEG and WebP can decode straight to a smaller size
    // (JPEG in 1/8 steps), so a 40 MP photo takes ~10 MB instead of ~160 MB. PNG always decodes at full size.
    private static SKBitmap? DecodeScaled(SKCodec codec)
    {
        var swap = SwapsSides(codec.EncodedOrigin); // the width we keep is the width after rotation
        var fullWidth = swap ? codec.Info.Height : codec.Info.Width;
        var needed = Math.Min(ImageSizes.Widths.Max(), fullWidth);

        var size = codec.Info.Size;
        for (var eighths = 1; eighths < 8; eighths++)
        {
            var candidate = codec.GetScaledDimensions(eighths / 8f);
            if ((swap ? candidate.Height : candidate.Width) >= needed) { size = candidate; break; }
        }
        if ((long)size.Width * size.Height > MaxDecodedMegapixels * 1_000_000L)
            throw TooLarge("This photo is too large to process. Send it as a JPG, or a smaller photo.");

        var alpha = codec.Info.AlphaType == SKAlphaType.Unpremul ? SKAlphaType.Premul : codec.Info.AlphaType;
        var info = codec.Info.WithSize(size.Width, size.Height).WithAlphaType(alpha);
        var bitmap = new SKBitmap(info);
        if (codec.GetPixels(info, bitmap.GetPixels()) == SKCodecResult.Success) return bitmap;
        bitmap.Dispose(); // a cut-off or broken file: refuse it rather than store a half-grey photo
        return null;
    }

    private static bool SwapsSides(SKEncodedOrigin origin) =>
        origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;

    private static FileRejectedException TooLarge(string message) => new(413, FileRejectedException.TooLarge, message);

    private static FileRejectedException Unreadable() =>
        new(415, FileRejectedException.UnsupportedType, "This file isn't a readable photo.");

    // Phones save photos sideways and store "rotate me" in EXIF. We bake the rotation into the pixels,
    // because the EXIF data is removed when we re-encode.
    private static SKBitmap ApplyOrientation(SKBitmap source, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft) return source.Copy();

        var swap = SwapsSides(origin);
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
