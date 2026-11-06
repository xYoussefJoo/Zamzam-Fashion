using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Infrastructure.Persistence;

namespace Zamzam.Infrastructure.Orders;

// Reads the next number from the PostgreSQL sequence: unique even when two orders arrive at the same moment.
// Runs on the same connection/transaction as the checkout. A rolled-back checkout leaves a gap, which is fine.
public sealed class OrderNumberGenerator(ZamzamDbContext db) : IOrderNumberGenerator
{
    public async Task<string> NextAsync(CancellationToken cancellationToken)
    {
        var next = await db.Database
            .SqlQueryRaw<long>($"SELECT nextval('{ZamzamDbContext.Schema}.\"{ZamzamDbContext.OrderNumberSequence}\"') AS \"Value\"")
            .SingleAsync(cancellationToken);
        return $"ZF-{next}";
    }
}

public sealed class UserDirectory(ZamzamDbContext db) : IUserDirectory
{
    public async Task<IReadOnlyDictionary<string, string>> NamesAsync(IEnumerable<string> userIds, CancellationToken cancellationToken)
    {
        var ids = userIds.ToList();
        if (ids.Count == 0) return new Dictionary<string, string>();
        return await db.Users.AsNoTracking().Where(u => ids.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => string.IsNullOrWhiteSpace(u.FullName) ? u.Email ?? "Owner" : u.FullName, cancellationToken);
    }
}

// "Site:PublicUrl" is the Next.js website (http://localhost:3000 in development, the shop's domain in production).
public sealed class SiteLinks(IConfiguration configuration) : ISiteLinks
{
    private string Base => (configuration["Site:PublicUrl"] ?? "http://localhost:3000").TrimEnd('/');

    public string TrackingPage(string orderNumber, string trackingToken) =>
        $"{Base}/track/{Uri.EscapeDataString(orderNumber)}?t={Uri.EscapeDataString(trackingToken)}";

    public string AdminOrderPage(int orderId) => $"{Base}/admin/orders/{orderId}";
}
