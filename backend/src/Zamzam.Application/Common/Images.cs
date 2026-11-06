namespace Zamzam.Application.Common;

// Where photo files live. Supabase Storage in the app, a fake in tests.
public interface IImageStorage
{
    string PublicUrl(string objectKey);
    Task UploadPublicAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken);
    Task DeletePublicAsync(IReadOnlyCollection<string> objectKeys, CancellationToken cancellationToken);
}

// Turns an uploaded photo into small WebP files without EXIF data. ImageSharp in the app.
public interface IImageProcessor
{
    // Throws FileRejectedException (415) if the bytes aren't a readable image.
    Task<IReadOnlyList<ProcessedImage>> ToWebpSizesAsync(Stream input, CancellationToken cancellationToken);
}

public sealed record ProcessedImage(int Width, byte[] Content);

public static class ImageSizes
{
    public static readonly IReadOnlyList<int> Widths = [400, 800, 1600];
    public const int Display = 800;   // the default "url"
    public const int Thumbnail = 400; // admin tables
    public const long MaxUploadBytes = 5 * 1024 * 1024;
}

// One stored photo = one key + a size suffix per width: products/12/3f9a…-800.webp
public static class ImageKeys
{
    public static string ForWidth(string storageKey, int width) => $"{storageKey}-{width}.webp";

    public static IReadOnlyList<string> AllFiles(string storageKey) =>
        ImageSizes.Widths.Select(w => ForWidth(storageKey, w)).ToList();
}

// Checks the first bytes of the file (its "magic number"), not the file name or the browser's claim.
public static class ImageFileType
{
    public static string? Detect(ReadOnlySpan<byte> header)
    {
        if (header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF) return "image/jpeg";
        if (header.Length >= 8 && header[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return "image/png";
        if (header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8)) return "image/webp";
        return null;
    }
}
