namespace Zamzam.Application.Common;

// 404 — the thing in the URL doesn't exist (or is hidden from the shop).
public sealed class NotFoundException(string what) : Exception($"{what} was not found.");

// 413 / 415 — an upload was refused before touching the domain.
public sealed class FileRejectedException(int statusCode, string code, string message) : Exception(message)
{
    public const string TooLarge = "FILE_TOO_LARGE";
    public const string UnsupportedType = "UNSUPPORTED_FILE_TYPE";

    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}
