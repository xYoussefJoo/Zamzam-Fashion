using System.Globalization;
using System.Net;
using Zamzam.Application.Common;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;

namespace Zamzam.Application.Tailoring;

// Bilingual tailoring emails; every customer value is HTML-encoded.
internal static class TailoringEmails
{
    private static string E(string? value) => WebUtility.HtmlEncode(value ?? "");
    private static string Money(decimal amount) => amount.ToString("N2", CultureInfo.InvariantCulture) + " EGP";

    public static void NewRequest(IEmailQueue emails, ISiteLinks links, Order order, string token)
    {
        var t = order.Tailoring!;
        var c = order.Customer;
        emails.ToOwner($"New tailoring request {order.Number} — estimate {Money(t.EstimatedPrice)}",
            $"<h2>New tailoring request {E(order.Number)}</h2>" +
            $"<p><b>{E(c.Name)}</b> · {E(c.Phone)}<br>{E(c.City)} — {E(c.Address)}</p>" +
            $"<p>{E(t.Garment)} · {E(t.Fabric)} · {E(t.Color)} · {E(t.Fit)}" +
            (t.SizingMode == SizingMode.StandardSize ? $" · size {E(t.StandardSize)}" : $" · {t.Measurements.Count} measurements") +
            (t.ReferenceImageKey is null ? "" : " · with a reference photo") + "</p>" +
            (t.Notes is null ? "" : $"<p>Notes: {E(t.Notes)}</p>") +
            $"<p>Estimate: <b>{Money(t.EstimatedPrice)}</b> + delivery {Money(order.DeliveryFee)}</p>" +
            $"<p><a href=\"{E(links.AdminOrderPage(order.Id))}\">Open in the dashboard to confirm the price</a></p>");

        if (c.Email is null) return;
        emails.ToCustomer(c.Email, $"Zamzam Fashion — request {order.Number} received / تم استلام طلب التفصيل",
            $"<p dir=\"rtl\">شكراً {E(c.Name)}! استلمنا طلب التفصيل رقم <b>{E(order.Number)}</b>. السعر التقديري {Money(t.EstimatedPrice)}، وسنؤكد السعر النهائي قريباً.</p>" +
            $"<p>Thank you {E(c.Name)}! We received your tailoring request <b>{E(order.Number)}</b>. Estimated price {Money(t.EstimatedPrice)}; we'll confirm the final price soon.</p>" +
            $"<p><a href=\"{E(links.TrackingPage(order.Number, token))}\">Follow your request / تابع طلبك</a></p>");
    }

    // Same price: confirmed straight away. New price: the customer must approve it from the new link.
    public static void QuoteSent(IEmailQueue emails, Order order, string? customerLink)
    {
        var c = order.Customer;
        if (c.Email is null) return; // no email: the owner sends the link on WhatsApp
        var t = order.Tailoring!;

        if (order.Status == OrderStatus.QuoteApproved)
        {
            emails.ToCustomer(c.Email, $"Zamzam Fashion — {order.Number}: price confirmed / تم تأكيد السعر",
                $"<p dir=\"rtl\">تم تأكيد سعر طلبك <b>{E(order.Number)}</b>: {Money(t.QuotedPrice!.Value)}. سنبدأ التفصيل قريباً.</p>" +
                $"<p>Your price for <b>{E(order.Number)}</b> is confirmed: {Money(t.QuotedPrice.Value)}. We'll start sewing soon.</p>");
            return;
        }

        emails.ToCustomer(c.Email, $"Zamzam Fashion — {order.Number}: your price / عرض السعر",
            $"<p dir=\"rtl\">السعر النهائي لطلبك <b>{E(order.Number)}</b> هو {Money(t.QuotedPrice!.Value)}" +
            (t.QuoteNote is null ? "" : $" ({E(t.QuoteNote)})") + $". العرض صالح حتى {t.QuoteValidUntil:yyyy-MM-dd}.</p>" +
            $"<p>The final price for <b>{E(order.Number)}</b> is {Money(t.QuotedPrice.Value)}" +
            (t.QuoteNote is null ? "" : $" ({E(t.QuoteNote)})") + $". Valid until {t.QuoteValidUntil:yyyy-MM-dd}.</p>" +
            $"<p><a href=\"{E(customerLink)}\">Approve or decline / وافق أو ارفض</a></p>");
    }

    public static void CustomerAnswered(IEmailQueue emails, ISiteLinks links, Order order)
    {
        var approved = order.Status == OrderStatus.QuoteApproved;
        emails.ToOwner($"{order.Number}: the customer {(approved ? "APPROVED" : "DECLINED")} the price",
            $"<p>{E(order.Customer.Name)} {(approved ? "approved" : "declined")} the price for <b>{E(order.Number)}</b>.</p>" +
            (approved ? "<p>You can start production.</p>" : $"<p>{E(order.History.Last().Note)}</p>") +
            $"<p><a href=\"{E(links.AdminOrderPage(order.Id))}\">Open in the dashboard</a></p>");
    }
}
