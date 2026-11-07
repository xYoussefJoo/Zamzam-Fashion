using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Zamzam.Api.Errors;

// [FromQuery] records publish their property names (Category, PageSize), but the contract and every URL use
// camelCase (?category=…&pageSize=…). Binding ignores case, so only openapi.json needs the camelCase names,
// and then the generated TypeScript types match the URLs.
public sealed class CamelCaseQueryTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        foreach (var parameter in operation.Parameters ?? [])
        {
            if (parameter is OpenApiParameter { In: ParameterLocation.Query, Name: { Length: > 0 } name } query && char.IsUpper(name[0]))
                query.Name = char.ToLowerInvariant(name[0]) + name[1..];
        }
        return Task.CompletedTask;
    }
}
