using System.Globalization;
using System.Net;
using Zamzam.Application.Common;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;

namespace Zamzam.Application.Orders;

// Short bilingual emails. Every value from the customer is HTML-encoded, so nothing they type can
// inject links or scripts into the owner's inbox.
internal static class OrderEmails
{
    private static string E(string? value) => WebUtility.HtmlEncode(value ?? "");
    private static string Money(decimal amount) => amount.ToString("N2", CultureInfo.InvariantCulture) + " EGP";

    public static void NewOrder(IEmailQueue emails, ISiteLinks links, Order order, string trackingToken)
    {
        var items = string.Join("", order.Lines.Select(l =>
            $"<li>{E(l.ProductNameEn)} · {E(l.Size)} · {E(l.ColorNameEn)} × {l.Quantity} = {Money(l.LineTotal)}</li>"));
        var c = order.Customer;

        emails.ToOwner($"New order {order.Number} — {Money(order.Total)}",
            $"<h2>New order {E(order.Number)}</h2>" +
            $"<p><b>{E(c.Name)}</b> · {E(c.Phone)}<br>{E(c.City)} — {E(c.Address)}</p>" +
            (c.Notes is null ? "" : $"<p>Notes: {E(c.Notes)}</p>") +
            $"<ul>{items}</ul><p>Delivery: {Money(order.DeliveryFee)}<br><b>Total: {Money(order.Total)}</b> (cash on delivery)</p>" +
            $"<p><a href=\"{E(links.AdminOrderPage(order.Id))}\">Open in the dashboard</a></p>");

        if (c.Email is null) return;
        var track = links.TrackingPage(order.Number, trackingToken);
        emails.ToCustomer(c.Email, $"Zamzam Fashion — order {order.Number} received / تم استلام طلبك",
            $"<p dir=\"rtl\">شكراً {E(c.Name)}! استلمنا طلبك رقم <b>{E(order.Number)}</b> وسنتواصل معك لتأكيده.</p>" +
            $"<p>Thank you {E(c.Name)}! We received your order <b>{E(order.Number)}</b> and will call you to confirm it.</p>" +
            $"<ul>{items}</ul><p><b>Total: {Money(order.Total)}</b> — cash on delivery</p>" +
            $"<p><a href=\"{E(track)}\">Track your order / تتبع طلبك</a></p>");
    }

    // Customers hear about the steps that matter to them; workshop steps stay internal.
    private static readonly Dictionary<OrderStatus, (string Ar, string En)> CustomerUpdates = new()
    {
        [OrderStatus.Confirmed] = ("تم تأكيد طلبك", "Your order is confirmed"),
        [OrderStatus.Shipped] = ("طلبك في الطريق إليك", "Your order is on its way"),
        [OrderStatus.Delivered] = ("تم توصيل طلبك", "Your order was delivered"),
        [OrderStatus.Cancelled] = ("تم إلغاء طلبك", "Your order was cancelled"),
    };

    public static void StatusChanged(IEmailQueue emails, Order order)
    {
        if (order.Customer.Email is null || !CustomerUpdates.TryGetValue(order.Status, out var text)) return;
        emails.ToCustomer(order.Customer.Email, $"Zamzam Fashion — {order.Number}: {text.En}",
            $"<p dir=\"rtl\">{text.Ar} — رقم الطلب <b>{E(order.Number)}</b></p>" +
            $"<p>{text.En} — order <b>{E(order.Number)}</b></p>");
    }
}
