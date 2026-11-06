using System.ComponentModel.DataAnnotations;

namespace Zamzam.Api.Contracts;

public sealed record LoginRequest(
    [Required, EmailAddress, MaxLength(254)] string Email,
    [Required, MaxLength(200)] string Password,
    bool RememberMe = false);

public sealed record ChangePasswordRequest(
    [Required, MaxLength(200)] string CurrentPassword,
    [Required, MaxLength(200)] string NewPassword);

public sealed record UserResponse(string Id, string FullName, string Email, string Role, bool MustChangePassword);
