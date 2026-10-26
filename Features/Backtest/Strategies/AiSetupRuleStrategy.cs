using TradingChartAnalyzer.Features.Analysis.Models;
using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public sealed class AiSetupRuleStrategy : IStrategy
{
    private readonly IStrategy _entryRule;
    private readonly decimal _stopFraction;
    private readonly decimal _targetFraction;
    private IReadOnlyList<Candle> _candles = [];

    public AiSetupRuleStrategy(TradeSetup setup)
    {
        var direction = setup.Direction == "short" ? TradeDirection.Short : TradeDirection.Long;
        var parameters = new StrategyParameters(setup.Rules?.Params);

        _entryRule = (setup.Rules?.Indicator ?? string.Empty).ToLowerInvariant() switch
        {
            "ema" => new EmaCrossStrategy(parameters, direction),
            "rsi" => new RsiReversalStrategy(parameters, direction),
            "fib" => new FibPullbackStrategy(parameters, direction),
            _ => new StructureBreakStrategy(parameters, direction)
        };

        _stopFraction = Math.Abs(setup.Entry - setup.StopLoss) / setup.Entry;
        _targetFraction = Math.Abs(setup.TakeProfits[0] - setup.Entry) / setup.Entry;
    }

    public void Prepare(IReadOnlyList<Candle> candles, IndicatorContext context)
    {
        _candles = candles;
        _entryRule.Prepare(candles, context);
    }

    public Signal? Evaluate(int index)
    {
        var signal = _entryRule.Evaluate(index);
        if (signal is null)
        {
            return null;
        }

        var close = _candles[index].Close;
        return new Signal(signal.Direction, close * _stopFraction, close * _targetFraction);
    }
}
