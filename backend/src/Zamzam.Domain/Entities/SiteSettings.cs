using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;
using Zamzam.Domain.Settings;

namespace Zamzam.Domain.Entities;

// Single row. The whole content is replaced at once from the dashboard.
public class SiteSettings : Entity
{
    public SiteContent Content { get; private set; } = SiteContent.Default;

    private SiteSettings() { } // EF Core

    public SiteSettings(SiteContent content) => Replace(content);

    public void Replace(SiteContent content)
    {
        if (content is null) throw new DomainException(ErrorCodes.Validation, "Content is required.");

        Content = content with
        {
            AnnouncementAr = Guard.Optional(content.AnnouncementAr, "Announcement (Arabic)", 200) ?? "",
            AnnouncementEn = Guard.Optional(content.AnnouncementEn, "Announcement (English)", 200) ?? "",
            Hero = content.Hero with { ImageUrl = Guard.Optional(content.Hero.ImageUrl, "Hero image", 500) },
            Contact = content.Contact with { WhatsApp = DigitsOnly(content.Contact.WhatsApp) },
            Social = new SocialLinks(
                HttpsOrNull(content.Social.Facebook, "Facebook"),
                HttpsOrNull(content.Social.Instagram, "Instagram"),
                HttpsOrNull(content.Social.TikTok, "TikTok")),
        };
    }

    private static string? HttpsOrNull(string? url, string field)
    {
        var value = Guard.Optional(url, field, 300);
        if (value is null) return null;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
            throw new DomainException(ErrorCodes.Validation, $"{field} link must start with https://");
        return value;
    }

    // WhatsApp links need the number as digits with the country code: 201012345678.
    private static string? DigitsOnly(string? phone)
    {
        var digits = new string((phone ?? "").Where(char.IsDigit).ToArray());
        return digits.Length == 0 ? null : digits;
    }
}
