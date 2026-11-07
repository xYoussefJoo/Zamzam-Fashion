using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Application.Orders;

// #9 GET /api/delivery-zones — the governorates we deliver to, with fee and delivery days.
public sealed class ListDeliveryZonesHandler(IAppDbContext db)
{
    public async Task<IReadOnlyList<ZoneDto>> HandleAsync(CancellationToken ct) =>
        await db.DeliveryZones.AsNoTracking().Where(z => z.IsActive).OrderBy(z => z.Id)
            .Select(z => new ZoneDto(z.Id, z.Key, z.NameAr, z.NameEn, z.Fee, z.EtaDaysMin, z.EtaDaysMax))
            .ToListAsync(ct);
}

// #41 GET /api/admin/delivery-zones — all 27, inactive included.
public sealed class ListAdminDeliveryZonesHandler(IAppDbContext db)
{
    public async Task<IReadOnlyList<AdminZoneDto>> HandleAsync(CancellationToken ct) =>
        (await db.DeliveryZones.AsNoTracking().OrderBy(z => z.Id).ToListAsync(ct)).Select(z => z.ToAdminDto()).ToList();
}

public sealed record ZoneUpdate(int Id, decimal Fee, int EtaDaysMin, int EtaDaysMax, bool IsActive);

public sealed class ZoneUpdatesValidator : AbstractValidator<List<ZoneUpdate>>
{
    public ZoneUpdatesValidator()
    {
        RuleFor(list => list).NotEmpty().Must(list => list.Count <= 100)
            .Must(list => list.Select(z => z.Id).Distinct().Count() == list.Count).WithMessage("Each zone may appear only once.");
        RuleForEach(list => list).ChildRules(zone =>
        {
            zone.RuleFor(z => z.Id).GreaterThan(0);
            zone.RuleFor(z => z.Fee).GreaterThanOrEqualTo(0).PrecisionScale(18, 2, true);
            zone.RuleFor(z => z.EtaDaysMin).InclusiveBetween(0, DeliveryZone.MaxEtaDays);
            zone.RuleFor(z => z.EtaDaysMax).InclusiveBetween(0, DeliveryZone.MaxEtaDays)
                .GreaterThanOrEqualTo(z => z.EtaDaysMin).WithMessage("Max days must be at least the min days.");
        });
    }
}

// #42 PUT /api/admin/delivery-zones — bulk update of fee, delivery days and active (names and keys are fixed).
public sealed class UpdateDeliveryZonesHandler(IAppDbContext db)
{
    public async Task<IReadOnlyList<AdminZoneDto>> HandleAsync(IReadOnlyList<ZoneUpdate> updates, CancellationToken ct)
    {
        var ids = updates.Select(u => u.Id).ToList();
        var zones = await db.DeliveryZones.Where(z => ids.Contains(z.Id)).ToDictionaryAsync(z => z.Id, ct);
        var unknown = ids.FirstOrDefault(id => !zones.ContainsKey(id));
        if (unknown != 0) throw new DomainException(ErrorCodes.Validation, $"Delivery zone {unknown} doesn't exist.");

        foreach (var u in updates) zones[u.Id].UpdateDelivery(u.Fee, u.EtaDaysMin, u.EtaDaysMax, u.IsActive);
        await db.SaveChangesAsync(ct);

        return (await db.DeliveryZones.AsNoTracking().OrderBy(z => z.Id).ToListAsync(ct)).Select(z => z.ToAdminDto()).ToList();
    }
}
