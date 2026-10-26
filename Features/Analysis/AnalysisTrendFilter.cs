using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Analysis;

public static class AnalysisTrendFilter
{
    private const int CloseColumn = 4;

    public static readonly Timeframe TrendTimeframe = Timeframe.H4;

    public static string? AllowedDirection(MarketSnapshot snapshot)
    {
        if (TimeframeExtensions.TryParse(snapshot.PrimaryTimeframe, out var primary) && primary.IsMacro())
        {
            return null;
        }

        var trend = snapshot.Timeframes.FirstOrDefault(t => t.Timeframe == TrendTimeframe.ToInterval());
        if (trend is null || trend.Candles.Count == 0 || trend.Indicators.Ema200 <= 0)
        {
            return null;
        }

        return trend.Candles[^1][CloseColumn] > trend.Indicators.Ema200 ? "long" : "short";
    }
}
