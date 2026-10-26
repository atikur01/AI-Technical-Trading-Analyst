using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Backtest.Strategies;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest;

public sealed class BacktestService(IBinanceMarketDataClient marketData, BacktestEngine engine, ILogger<BacktestService> logger)
{
    private const int WarmupCandles = 250;
    private const int EquityPointsLimit = 1000;
    private const int MinimumCandles = 100;

    public async Task<BacktestResult> RunAsync(string symbol, Timeframe timeframe, BacktestRequest request, IStrategy strategy, CancellationToken cancellationToken)
    {
        var step = timeframe.ToMilliseconds();
        var warmupStart = request.From.AddMilliseconds(-WarmupCandles * step);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var fetched = await marketData.GetKlinesRangeAsync(symbol, timeframe, warmupStart, request.To, cancellationToken);
        var candles = fetched.Where(c => c.CloseTime < now).ToList();
        var startIndex = candles.FindIndex(c => c.OpenTime >= request.From.ToUnixTimeMilliseconds());

        if (startIndex < 0 || candles.Count - startIndex < MinimumCandles)
        {
            throw new BacktestInputException("Not enough candles in the selected range.");
        }

        var settings = new EngineSettings(request.InitialBalance, request.RiskPercent, request.FeePercent, request.SlippagePercent);
        var output = engine.Run(candles, startIndex, strategy, settings);
        var metrics = BacktestMetricsCalculator.Calculate(output.Trades, output.Equity, request.InitialBalance, step);

        logger.LogInformation("Backtest {Strategy} {Symbol} {Timeframe}: {Trades} trades over {Candles} candles", request.Strategy, symbol, timeframe, metrics.TotalTrades, candles.Count - startIndex);

        var warnings = new List<string>();
        if (metrics.TotalTrades < 30)
        {
            warnings.Add("Fewer than 30 trades: results are not statistically meaningful.");
        }

        return new BacktestResult(
            metrics,
            output.Trades,
            BacktestMetricsCalculator.Downsample(output.Equity, EquityPointsLimit),
            candles.Count - startIndex,
            warnings);
    }
}

public sealed class BacktestInputException(string message) : Exception(message);
