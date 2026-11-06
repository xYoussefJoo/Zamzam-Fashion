namespace Zamzam.Infrastructure.Persistence;

// Remembers the response of POST /api/orders and /api/tailoring/requests for 24 h,
// so a double click or refresh returns the same order instead of creating a second one.
public class IdempotencyRecord
{
    public string Key { get; set; } = null!;
    public string Endpoint { get; set; } = null!;
    public string RequestHash { get; set; } = null!;
    public int StatusCode { get; set; }
    public string ResponseJson { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
