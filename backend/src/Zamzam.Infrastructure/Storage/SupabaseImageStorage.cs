using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Zamzam.Application.Common;

namespace Zamzam.Infrastructure.Storage;

// Supabase Storage over its REST API (no SDK needed).
// Public bucket: product photos served straight to browsers. Private bucket: customers' tailoring photos.
public sealed class SupabaseImageStorage(HttpClient http, IOptions<StorageOptions> options, ILogger<SupabaseImageStorage> logger)
    : IImageStorage
{
    private readonly StorageOptions _options = options.Value;

    public string PublicUrl(string objectKey) =>
        $"{_options.BaseUrl}/storage/v1/object/public/{_options.PublicBucket}/{objectKey}";

    // File names are unique, so public photos may be cached for a year. Private ones are never cached.
    public Task UploadPublicAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken) =>
        UploadAsync(_options.PublicBucket, objectKey, content, contentType, "max-age=31536000", cancellationToken);

    public Task DeletePublicAsync(IReadOnlyCollection<string> objectKeys, CancellationToken cancellationToken) =>
        DeleteAsync(_options.PublicBucket, objectKeys, cancellationToken);

    public Task UploadPrivateAsync(string objectKey, byte[] content, string contentType, CancellationToken cancellationToken) =>
        UploadAsync(_options.PrivateBucket, objectKey, content, contentType, "no-store", cancellationToken);

    public Task DeletePrivateAsync(IReadOnlyCollection<string> objectKeys, CancellationToken cancellationToken) =>
        DeleteAsync(_options.PrivateBucket, objectKeys, cancellationToken);

    // A link that works for a short time only, e.g. 10 minutes for the owner to look at a customer's photo.
    public async Task<string> SignedPrivateUrlAsync(string objectKey, TimeSpan validFor, CancellationToken cancellationToken)
    {
        EnsureConfigured();
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_options.BaseUrl}/storage/v1/object/sign/{_options.PrivateBucket}/{objectKey}")
        {
            Content = JsonContent.Create(new { expiresIn = (int)validFor.TotalSeconds }),
        };
        Authorize(request);

        using var response = await http.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, $"sign {objectKey}", cancellationToken);
        var signed = await response.Content.ReadFromJsonAsync<SignedUrlResponse>(cancellationToken)
            ?? throw new InvalidOperationException("Storage returned no signed URL.");
        return $"{_options.BaseUrl}/storage/v1{signed.SignedURL}";
    }

    private sealed record SignedUrlResponse(string SignedURL);

    private async Task UploadAsync(string bucket, string objectKey, byte[] content, string contentType, string cacheControl, CancellationToken ct)
    {
        EnsureConfigured();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl}/storage/v1/object/{bucket}/{objectKey}")
        {
            Content = new ByteArrayContent(content),
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        request.Headers.Add("x-upsert", "true");
        request.Headers.Add("cache-control", cacheControl);
        Authorize(request);

        using var response = await http.SendAsync(request, ct);
        await EnsureSuccessAsync(response, $"upload {objectKey}", ct);
    }

    private async Task DeleteAsync(string bucket, IReadOnlyCollection<string> objectKeys, CancellationToken ct)
    {
        if (objectKeys.Count == 0) return;
        EnsureConfigured();
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{_options.BaseUrl}/storage/v1/object/{bucket}")
        {
            Content = JsonContent.Create(new { prefixes = objectKeys }),
        };
        Authorize(request);

        using var response = await http.SendAsync(request, ct);
        await EnsureSuccessAsync(response, $"delete {objectKeys.Count} files", ct);
    }

    // Used by /health: can we reach storage with our key?
    public async Task<bool> IsReachableAsync(CancellationToken ct)
    {
        if (!_options.IsConfigured) return false;
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.BaseUrl}/storage/v1/bucket/{_options.PublicBucket}");
        Authorize(request);
        using var response = await http.SendAsync(request, ct);
        return response.IsSuccessStatusCode;
    }

    // Creates the two buckets if they don't exist yet. Called once at startup.
    public async Task EnsureBucketsAsync(CancellationToken cancellationToken)
    {
        if (!_options.IsConfigured)
        {
            logger.LogWarning("Storage isn't configured (Storage:SupabaseUrl / Storage:ServiceKey). Photo uploads will fail.");
            return;
        }

        await EnsureBucketAsync(_options.PublicBucket, isPublic: true, maxBytes: 2 * 1024 * 1024, ["image/webp"], cancellationToken);
        await EnsureBucketAsync(_options.PrivateBucket, isPublic: false, maxBytes: 5 * 1024 * 1024,
            ["image/jpeg", "image/png", "image/webp"], cancellationToken);
    }

    private async Task EnsureBucketAsync(string name, bool isPublic, long maxBytes, string[] mimeTypes, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.BaseUrl}/storage/v1/bucket")
        {
            Content = JsonContent.Create(new { id = name, name, @public = isPublic, file_size_limit = maxBytes, allowed_mime_types = mimeTypes }),
        };
        Authorize(request);

        using var response = await http.SendAsync(request, ct);
        if (response.IsSuccessStatusCode)
        {
            logger.LogInformation("Storage bucket {Bucket} created (public: {Public}).", name, isPublic);
            return;
        }

        var body = await response.Content.ReadAsStringAsync(ct);
        if (response.StatusCode is HttpStatusCode.Conflict or HttpStatusCode.BadRequest
            && (body.Contains("already exists", StringComparison.OrdinalIgnoreCase) || body.Contains("Duplicate", StringComparison.OrdinalIgnoreCase)))
            return; // already there

        throw new InvalidOperationException($"Could not create storage bucket '{name}': {(int)response.StatusCode} {body}");
    }

    // New Supabase secret keys (sb_secret_…) go in the apikey header only; legacy JWT keys also as Bearer.
    private void Authorize(HttpRequestMessage request)
    {
        request.Headers.Add("apikey", _options.ServiceKey);
        if (_options.ServiceKey!.StartsWith("eyJ", StringComparison.Ordinal))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ServiceKey);
    }

    private void EnsureConfigured()
    {
        if (!_options.IsConfigured)
            throw new InvalidOperationException(
                "Photo storage isn't configured. Set Storage:SupabaseUrl in appsettings and Storage:ServiceKey with dotnet user-secrets.");
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, string action, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        var body = await response.Content.ReadAsStringAsync(ct);
        throw new InvalidOperationException($"Storage could not {action}: {(int)response.StatusCode} {body}");
    }
}
