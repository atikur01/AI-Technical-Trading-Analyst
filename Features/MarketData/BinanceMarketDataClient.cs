using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.MarketData;

public sealed class BinanceMarketDataClient(
    HttpClient httpClient,
    IMemoryCache cache,
    IOptions<BinanceOptions> options,
    ILogger<BinanceMarketDataClient> logger) : IBinanceMarketDataClient
{
    private const int MaxPageSize = 1000;
    private readonly BinanceOptions _options = options.Value;

    public async Task<IReadOnlyList<Candle>> GetKlinesAsync(string symbol, Timeframe timeframe, int limit, CancellationToken cancellationToken)
    {
        limit = Math.Clamp(limit, 1, MaxPageSize);
        var key = $"klines:{symbol}:{timeframe}:{limit}";

        if (cache.TryGetValue(key, out IReadOnlyList<Candle>? cached) && cached is not null)
        {
            return cached;
        }

        var candles = await FetchAsync($"symbol={symbol}&interval={timeframe.ToInterval()}&limit={limit}", cancellationToken);
        cache.Set(key, candles, TimeSpan.FromSeconds(_options.CacheSeconds));
        return candles;
    }

    public async Task<IReadOnlyList<Candle>> GetKlinesRangeAsync(string symbol, Timeframe timeframe, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken)
    {
        var step = timeframe.ToMilliseconds();
        var cursor = from.ToUnixTimeMilliseconds();
        var end = to.ToUnixTimeMilliseconds();
        var result = new List<Candle>();

        while (cursor < end && result.Count < _options.MaxRangeCandles)
        {
            var page = await FetchAsync($"symbol={symbol}&interval={timeframe.ToInterval()}&startTime={cursor}&endTime={end}&limit={MaxPageSize}", cancellationToken);
            if (page.Count == 0)
            {
                break;
            }

            result.AddRange(page);
            cursor = page[^1].OpenTime + step;

            if (page.Count < MaxPageSize)
            {
                break;
            }
        }

        return result;
    }

    public async Task<bool> PingAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.GetAsync("/api/v3/ping", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(exception, "Binance ping failed");
            return false;
        }
    }

    private async Task<IReadOnlyList<Candle>> FetchAsync(string query, CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.GetAsync($"/api/v3/klines?{query}", cancellationToken);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            return document.RootElement.EnumerateArray().Select(ParseCandle).ToList();
        }
        catch (HttpRequestException exception)
        {
            logger.LogError(exception, "Binance klines request failed for {Query}", query);
            throw new MarketDataUnavailableException("Market data provider is currently unavailable.", exception);
        }
    }

    private static Candle ParseCandle(JsonElement row) => new(
        row[0].GetInt64(),
        ParseDecimal(row[1]),
        ParseDecimal(row[2]),
        ParseDecimal(row[3]),
        ParseDecimal(row[4]),
        ParseDecimal(row[5]),
        row[6].GetInt64());

    private static decimal ParseDecimal(JsonElement element) =>
        decimal.Parse(element.GetString()!, CultureInfo.InvariantCulture);
}

public sealed class MarketDataUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
