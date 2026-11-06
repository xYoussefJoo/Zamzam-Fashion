using System.Text.RegularExpressions;
using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.Entities;

public partial class Color : Entity
{
    public string NameAr { get; private set; } = null!;
    public string NameEn { get; private set; } = null!;
    public string Hex { get; private set; } = null!;

    private Color() { } // EF Core

    public Color(string nameAr, string nameEn, string hex) => Update(nameAr, nameEn, hex);

    public void Update(string nameAr, string nameEn, string hex)
    {
        NameAr = Guard.Required(nameAr, "Arabic name", 50);
        NameEn = Guard.Required(nameEn, "English name", 50);
        var value = hex?.Trim().ToLowerInvariant() ?? "";
        if (!HexFormat().IsMatch(value))
            throw new DomainException(ErrorCodes.Validation, "Hex must look like #d6b995.");
        Hex = value;
    }

    [GeneratedRegex("^#[0-9a-f]{6}$")]
    private static partial Regex HexFormat();
}
