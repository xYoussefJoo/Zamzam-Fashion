namespace Zamzam.Infrastructure.Storage;

// "Storage" section. SupabaseUrl lives in appsettings; ServiceKey only in user-secrets / environment.
public sealed class StorageOptions
{
    public const string Section = "Storage";

    public string? SupabaseUrl { get; set; }
    public string? ServiceKey { get; set; }
    public string PublicBucket { get; set; } = "product-images";
    public string PrivateBucket { get; set; } = "tailoring-references";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(SupabaseUrl) && !string.IsNullOrWhiteSpace(ServiceKey);
    public string BaseUrl => (SupabaseUrl ?? "").TrimEnd('/');
}
