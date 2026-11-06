namespace Zamzam.Application.Common;

// { items, page, pageSize, totalCount, totalPages } — the paging shape from docs/API-CONTRACT.md.
public sealed record Paged<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount, int TotalPages);

public static class Paging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static (int Page, int PageSize) Normalize(int? page, int? pageSize) =>
        (Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize));

    public static Paged<T> Create<T>(IReadOnlyList<T> items, int page, int pageSize, int totalCount) =>
        new(items, page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize));
}
