namespace Zamzam.Domain.Exceptions;

// Thrown when a business rule is broken. Code maps to the API error codes
// (OUT_OF_STOCK, INVALID_STATUS_TRANSITION, ...) listed in docs/API-CONTRACT.md.
public class DomainException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
