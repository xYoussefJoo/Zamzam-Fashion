using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Settings;

namespace Zamzam.Application.Settings;

// #8 GET /api/site-settings — the home page and footer content.
public sealed class GetSiteSettingsHandler(IAppDbContext db)
{
    public async Task<SiteContent> HandleAsync(CancellationToken ct) =>
        await db.SiteSettings.AsNoTracking().Select(s => s.Content).FirstOrDefaultAsync(ct) ?? SiteContent.Default;
}
