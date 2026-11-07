using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Zamzam.Api.Errors;

// Runs the FluentValidation validator for every request body / query object before the action.
// Failures become a 400 ValidationProblem with camelCase field names: { "errors": { "variants[0].size": [...] } }.
public sealed class ValidationFilter(IServiceProvider services, ProblemDetailsFactory problemDetails) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        // A fresh dictionary: MVC's own ModelState already holds case-insensitive keys like "Q" from
        // model binding, and adding "q" there would keep the old spelling.
        var errors = new ModelStateDictionary();
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;
            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (services.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            foreach (var error in result.Errors)
                errors.AddModelError(CamelCase(error.PropertyName), error.ErrorMessage);
        }

        if (!errors.IsValid)
        {
            var problem = problemDetails.CreateValidationProblemDetails(context.HttpContext, errors);
            context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status400BadRequest };
            return;
        }

        await next();
    }

    // "Variants[0].Size" -> "variants[0].size"
    public static string CamelCase(string path) =>
        string.Join('.', path.Split('.').Select(part => part.Length == 0 ? part : char.ToLowerInvariant(part[0]) + part[1..]));
}
