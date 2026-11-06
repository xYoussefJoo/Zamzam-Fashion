using System.Threading.Channels;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Zamzam.Application.Common;

namespace Zamzam.Infrastructure.Email;

public sealed record EmailMessage(string To, string Subject, string HtmlBody);

// The actual sending. Today: LogOnlyEmailSender. At deploy: a real provider (Resend / SMTP) — one new class.
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

// Use cases drop messages here and return immediately; EmailBackgroundService sends them.
public sealed class EmailQueue(IConfiguration configuration, ILogger<EmailQueue> logger) : IEmailQueue
{
    private readonly Channel<EmailMessage> _channel = Channel.CreateBounded<EmailMessage>(
        new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.DropOldest });

    public ChannelReader<EmailMessage> Reader => _channel.Reader;

    public void ToOwner(string subject, string htmlBody)
    {
        var owner = configuration["Notifications:OwnerEmail"] ?? configuration["Seed:OwnerEmail"];
        if (string.IsNullOrWhiteSpace(owner))
        {
            logger.LogWarning("No owner email configured (Notifications:OwnerEmail); skipping \"{Subject}\".", subject);
            return;
        }
        _channel.Writer.TryWrite(new EmailMessage(owner, subject, htmlBody));
    }

    public void ToCustomer(string email, string subject, string htmlBody) =>
        _channel.Writer.TryWrite(new EmailMessage(email, subject, htmlBody));
}

public sealed class EmailBackgroundService(EmailQueue queue, IEmailSender sender, ILogger<EmailBackgroundService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in queue.Reader.ReadAllAsync(stoppingToken))
        {
            for (var attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    await sender.SendAsync(message, stoppingToken);
                    break;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Email \"{Subject}\" failed (attempt {Attempt}/3).", message.Subject, attempt);
                    if (attempt < 3) await Task.Delay(TimeSpan.FromSeconds(5 * attempt), stoppingToken);
                }
            }
        }
    }
}

// Development: writes the email to the log instead of sending it.
// Only the subject and a masked address are logged, never the body (it holds addresses and phone numbers).
public sealed class LogOnlyEmailSender(ILogger<LogOnlyEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var at = message.To.IndexOf('@');
        var masked = at > 1 ? message.To[0] + "***" + message.To[at..] : "***";
        logger.LogInformation("EMAIL (not sent, log only) to {To}: {Subject}", masked, message.Subject);
        return Task.CompletedTask;
    }
}
