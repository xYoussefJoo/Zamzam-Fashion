using System.Text;
using System.Text.RegularExpressions;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Common;

// URL-friendly names: "Modest Abaya" -> "modest-abaya". Built from the English name.
public static partial class Slug
{
    public const int MaxLength = 120;

    public static string From(string text)
    {
        var builder = new StringBuilder();
        foreach (var ch in text.Trim().ToLowerInvariant())
            builder.Append(ch is >= 'a' and <= 'z' or >= '0' and <= '9' ? ch : '-');

        var slug = MultipleDashes().Replace(builder.ToString(), "-").Trim('-');
        if (slug.Length > MaxLength) slug = slug[..MaxLength].TrimEnd('-');
        if (slug.Length == 0)
            throw new DomainException(ErrorCodes.Validation, "A slug needs at least one English letter or digit.");
        return slug;
    }

    // Uses the given slug when there is one (after checking it), otherwise builds one from the text.
    public static string FromOrValidate(string? slug, string fallbackText)
    {
        if (string.IsNullOrWhiteSpace(slug)) return From(fallbackText);
        var trimmed = slug.Trim();
        if (trimmed.Length > MaxLength || !ValidSlug().IsMatch(trimmed))
            throw new DomainException(ErrorCodes.Validation, "Slug may only contain lowercase letters, digits and single dashes.");
        return trimmed;
    }

    [GeneratedRegex("-{2,}")]
    private static partial Regex MultipleDashes();

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex ValidSlug();
}
