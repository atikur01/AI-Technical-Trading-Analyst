namespace TradingChartAnalyzer.Features.MarketData;

public enum Timeframe
{
    M1,
    M5,
    M15,
    H1,
    H4,
    D1
}

public static class TimeframeExtensions
{
    private static readonly Dictionary<Timeframe, (string Interval, long Milliseconds)> Map = new()
    {
        [Timeframe.M1] = ("1m", 60_000L),
        [Timeframe.M5] = ("5m", 300_000L),
        [Timeframe.M15] = ("15m", 900_000L),
        [Timeframe.H1] = ("1h", 3_600_000L),
        [Timeframe.H4] = ("4h", 14_400_000L),
        [Timeframe.D1] = ("1d", 86_400_000L)
    };

    public static string ToInterval(this Timeframe timeframe) => Map[timeframe].Interval;

    public static long ToMilliseconds(this Timeframe timeframe) => Map[timeframe].Milliseconds;

    public static bool TryParse(string? interval, out Timeframe timeframe)
    {
        foreach (var (key, value) in Map)
        {
            if (string.Equals(value.Interval, interval, StringComparison.OrdinalIgnoreCase))
            {
                timeframe = key;
                return true;
            }
        }

        timeframe = default;
        return false;
    }

    public static IReadOnlyList<Timeframe> HigherTimeframes(this Timeframe timeframe) =>
        Enum.GetValues<Timeframe>().Where(t => t > timeframe && t >= Timeframe.H1).ToList();
}
