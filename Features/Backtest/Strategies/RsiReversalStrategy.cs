using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public sealed class RsiReversalStrategy(StrategyParameters parameters, TradeDirection? onlyDirection = null) : IStrategy
{
    private readonly int _period = parameters.GetInt("period", 14);
    private readonly double _oversold = parameters.GetDouble("oversold", 30);
    private readonly double _overbought = parameters.GetDouble("overbought", 70);
    private readonly decimal _atrStop = parameters.GetDecimal("atrStop", 1.5m);
    private readonly decimal _rewardRisk = parameters.GetDecimal("rewardRisk", 2m);

    private double[] _rsi = [];
    private double[] _atr = [];

    public void Prepare(IReadOnlyList<Candle> candles, IndicatorContext context)
    {
        _rsi = IndicatorCalculator.Rsi(context.Closes, _period);
        _atr = context.Atr14;
    }

    public Signal? Evaluate(int index)
    {
        if (index < 1 || double.IsNaN(_rsi[index - 1]) || double.IsNaN(_atr[index]))
        {
            return null;
        }

        var longSignal = _rsi[index - 1] < _oversold && _rsi[index] >= _oversold;
        var shortSignal = _rsi[index - 1] > _overbought && _rsi[index] <= _overbought;
        var direction = longSignal ? TradeDirection.Long : shortSignal ? TradeDirection.Short : (TradeDirection?)null;

        if (direction is null || (onlyDirection is not null && onlyDirection != direction))
        {
            return null;
        }

        var stop = (decimal)_atr[index] * _atrStop;
        return new Signal(direction.Value, stop, stop * _rewardRisk);
    }
}
