namespace Zamzam.Domain.Constants;

// Strings, not an enum: "3XL" is not a valid C# identifier.
public static class StandardSizes
{
    public static readonly IReadOnlyList<string> All =
        ["XS", "S", "M", "L", "XL", "XXL", "3XL", "FreeSize"];

    public static bool IsValid(string size) => All.Contains(size);
}
