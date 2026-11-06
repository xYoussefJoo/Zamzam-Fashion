using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Zamzam.Application;

public static class DependencyInjection
{
    // Every use case is a class named "...Handler"; each is registered once here, so adding a
    // new use case never means touching this file.
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        foreach (var handler in assembly.GetTypes()
                     .Where(t => t is { IsClass: true, IsAbstract: false } && t.Name.EndsWith("Handler", StringComparison.Ordinal)))
            services.AddScoped(handler);

        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);
        return services;
    }
}
