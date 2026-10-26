using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public sealed class StructureBreakStrategy(StrategyParameters parameters, TradeDirection direction) : IStrategy
{
    private readonly decimal _atrStop = parameters.GetDecimal("atrStop", 2m);
    private readonly decimal _rewardRisk = parameters.GetDecimal("rewardRisk", 2m);

    private IReadOnlyList<Candle> _candles = [];
    private IReadOnlyList<Swing> _pivots = [];
    private double[] _atr = [];
    private Swing? _level;
    private int _nextPivot;
    private int _lastBrokenIndex = -1;

    public void Prepare(IReadOnlyList<Candle> candles, IndicatorContext context)
    {
        _candles = candles;
        _pivots = context.Pivots;
        _atr = context.Atr14;
    }

    public Signal? Evaluate(int index)
    {
        var wantsHigh = direction == TradeDirection.Long;

        while (_nextPivot < _pivots.Count && _pivots[_nextPivot].ConfirmIndex <= index)
        {
            if (_pivots[_nextPivot].IsHigh == wantsHigh)
            {
                _level = _pivots[_nextPivot];
            }

            _nextPivot++;
        }

        if (_level is null || _level.Index == _lastBrokenIndex || double.IsNaN(_atr[index]))
        {
            return null;
        }

        var close = _candles[index].Close;
        var broken = wantsHigh ? close > _level.Price : close < _level.Price;
        if (!broken)
        {
            return null;
        }

        _lastBrokenIndex = _level.Index;
        var stop = (decimal)_atr[index] * _atrStop;
        return new Signal(direction, stop, stop * _rewardRisk);
    }
}
