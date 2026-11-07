using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Settings;

namespace Zamzam.Application.Settings;

// #43 GET /api/admin/site-settings
public sealed class GetAdminSiteSettingsHandler(IAppDbContext db)
{
    public async Task<SiteContent> HandleAsync(CancellationToken ct) =>
        await db.SiteSettings.AsNoTracking().Select(s => s.Content).FirstOrDefaultAsync(ct) ?? SiteContent.Default;
}

public sealed class SiteContentValidator : AbstractValidator<SiteContent>
{
    public SiteContentValidator()
    {
        RuleFor(s => s.AnnouncementAr).MaximumLength(200);
        RuleFor(s => s.AnnouncementEn).MaximumLength(200);
        RuleFor(s => s.Hero).NotNull();
        RuleFor(s => s.Hero.TitleAr).MaximumLength(120).When(s => s.Hero is not null);
        RuleFor(s => s.Hero.TitleEn).MaximumLength(120).When(s => s.Hero is not null);
        RuleFor(s => s.Hero.SubtitleAr).MaximumLength(300).When(s => s.Hero is not null);
        RuleFor(s => s.Hero.SubtitleEn).MaximumLength(300).When(s => s.Hero is not null);
        RuleFor(s => s.Collection).NotNull();
        RuleFor(s => s.Collection.TitleAr).MaximumLength(120).When(s => s.Collection is not null);
        RuleFor(s => s.Collection.TitleEn).MaximumLength(120).When(s => s.Collection is not null);
        RuleFor(s => s.Contact).NotNull();
        RuleFor(s => s.Contact.Phone).MaximumLength(30).When(s => s.Contact is not null);
        RuleFor(s => s.Contact.WhatsApp).MaximumLength(30).When(s => s.Contact is not null);
        RuleFor(s => s.Contact.Email).EmailAddress().MaximumLength(254)
            .When(s => s.Contact is not null && !string.IsNullOrWhiteSpace(s.Contact.Email));
        RuleFor(s => s.Contact.AddressAr).MaximumLength(300).When(s => s.Contact is not null);
        RuleFor(s => s.Contact.AddressEn).MaximumLength(300).When(s => s.Contact is not null);
        RuleFor(s => s.Social).NotNull();
    }
}

// #44 PUT /api/admin/site-settings — the domain cleans the links (https only) and the WhatsApp number.
public sealed class UpdateSiteSettingsHandler(IAppDbContext db)
{
    public async Task<SiteContent> HandleAsync(SiteContent content, CancellationToken ct)
    {
        var settings = await db.SiteSettings.FirstOrDefaultAsync(ct);
        if (settings is null) db.SiteSettings.Add(settings = new SiteSettings(content));
        else settings.Replace(content);
        await db.SaveChangesAsync(ct);
        return settings.Content;
    }
}
