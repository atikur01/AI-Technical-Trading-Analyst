using System.Collections.Concurrent;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using TradingChartAnalyzer.Features.Analysis.Models;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;
using TradingChartAnalyzer.Shared.Json;

namespace TradingChartAnalyzer.Features.Analysis;

public sealed class AnalysisService(
    IMarketDataService marketData,
    IAiChatClient aiClient,
    IMemoryCache cache,
    AnalysisFallbackStore fallbackStore,
    IOptions<AiOptions> aiOptions,
    ILogger<AnalysisService> logger)
{
    private const int CandlesPerTimeframe = 500;
    private const int MinimumCandles = 60;

    private static readonly ConcurrentDictionary<string, Lazy<Task<AnalysisResult>>> InFlight = new();

    public async Task<AnalysisResult> AnalyzeAsync(string symbol, Timeframe timeframe, CancellationToken cancellationToken)
    {
        var snapshot = await BuildSnapshotAsync(symbol, timeframe, cancellationToken);
        var lastCandleTime = snapshot.Timeframes.First(t => t.Timeframe == timeframe.ToInterval()).Candles[^1][0];
        var cacheKey = $"analysis:{symbol}:{timeframe}:{lastCandleTime}";

        if (cache.TryGetValue(cacheKey, out AnalysisResult? cached) && cached is not null)
        {
            return cached;
        }

        var analysis = InFlight.GetOrAdd(cacheKey, key => new Lazy<Task<AnalysisResult>>(() => ComputeAsync(key, symbol, timeframe, snapshot)));

        try
        {
            return await analysis.Value.WaitAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is AiUnavailableException or AiResponseException)
        {
            var fallback = await fallbackStore.TryLoadAsync(symbol, timeframe, cancellationToken);
            if (fallback is null)
            {
                throw;
            }

            logger.LogWarning("Serving saved analysis for {Symbol} {Timeframe}: {Reason}", symbol, timeframe, exception.Message);
            fallback.IsFallback = true;
            return fallback;
        }
    }

    private async Task<AnalysisResult> ComputeAsync(string cacheKey, string symbol, Timeframe timeframe, MarketSnapshot snapshot)
    {
        try
        {
            var userPrompt = AnalysisPromptBuilder.BuildUserPrompt(snapshot);
            var raw = await RequestAnalysisAsync(userPrompt, CancellationToken.None);
            var result = AnalysisResultValidator.Validate(raw, snapshot);
            result.Model = aiOptions.Value.Model;
            result.GeneratedAt = DateTimeOffset.UtcNow;

            logger.LogInformation("Analysis for {Symbol} {Timeframe}: {Setups} setups, {Drawings} drawings, {Warnings} warnings",
                symbol, timeframe, result.Setups.Count, result.Drawings.Count, result.Warnings.Count);

            cache.Set(cacheKey, result, TimeSpan.FromMilliseconds(timeframe.ToMilliseconds()));
            await fallbackStore.SaveAsync(symbol, timeframe, result, CancellationToken.None);
            return result;
        }
        finally
        {
            InFlight.TryRemove(cacheKey, out _);
        }
    }

    private async Task<MarketSnapshot> BuildSnapshotAsync(string symbol, Timeframe timeframe, CancellationToken cancellationToken)
    {
        var timeframes = (timeframe.IsMacro()
            ? new[] { timeframe, Timeframe.D1, Timeframe.W1, Timeframe.MN1 }
            : new[] { timeframe, Timeframe.H1, Timeframe.H4, Timeframe.D1 }).Distinct().ToList();
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var fetched = await Task.WhenAll(timeframes.Select(tf => FetchClosedCandlesAsync(symbol, tf, tf == timeframe, now, cancellationToken)));

        var usable = fetched.Where(f => f.Candles.Count >= MinimumCandles).ToDictionary(f => f.Timeframe, f => f.Candles);

        if (!usable.ContainsKey(timeframe))
        {
            throw new MarketDataUnavailableException($"Not enough {timeframe.ToInterval()} history to analyze {symbol}. Try a lower timeframe.");
        }

        return MarketSnapshotBuilder.Build(symbol, timeframe, usable);
    }

    private async Task<(Timeframe Timeframe, IReadOnlyList<Candle> Candles)> FetchClosedCandlesAsync(
        string symbol, Timeframe timeframe, bool required, long now, CancellationToken cancellationToken)
    {
        try
        {
            var candles = await marketData.GetKlinesAsync(symbol, timeframe, CandlesPerTimeframe, cancellationToken);
            return (timeframe, candles.Where(c => c.CloseTime < now).ToList());
        }
        catch (MarketDataUnavailableException exception) when (!required)
        {
            logger.LogWarning(exception, "Skipping {Timeframe} candles for {Symbol}", timeframe, symbol);
            return (timeframe, []);
        }
    }

    private async Task<AnalysisResult> RequestAnalysisAsync(string userPrompt, CancellationToken cancellationToken)
    {
        var prompt = userPrompt;

        for (var attempt = 1; attempt <= 2; attempt++)
        {
            var text = await aiClient.CompleteJsonAsync(AnalysisPromptBuilder.SystemPrompt, prompt, cancellationToken);

            if (TryParse(text, out var result))
            {
                return result;
            }

            logger.LogWarning("AI returned unparseable analysis on attempt {Attempt}", attempt);
            prompt = AnalysisPromptBuilder.BuildRepairPrompt(text);
        }

        throw new AiResponseException("AI returned a response that could not be understood.");
    }

    private static bool TryParse(string text, out AnalysisResult result)
    {
        result = new AnalysisResult();
        var start = text.IndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start)
        {
            return false;
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<AnalysisResult>(text[start..(end + 1)], AppJson.Options);
            if (parsed?.Analysis is null)
            {
                return false;
            }

            result = parsed;
            return true;
        }
        catch (Exception exception) when (exception is JsonException or NotSupportedException)
        {
            return false;
        }
    }
}

public sealed class AiResponseException(string message) : Exception(message);
