using System.Net.Mail;
using Zamzam.Domain.Common;
using Zamzam.Domain.Constants;
using Zamzam.Domain.Exceptions;

namespace Zamzam.Domain.ValueObjects;

// The guest customer's details. No identity of its own: EF stores it as columns inside Orders.
public sealed class CustomerInfo
{
    public string Name { get; private set; } = null!;
    public string Phone { get; private set; } = null!;   // always +201xxxxxxxxx
    public string? Email { get; private set; }            // optional
    public string City { get; private set; } = null!;
    public string Address { get; private set; } = null!;
    public string? Notes { get; private set; }

    private CustomerInfo() { } // EF Core

    public CustomerInfo(string name, string phone, string? email, string city, string address, string? notes)
    {
        Name = Guard.Required(name, "Name", 100, minLength: 3);
        Phone = EgyptianPhone.Normalize(phone);
        Email = NormalizeEmail(email);
        City = Guard.Required(city, "City", 100, minLength: 2);
        Address = Guard.Required(address, "Address", 500, minLength: 10);
        Notes = Guard.Optional(notes, "Notes", 500);
    }

    private static string? NormalizeEmail(string? email)
    {
        var value = Guard.Optional(email, "Email", 254)?.ToLowerInvariant();
        if (value is null) return null;
        if (!MailAddress.TryCreate(value, out var parsed) || parsed.Address != value)
            throw new DomainException(ErrorCodes.Validation, "Enter a valid email address, or leave it empty.");
        return value;
    }
}
