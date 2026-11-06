using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Common;

// Small checks used by entity constructors and methods, so an invalid object can never exist.
public static class Guard
{
    public static string Required(string? value, string field, int maxLength, int minLength = 1)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            throw new DomainException(ErrorCodes.Validation, $"{field} is required.");
        if (trimmed.Length < minLength)
            throw new DomainException(ErrorCodes.Validation, $"{field} must be at least {minLength} characters.");
        if (trimmed.Length > maxLength)
            throw new DomainException(ErrorCodes.Validation, $"{field} must be {maxLength} characters or fewer.");
        return trimmed;
    }

    public static string? Optional(string? value, string field, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > maxLength)
            throw new DomainException(ErrorCodes.Validation, $"{field} must be {maxLength} characters or fewer.");
        return trimmed;
    }

    public static decimal Money(decimal value, string field, bool allowZero = false)
    {
        if (value < 0 || (!allowZero && value == 0))
            throw new DomainException(ErrorCodes.Validation, $"{field} must be greater than {(allowZero ? "or equal to " : "")}0.");
        if (decimal.Round(value, 2) != value)
            throw new DomainException(ErrorCodes.Validation, $"{field} can have at most 2 decimal places.");
        return value;
    }

    public static int NotNegative(int value, string field)
    {
        if (value < 0)
            throw new DomainException(ErrorCodes.Validation, $"{field} cannot be negative.");
        return value;
    }

    public static int Positive(int value, string field)
    {
        if (value <= 0)
            throw new DomainException(ErrorCodes.Validation, $"{field} must be greater than 0.");
        return value;
    }
}
