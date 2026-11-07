using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Zamzam.Api.Errors;

// [Idempotent] is a filter, so OpenAPI can't see the header it needs. This adds it to openapi.json,
// so a generated client knows POST /api/orders and POST /api/tailoring/requests must send it.
public sealed class IdempotencyHeaderTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        if (context.Description.ActionDescriptor.EndpointMetadata.OfType<IdempotentAttribute>().Any())
        {
            operation.Parameters ??= [];
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = IdempotencyFilter.HeaderName,
                In = ParameterLocation.Header,
                Required = true,
                Description = "A new UUID per checkout attempt. Repeating the same key returns the first response.",
                Schema = new OpenApiSchema { Type = JsonSchemaType.String, Format = "uuid" },
            });
        }
        return Task.CompletedTask;
    }
}
