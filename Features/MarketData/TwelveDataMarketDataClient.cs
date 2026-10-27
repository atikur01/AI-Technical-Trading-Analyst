using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.MarketData;

public sealed class TwelveDataMarketDataClient(
    HttpClient httpClient,
    IMemoryCache cache,
    IOptions<TwelveDataOptions> options,
    ILogger<TwelveDataMarketDataClient> logger) : ITwelveDataMarketDataClient
{
    private const int MaxPageSize = 5000;
    private readonly TwelveDataOptions _options = options.Value;

    public async Task<IReadOnlyList<Candle>> GetKlinesAsync(string symbol, Timeframe timeframe, int limit, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new MarketDataUnavailableException("Forex and stock data needs a Twelve Data API key (TwelveData:ApiKey).");
        }

        limit = Math.Clamp(limit, 1, MaxPageSize);
        var key = $"twelvedata:{symbol}:{timeframe}:{limit}";

        if (cache.TryGetValue(key, out IReadOnlyList<Candle>? cached) && cached is not null)
        {
            return cached;
        }

        var query = $"symbol={Uri.EscapeDataString(symbol)}&interval={ToInterval(timeframe)}&outputsize={limit}&order=ASC&timezone=UTC";
        var candles = await FetchAsync(query, timeframe, cancellationToken);
        cache.Set(key, candles, TimeSpan.FromSeconds(_options.CacheSeconds));
        return candles;
    }

    private async Task<IReadOnlyList<Candle>> FetchAsync(string query, Timeframe timeframe, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.GetAsync($"/time_series?{query}", cancellationToken);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = document.RootElement;

            if (root.TryGetProperty("status", out var status) && status.GetString() == "error")
            {
                var message = root.TryGetProperty("message", out var text) ? text.GetString() : null;
                logger.LogWarning("Twelve Data rejected {Query}: {Message}", query, message);
                throw new MarketDataUnavailableException(message ?? "Market data provider rejected the request.");
            }

            var step = timeframe.ToMilliseconds();
            return root.GetProperty("values").EnumerateArray().Select(row => ParseCandle(row, step)).ToList();
        }
        catch (Exception exception) when (exception is HttpRequestException or JsonException or KeyNotFoundException)
        {
            logger.LogError(exception, "Twelve Data request failed for {Query}", query);
            throw new MarketDataUnavailableException("Market data provider is currently unavailable.", exception);
        }
    }

    private static Candle ParseCandle(JsonElement row, long step)
    {
        var openTime = DateTimeOffset.Parse(
            row.GetProperty("datetime").GetString()!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal).ToUnixTimeMilliseconds();

        return new Candle(
            openTime,
            ParseDecimal(row, "open"),
            ParseDecimal(row, "high"),
            ParseDecimal(row, "low"),
            ParseDecimal(row, "close"),
            row.TryGetProperty("volume", out _) ? ParseDecimal(row, "volume") : 0m,
            openTime + step - 1);
    }

    private static decimal ParseDecimal(JsonElement row, string name) =>
        decimal.Parse(row.GetProperty(name).GetString()!, CultureInfo.InvariantCulture);

    private static string ToInterval(Timeframe timeframe) => timeframe switch
    {
        Timeframe.M1 => "1min",
        Timeframe.M5 => "5min",
        Timeframe.M15 => "15min",
        Timeframe.H1 => "1h",
        Timeframe.H4 => "4h",
        Timeframe.D1 => "1day",
        Timeframe.W1 => "1week",
        _ => "1month"
    };
}
