using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public sealed record Signal(TradeDirection Direction, decimal StopDistance, decimal TargetDistance);

public interface IStrategy
{
    void Prepare(IReadOnlyList<Candle> candles, IndicatorContext context);

    Signal? Evaluate(int index);
}
