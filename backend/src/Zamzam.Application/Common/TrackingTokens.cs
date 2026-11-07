using System.Security.Cryptography;
using System.Text;

namespace Zamzam.Application.Common;

// The customer's private key to their order. Like a password: we keep only its SHA-256 hash,
// so a leaked database can't be used to open anyone's tracking page.
public static class TrackingTokens
{
    public static (string Token, string Hash) Create()
    {
        var token = Base64Url(RandomNumberGenerator.GetBytes(32)); // 256 bits: impossible to guess
        return (token, Hash(token));
    }

    public static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    // Constant-time compare: the response time never hints at how many characters were right.
    public static bool Matches(string? token, string storedHash) =>
        !string.IsNullOrWhiteSpace(token) && token.Length <= 100 &&
        CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(token)), Encoding.ASCII.GetBytes(storedHash));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

// ZF-10001, ZF-10002, … from the database sequence (safe when two orders arrive at the same moment).
public interface IOrderNumberGenerator
{
    Task<string> NextAsync(CancellationToken cancellationToken);
}
