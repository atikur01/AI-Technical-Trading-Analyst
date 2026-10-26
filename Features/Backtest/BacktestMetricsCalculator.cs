using TradingChartAnalyzer.Features.Backtest.Models;

namespace TradingChartAnalyzer.Features.Backtest;

public static class BacktestMetricsCalculator
{
    private const double MillisecondsPerYear = 365.0 * 24 * 3600 * 1000;

    public static BacktestMetrics Calculate(IReadOnlyList<BacktestTrade> trades, IReadOnlyList<EquityPoint> equity, decimal initialBalance, long timeframeMilliseconds)
    {
        var wins = trades.Count(t => t.Pnl > 0);
        var grossProfit = trades.Where(t => t.Pnl > 0).Sum(t => t.Pnl);
        var grossLoss = -trades.Where(t => t.Pnl < 0).Sum(t => t.Pnl);
        var netPnl = trades.Sum(t => t.Pnl);

        return new BacktestMetrics(
            trades.Count,
            wins,
            trades.Count(t => t.Pnl < 0),
            trades.Count == 0 ? 0 : Math.Round(wins * 100.0 / trades.Count, 2),
            grossLoss == 0 ? null : Math.Round((double)(grossProfit / grossLoss), 2),
            Math.Round(netPnl, 2),
            Math.Round((double)(netPnl / initialBalance * 100), 2),
            Math.Round(MaxDrawdown(equity), 2),
            trades.Count == 0 ? 0 : Math.Round(netPnl / trades.Count, 2),
            trades.Count == 0 ? 0 : Math.Round(trades.Average(t => (double)t.RMultiple), 2),
            Math.Round(Sharpe(equity, timeframeMilliseconds), 2),
            Math.Round(initialBalance + netPnl, 2));
    }

    public static IReadOnlyList<EquityPoint> Downsample(IReadOnlyList<EquityPoint> equity, int maxPoints)
    {
        if (equity.Count <= maxPoints)
        {
            return equity;
        }

        var step = (int)Math.Ceiling(equity.Count / (double)maxPoints);
        var sampled = equity.Where((_, index) => index % step == 0).ToList();
        if (sampled[^1] != equity[^1])
        {
            sampled.Add(equity[^1]);
        }

        return sampled;
    }

    private static double MaxDrawdown(IReadOnlyList<EquityPoint> equity)
    {
        decimal peak = 0;
        decimal maxDrawdown = 0;

        foreach (var point in equity)
        {
            peak = Math.Max(peak, point.Equity);
            if (peak > 0)
            {
                maxDrawdown = Math.Max(maxDrawdown, (peak - point.Equity) / peak);
            }
        }

        return (double)(maxDrawdown * 100);
    }

    private static double Sharpe(IReadOnlyList<EquityPoint> equity, long timeframeMilliseconds)
    {
        if (equity.Count < 3)
        {
            return 0;
        }

        var returns = new List<double>(equity.Count - 1);
        for (var i = 1; i < equity.Count; i++)
        {
            if (equity[i - 1].Equity > 0)
            {
                returns.Add((double)((equity[i].Equity - equity[i - 1].Equity) / equity[i - 1].Equity));
            }
        }

        if (returns.Count < 2)
        {
            return 0;
        }

        var mean = returns.Average();
        var deviation = Math.Sqrt(returns.Sum(r => Math.Pow(r - mean, 2)) / (returns.Count - 1));
        return deviation == 0 ? 0 : mean / deviation * Math.Sqrt(MillisecondsPerYear / timeframeMilliseconds);
    }
}
