using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;
using Zamzam.Domain.ValueObjects;

namespace Zamzam.Tests;

// Small builders so each test only spells out what it cares about.
internal static class TestData
{
    public static readonly DateTime Now = new(2026, 11, 6, 10, 0, 0, DateTimeKind.Utc);

    public static CustomerInfo Customer(string? email = "mona@example.com") =>
        new("Mona Ahmed", "01012345678", email, "Nasr City", "12 Abbas El Akkad St, apt 7", null);

    public static OrderLineDraft Line(int variantId, int quantity = 1, decimal price = 850m) =>
        new(variantId, "عباية", "Abaya", "M", "بيج", "Beige", price, quantity, null);

    public static Order ReadyOrder(params OrderLineDraft[] lines) =>
        Order.CreateReady("ZF-10001", "token-hash", Customer(), deliveryZoneId: 1, deliveryFee: 65m,
            lines.Length > 0 ? lines : [Line(501)], Now);

    public static TailoringSpec StandardSizeSpec(decimal estimate = 2200m) =>
        new("abaya", "dress", "crepe", "Beige", "Relaxed", SizingMode.StandardSize, "XL",
            measurements: null, hasLining: true, extras: ["embroidery"], referenceImageKey: null, estimate);

    public static Order CustomOrder(decimal estimate = 2200m) =>
        Order.CreateCustom("ZF-10002", "token-hash", Customer(), deliveryZoneId: 1, deliveryFee: 65m,
            StandardSizeSpec(estimate), Now);

    public static Product Product(decimal basePrice = 1250m) =>
        new(categoryId: 1, "عباية محتشمة", "Modest Abaya", slug: null, null, null, basePrice);
}
