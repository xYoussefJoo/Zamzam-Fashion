namespace Zamzam.Application.Common;

// Emails go into a queue and are sent in the background after the order is saved:
// a slow or broken mail service never slows down or breaks a checkout.
public interface IEmailQueue
{
    void ToOwner(string subject, string htmlBody);
    void ToCustomer(string email, string subject, string htmlBody);
}

// Links to pages of the shop's website (the Next.js frontend), used inside emails.
public interface ISiteLinks
{
    string TrackingPage(string orderNumber, string trackingToken);
    string AdminOrderPage(int orderId);
}
