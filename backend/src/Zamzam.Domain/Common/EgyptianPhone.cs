using System.Text.RegularExpressions;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Common;

// Accepts 01012345678, +201012345678 or 00201012345678 (spaces and dashes allowed)
// and always stores +201012345678.
public static partial class EgyptianPhone
{
    public static string Normalize(string? input)
    {
        var digits = new string((input ?? "").Where(char.IsDigit).ToArray());

        if (digits.StartsWith("0020")) digits = digits[4..];
        else if (digits.StartsWith("20") && digits.Length == 12) digits = digits[2..];
        else if (digits.StartsWith('0') && digits.Length == 11) digits = digits[1..];

        if (!MobileNumber().IsMatch(digits))
            throw new DomainException(ErrorCodes.Validation, "Enter a valid Egyptian mobile number, like 01012345678.");
        return "+20" + digits;
    }

    // 10 digits after the country code: 10, 11, 12 or 15 then 8 digits.
    [GeneratedRegex(@"^1[0125]\d{8}$")]
    private static partial Regex MobileNumber();
}
