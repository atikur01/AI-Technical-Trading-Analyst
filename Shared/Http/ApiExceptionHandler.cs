using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Polly.CircuitBreaker;
using Polly.Timeout;
using TradingChartAnalyzer.Features.Analysis;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Shared.Http;

public sealed class ApiExceptionHandler(IProblemDetailsService problemDetails, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    private const string ProviderUnavailable = "Market data provider is currently unavailable.";

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
        {
            return true;
        }

        var (status, title) = exception switch
        {
            MarketSymbolNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            MarketDataUnavailableException => (StatusCodes.Status502BadGateway, exception.Message),
            TimeoutRejectedException or BrokenCircuitException => (StatusCodes.Status503ServiceUnavailable, ProviderUnavailable),
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
