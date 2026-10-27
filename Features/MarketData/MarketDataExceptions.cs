using System.Text.Json;
using Polly.CircuitBreaker;
using Polly.Timeout;

namespace TradingChartAnalyzer.Features.MarketData;

public sealed class MarketDataUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

public sealed class MarketDataRateLimitedException()
    : Exception("Market data request limit reached. Please try again later.");

public sealed class MarketSymbolNotFoundException(string message) : Exception(message);

public static class MarketDataFailure
{
    public static bool IsProviderFailure(Exception exception) =>
        exception is HttpRequestException or JsonException or KeyNotFoundException or FormatException
            or InvalidOperationException or ArgumentException or TimeoutRejectedException or BrokenCircuitException;
}
