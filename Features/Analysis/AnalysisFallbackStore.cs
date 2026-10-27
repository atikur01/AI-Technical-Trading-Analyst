using System.Text.Json;
using Microsoft.Extensions.Options;
using TradingChartAnalyzer.Features.Analysis.Models;
using TradingChartAnalyzer.Features.MarketData;
using TradingChartAnalyzer.Shared.Json;

namespace TradingChartAnalyzer.Features.Analysis;

public sealed class AnalysisFallbackStore(IOptions<AnalysisOptions> options, IWebHostEnvironment environment, ILogger<AnalysisFallbackStore> logger)
{
    private readonly string _directory = Path.Combine(environment.ContentRootPath, options.Value.FallbackDirectory);

    public async Task SaveAsync(string symbol, Timeframe timeframe, AnalysisResult result, CancellationToken cancellationToken)
    {
        try
        {
            Directory.CreateDirectory(_directory);
            await using var stream = File.Create(PathFor(symbol, timeframe));
            await JsonSerializer.SerializeAsync(stream, result, AppJson.Options, cancellationToken);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(exception, "Could not save fallback analysis for {Symbol} {Timeframe}", symbol, timeframe);
        }
    }

    public async Task<AnalysisResult?> TryLoadAsync(string symbol, Timeframe timeframe, CancellationToken cancellationToken)
    {
        var path = PathFor(symbol, timeframe);
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            await using var stream = File.OpenRead(path);
            return await JsonSerializer.DeserializeAsync<AnalysisResult>(stream, AppJson.Options, cancellationToken);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException)
        {
            logger.LogWarning(exception, "Could not load fallback analysis for {Symbol} {Timeframe}", symbol, timeframe);
            return null;
        }
    }

    private string PathFor(string symbol, Timeframe timeframe)
    {
        var safeSymbol = new string(symbol.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        return Path.Combine(_directory, $"{safeSymbol}-{timeframe}.json");
    }
}
