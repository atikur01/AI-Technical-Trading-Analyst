using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TradingChartAnalyzer.Features.Analysis;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Shared.Http;

public sealed class ApiExceptionHandler(IProblemDetailsService problemDetails, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            return true;
        }

        var (status, title) = exception switch
        {
            MarketDataUnavailableException => (StatusCodes.Status502BadGateway, exception.Message),
            AiUnavailableException => (StatusCodes.Status503ServiceUnavailable, exception.Message),
            AiResponseException => (StatusCodes.Status502BadGateway, exception.Message),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.")
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            logger.LogError(exception, "Unhandled exception");
        }

        httpContext.Response.StatusCode = status;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails { Status = status, Title = title }
        });
    }
}
