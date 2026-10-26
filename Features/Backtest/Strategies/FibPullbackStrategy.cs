using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public sealed class FibPullbackStrategy(StrategyParameters parameters, TradeDirection? onlyDirection = null) : IStrategy
{
    private readonly decimal _zoneStart = parameters.GetDecimal("zoneStart", 0.5m);
    private readonly decimal _zoneEnd = parameters.GetDecimal("zoneEnd", 0.618m);
    private readonly decimal _stopRatio = parameters.GetDecimal("stopRatio", 0.786m);
    private readonly decimal _atrBuffer = parameters.GetDecimal("atrBuffer", 0.5m);
    private readonly int _maxAge = parameters.GetInt("maxAge", 60);

    private IReadOnlyList<Candle> _candles = [];
    private IReadOnlyList<Swing> _pivots = [];
    private double[] _atr = [];
    private readonly List<Swing> _known = [];
    private int _nextPivot;
    private int _lastSignalledImpulse = -1;

    public void Prepare(IReadOnlyList<Candle> candles, IndicatorContext context)
    {
        _candles = candles;
        _pivots = context.Pivots;
        _atr = context.Atr14;
    }

    public Signal? Evaluate(int index)
    {
        while (_nextPivot < _pivots.Count && _pivots[_nextPivot].ConfirmIndex <= index)
        {
            _known.Add(_pivots[_nextPivot++]);
        }

        if (_known.Count < 2 || double.IsNaN(_atr[index]))
        {
            return null;
        }

        var last = _known[^1];
        var origin = _known.AsEnumerable().Reverse().Skip(1).FirstOrDefault(s => s.IsHigh != last.IsHigh);
        if (origin is null || last.Index == _lastSignalledImpulse || index - last.Index > _maxAge)
        {
            return null;
        }

        var direction = last.IsHigh ? TradeDirection.Long : TradeDirection.Short;
        if (onlyDirection is not null && onlyDirection != direction)
        {
            return null;
        }

        var range = last.Price - origin.Price;
        var candle = _candles[index];
        var zoneNear = last.Price - range * _zoneStart;
        var zoneFar = last.Price - range * _zoneEnd;
        var stopLevel = last.Price - range * _stopRatio;
        var buffer = (decimal)_atr[index] * _atrBuffer;

        var touched = direction == TradeDirection.Long
            ? candle.Low <= zoneNear && candle.Close >= zoneFar && candle.Close > candle.Open
            : candle.High >= zoneNear && candle.Close <= zoneFar && candle.Close < candle.Open;

        if (!touched)
        {
            return null;
        }

        var stopDistance = direction == TradeDirection.Long
            ? candle.Close - (stopLevel - buffer)
            : stopLevel + buffer - candle.Close;
        var targetDistance = Math.Abs(last.Price - candle.Close);

        if (stopDistance <= 0 || targetDistance < stopDistance)
        {
            return null;
        }

        _lastSignalledImpulse = last.Index;
        return new Signal(direction, stopDistance, targetDistance);
    }
}
