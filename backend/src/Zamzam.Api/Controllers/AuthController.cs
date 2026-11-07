using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Zamzam.Api.Contracts;
using Zamzam.Api.Security;
using Zamzam.Domain.Constants;
using Zamzam.Infrastructure.Identity;

namespace Zamzam.Api.Controllers;

// APIs #1-4: the owner's login. Customers never log in.
[Route("api/auth")]
public sealed class AuthController(
    UserManager<AppUser> users,
    SignInManager<AppUser> signIn,
    TimeProvider clock) : ApiControllerBase
{
    // #1
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Login)]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null) return InvalidCredentials();

        var result = await signIn.PasswordSignInAsync(user, request.Password, request.RememberMe, lockoutOnFailure: true);

        if (result.IsLockedOut)
        {
            var lockedUntil = await users.GetLockoutEndDateAsync(user) ?? clock.GetUtcNow();
            var seconds = Math.Max(1, (int)Math.Ceiling((lockedUntil - clock.GetUtcNow()).TotalSeconds));
            return ProblemWithCode(StatusCodes.Status423Locked, "LOCKED_OUT", "Too many attempts",
                "Too many wrong passwords. Try again later.", new Dictionary<string, object?> { ["retryAfterSeconds"] = seconds });
        }
        if (!result.Succeeded) return InvalidCredentials();

        return Ok(await ToResponseAsync(user));
    }

    // #2
    [HttpPost("logout")]
    [Authorize(Policy = Policies.Owner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout()
    {
        await signIn.SignOutAsync();
        return NoContent();
    }

    // #3 — the Next.js admin layout calls this on every load.
    [HttpGet("me")]
    [Authorize(Policy = Policies.Owner)]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Me()
    {
        var user = await users.GetUserAsync(User);
        return user is null ? Unauthorized() : Ok(await ToResponseAsync(user));
    }

    // #4
    [HttpPost("change-password")]
    [Authorize(Policy = Policies.Owner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await users.GetUserAsync(User);
        if (user is null) return Unauthorized();

        var result = await users.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
                ModelState.AddModelError(error.Code == "PasswordMismatch" ? "currentPassword" : "newPassword", error.Description);
            return ValidationProblem(ModelState);
        }

        user.MustChangePassword = false;
        await users.UpdateAsync(user);
        await signIn.RefreshSignInAsync(user); // the security stamp changed; keep this session signed in
        return NoContent();
    }

    // Same answer whether the email or the password is wrong, so nobody can test which emails exist.
    private ObjectResult InvalidCredentials() =>
        ProblemWithCode(StatusCodes.Status401Unauthorized, "INVALID_CREDENTIALS", "Login failed", "Wrong email or password.");

    private async Task<UserResponse> ToResponseAsync(AppUser user)
    {
        var role = (await users.GetRolesAsync(user)).FirstOrDefault() ?? Roles.Owner;
        return new UserResponse(user.Id, user.FullName, user.Email!, role, user.MustChangePassword);
    }
}
