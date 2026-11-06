using Microsoft.AspNetCore.Identity;

namespace Zamzam.Infrastructure.Identity;

// A dashboard account. Today only the Owner; staff can be added later with the same table.
public class AppUser : IdentityUser
{
    public string FullName { get; set; } = "";

    // True after an account is created or reset with a temporary password.
    public bool MustChangePassword { get; set; }
}
