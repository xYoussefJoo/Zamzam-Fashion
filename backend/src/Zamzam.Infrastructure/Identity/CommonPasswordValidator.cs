using Microsoft.AspNetCore.Identity;

namespace Zamzam.Infrastructure.Identity;

// Rejects passwords that bots try first, even when they are long enough.
public sealed class CommonPasswordValidator : IPasswordValidator<AppUser>
{
    private static readonly HashSet<string> Common = new(StringComparer.OrdinalIgnoreCase)
    {
        "1234567890", "12345678910", "0123456789", "1111111111", "0000000000", "1234512345",
        "qwertyuiop", "qwerty1234", "qwerty12345", "asdfghjkl1", "1q2w3e4r5t", "zaq12wsxcde",
        "password12", "password123", "password1234", "passw0rd123", "p@ssw0rd123", "p@ssword123",
        "iloveyou12", "welcome123", "admin12345", "administrator", "letmein123", "football123",
        "abc1234567", "abcdefghij", "aaaaaaaaaa", "changeme123", "trustno1234", "superman123",
        "egypt12345", "cairo12345", "misr123456", "zamzam1234", "zamzam12345", "zamzamfashion",
    };

    public Task<IdentityResult> ValidateAsync(UserManager<AppUser> manager, AppUser user, string? password)
    {
        if (string.IsNullOrEmpty(password)) return Task.FromResult(IdentityResult.Success);

        var lower = password.ToLowerInvariant();
        var emailName = user.Email?.Split('@')[0].ToLowerInvariant();

        if (Common.Contains(password) || lower.Contains("password") || lower.StartsWith("zamzam")
            || (!string.IsNullOrEmpty(emailName) && emailName.Length >= 4 && lower.Contains(emailName)))
        {
            return Task.FromResult(IdentityResult.Failed(new IdentityError
            {
                Code = "CommonPassword",
                Description = "This password is too easy to guess. Choose something less common.",
            }));
        }
        return Task.FromResult(IdentityResult.Success);
    }
}
