using TradingChartAnalyzer.Features.Backtest.Models;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public static class StrategyFactory
{
    public const string EmaCross = "ema-cross";
    public const string RsiReversal = "rsi-reversal";
    public const string FibPullback = "fib-pullback";
    public const string AiSetup = "ai-setup";

    public static IStrategy? Create(BacktestRequest request)
    {
        var parameters = new StrategyParameters(request.Params);

        return request.Strategy switch
        {
            EmaCross => new EmaCrossStrategy(parameters),
            RsiReversal => new RsiReversalStrategy(parameters),
            FibPullback => new FibPullbackStrategy(parameters),
            AiSetup when request.Setup is not null => new AiSetupRuleStrategy(request.Setup),
            _ => null
        };
    }
}
