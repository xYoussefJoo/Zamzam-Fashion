using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Zamzam.Application.Common;
using Zamzam.Application.Orders;
using Zamzam.Domain.Entities;
using Zamzam.Domain.Enums;

namespace Zamzam.Application.Tailoring;

// ===================== #38 POST /api/admin/orders/{id}/quote =====================

public sealed record SendQuoteCommand(decimal Price, string? Note, int ValidDays = 7);

public sealed class SendQuoteValidator : AbstractValidator<SendQuoteCommand>
{
    public SendQuoteValidator()
    {
        RuleFor(c => c.Price).GreaterThan(0).PrecisionScale(18, 2, true);
        RuleFor(c => c.Note).MaximumLength(500);
        RuleFor(c => c.ValidDays).InclusiveBetween(1, Order.MaxQuoteDays);
    }
}

// CustomerLink is shown ONCE, only when the price changed: the owner sends it on WhatsApp
// (a new private link; the customer's old link stops working).
public sealed record QuoteResult(AdminOrderDetail Order, string? CustomerLink);

public sealed class SendQuoteHandler(IAppDbContext db, IUserDirectory users, IImageStorage storage, IEmailQueue emails,
    ISiteLinks links, TimeProvider clock)
{
    public async Task<QuoteResult> HandleAsync(int orderId, SendQuoteCommand command, string? userId, CancellationToken ct)
    {
        var order = await db.Orders.Include(o => o.Lines).Include(o => o.History).Include(o => o.Tailoring)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct) ?? throw new NotFoundException("Order");

        order.SendQuote(command.Price, command.Note, command.ValidDays, userId, clock.GetUtcNow().UtcDateTime);

        string? customerLink = null;
        if (order.Status == OrderStatus.QuoteSent)
        {
            var (token, hash) = TrackingTokens.Create();
            order.ReplaceTrackingToken(hash);
            customerLink = links.TrackingPage(order.Number, token);
        }

        await db.SaveChangesAsync(ct);
        TailoringEmails.QuoteSent(emails, order, customerLink);
        return new QuoteResult(await GetAdminOrderHandler.ToDetailAsync(db, users, storage, order, ct), customerLink);
    }
}

// ===================== #15 / #16 the customer's answer (from the private link) =====================

public sealed record RejectQuoteCommand(string? Reason);

public sealed class RejectQuoteValidator : AbstractValidator<RejectQuoteCommand>
{
    public RejectQuoteValidator() => RuleFor(c => c.Reason).MaximumLength(300);
}

public sealed class AnswerQuoteHandler(IAppDbContext db, IEmailQueue emails, ISiteLinks links, TimeProvider clock,
    TrackOrderHandler tracking)
{
    public Task<PublicOrderDto> ApproveAsync(string number, string? token, CancellationToken ct) =>
        AnswerAsync(number, token, order => order.ApproveQuote(clock.GetUtcNow().UtcDateTime), ct);

    public Task<PublicOrderDto> RejectAsync(string number, string? token, RejectQuoteCommand command, CancellationToken ct) =>
        AnswerAsync(number, token, order => order.RejectQuote(command.Reason, clock.GetUtcNow().UtcDateTime), ct);

    private async Task<PublicOrderDto> AnswerAsync(string number, string? token, Action<Order> answer, CancellationToken ct)
    {
        var order = await db.Orders.Include(o => o.History).Include(o => o.Tailoring)
            .FirstOrDefaultAsync(o => o.Number == number, ct);
        if (order is null || !TrackingTokens.Matches(token, order.TrackingTokenHash))
            throw new NotFoundException("Order"); // same answer as tracking: never reveal which orders exist

        answer(order); // the domain checks it's a custom order waiting for this customer, and not expired
        await db.SaveChangesAsync(ct);
        TailoringEmails.CustomerAnswered(emails, links, order);

        db.ClearChanges();
        return await tracking.HandleAsync(number, token, ct);
    }
}
