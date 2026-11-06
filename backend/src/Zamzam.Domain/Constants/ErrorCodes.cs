namespace Zamzam.Domain.Constants;

// The machine-readable codes the API returns (docs/API-CONTRACT.md, Appendix B).
public static class ErrorCodes
{
    public const string Validation = "VALIDATION_FAILED";
    public const string OutOfStock = "OUT_OF_STOCK";
    public const string PriceChanged = "PRICE_CHANGED";
    public const string InvalidStatusTransition = "INVALID_STATUS_TRANSITION";
    public const string ConcurrencyConflict = "CONCURRENCY_CONFLICT";
    public const string Duplicate = "DUPLICATE";
    public const string InUse = "IN_USE";
    public const string QuoteExpired = "QUOTE_EXPIRED";
    public const string NotFound = "NOT_FOUND";
}
