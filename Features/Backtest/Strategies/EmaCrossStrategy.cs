using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public sealed class EmaCrossStrategy(StrategyParameters parameters, TradeDirection? onlyDirection = null) : IStrategy
{
    private readonly int _fastPeriod = parameters.GetInt("fast", 20);
    private readonly int _slowPeriod = parameters.GetInt("slow", 50);
    private readonly decimal _atrStop = parameters.GetDecimal("atrStop", 2m);
    private readonly decimal _rewardRisk = parameters.GetDecimal("rewardRisk", 2m);

    private double[] _fast = [];
    private double[] _slow = [];
    private double[] _atr = [];

    public void Prepare(IReadOnlyList<Candle> candles, IndicatorContext context)
    {
        _fast = IndicatorCalculator.Ema(context.Closes, _fastPeriod);
        _slow = IndicatorCalculator.Ema(context.Closes, _slowPeriod);
        _atr = context.Atr14;
    }

    public Signal? Evaluate(int index)
    {
        if (index < 1 || double.IsNaN(_slow[index - 1]) || double.IsNaN(_atr[index]))
        {
            return null;
        }

        var crossedUp = _fast[index - 1] <= _slow[index - 1] && _fast[index] > _slow[index];
        var crossedDown = _fast[index - 1] >= _slow[index - 1] && _fast[index] < _slow[index];

        var direction = crossedUp ? TradeDirection.Long : crossedDown ? TradeDirection.Short : (TradeDirection?)null;

        if (direction is null || (onlyDirection is not null && onlyDirection != direction))
        {
            return null;
        }

        var stop = (decimal)_atr[index] * _atrStop;
        return new Signal(direction.Value, stop, stop * _rewardRisk);
    }
}
