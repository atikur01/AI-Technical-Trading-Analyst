using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Backtest.Strategies;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest;

public sealed record EngineSettings(decimal InitialBalance, decimal RiskPercent, decimal FeePercent, decimal SlippagePercent);

public sealed record EngineOutput(IReadOnlyList<BacktestTrade> Trades, IReadOnlyList<EquityPoint> Equity);

public sealed class BacktestEngine
{
    public EngineOutput Run(IReadOnlyList<Candle> candles, int startIndex, IStrategy strategy, EngineSettings settings)
    {
        strategy.Prepare(candles, IndicatorContext.Create(candles));

        var fee = settings.FeePercent / 100m;
        var slippage = settings.SlippagePercent / 100m;
        var risk = settings.RiskPercent / 100m;
        var balance = settings.InitialBalance;
        var trades = new List<BacktestTrade>();
        var equity = new List<EquityPoint>();
        OpenPosition? position = null;
        Signal? pending = null;

        for (var i = startIndex; i < candles.Count; i++)
        {
            var candle = candles[i];

            if (pending is not null && position is null)
            {
                position = Open(pending, candle, balance, risk, fee, slippage);
                pending = null;
            }

            if (position is not null)
            {
                var exit = FindExit(position, candle, slippage);
                if (exit is not null)
                {
                    balance += Close(position, candle.OpenTimeSeconds, exit.Value.Price, exit.Value.Reason, fee, trades);
                    position = null;
                }
            }

            equity.Add(new EquityPoint(candle.OpenTimeSeconds, balance + (position?.Unrealized(candle.Close) ?? 0m)));

            if (position is null && i < candles.Count - 1)
            {
                pending = strategy.Evaluate(i);
            }
        }

        if (position is not null)
        {
            var last = candles[^1];
            balance += Close(position, last.OpenTimeSeconds, last.Close, "end", fee, trades);
            equity[^1] = new EquityPoint(last.OpenTimeSeconds, balance);
        }

        return new EngineOutput(trades, equity);
    }

    private static OpenPosition Open(Signal signal, Candle candle, decimal balance, decimal risk, decimal fee, decimal slippage)
    {
        var isLong = signal.Direction == TradeDirection.Long;
        var entry = candle.Open * (isLong ? 1 + slippage : 1 - slippage);
        var stopDistance = signal.StopDistance;
        var stop = isLong ? entry - stopDistance : entry + stopDistance;
        var target = isLong ? entry + signal.TargetDistance : entry - signal.TargetDistance;
        var quantity = Math.Min(balance * risk / stopDistance, balance / (entry * (1 + fee)));

        return new OpenPosition(isLong, candle.OpenTimeSeconds, entry, stop, target, quantity, stopDistance * quantity);
    }

    private static (decimal Price, string Reason)? FindExit(OpenPosition position, Candle candle, decimal slippage)
    {
        if (position.IsLong)
        {
            if (candle.Low <= position.Stop)
            {
                return (Math.Min(position.Stop, candle.Open) * (1 - slippage), "stop");
            }

            return candle.High >= position.Target ? (Math.Max(position.Target, Math.Min(candle.Open, candle.High)), "target") : null;
        }

        if (candle.High >= position.Stop)
        {
            return (Math.Max(position.Stop, candle.Open) * (1 + slippage), "stop");
        }

        return candle.Low <= position.Target ? (Math.Min(position.Target, Math.Max(candle.Open, candle.Low)), "target") : null;
    }

    private static decimal Close(OpenPosition position, long exitTime, decimal exitPrice, string reason, decimal fee, List<BacktestTrade> trades)
    {
        var gross = (exitPrice - position.Entry) * position.Quantity * (position.IsLong ? 1 : -1);
        var fees = (position.Entry + exitPrice) * position.Quantity * fee;
        var pnl = gross - fees;

        trades.Add(new BacktestTrade(
            trades.Count + 1,
            position.IsLong ? "long" : "short",
            position.EntryTime,
            position.Entry,
            exitTime,
            exitPrice,
            position.Stop,
            position.Target,
            position.Quantity,
            fees,
            pnl,
            position.RiskAmount == 0 ? 0 : pnl / position.RiskAmount,
            reason));

        return pnl;
    }

    private sealed record OpenPosition(bool IsLong, long EntryTime, decimal Entry, decimal Stop, decimal Target, decimal Quantity, decimal RiskAmount)
    {
        public decimal Unrealized(decimal price) => (price - Entry) * Quantity * (IsLong ? 1 : -1);
    }
}
