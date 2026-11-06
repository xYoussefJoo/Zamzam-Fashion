namespace Zamzam.Domain.Constants;

// Constants, not an enum: [Authorize(Roles = ...)] needs a const string.
public static class Roles
{
    public const string Owner = "Owner";
}
