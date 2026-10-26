using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Backtest.Strategies;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest;

public static class BacktestRequestValidator
{
    public const int MaxCandles = 20_000;
    private const decimal MaxBalance = 1_000_000_000m;

    public static string? Validate(BacktestRequest request, Timeframe timeframe)
    {
        if (request.From >= request.To)
        {
            return "Start date must be before end date.";
        }

        if (request.To > DateTimeOffset.UtcNow)
        {
            return "End date cannot be in the future.";
        }

        if ((request.To - request.From).TotalMilliseconds / timeframe.ToMilliseconds() > MaxCandles)
        {
            return $"Date range exceeds {MaxCandles} candles for this timeframe.";
        }

        if (request.InitialBalance <= 0 || request.InitialBalance > MaxBalance)
        {
            return "Initial balance is out of range.";
        }

        if (request.RiskPercent <= 0 || request.RiskPercent > 100)
        {
            return "Risk percent must be between 0 and 100.";
        }

        if (request.FeePercent is < 0 or > 5 || request.SlippagePercent is < 0 or > 5)
        {
            return "Fee and slippage must be between 0 and 5 percent.";
        }

        if (request.Strategy == StrategyFactory.AiSetup && !HasValidSetup(request))
        {
            return "A valid AI setup is required for this strategy.";
        }

        return null;
    }

    private static bool HasValidSetup(BacktestRequest request)
    {
        var setup = request.Setup;
        if (setup is null || setup.Entry <= 0 || setup.StopLoss <= 0 || setup.Entry == setup.StopLoss)
        {
            return false;
        }

        return setup.TakeProfits is { Count: > 0 } && setup.TakeProfits[0] > 0 && setup.TakeProfits[0] != setup.Entry;
    }
}
