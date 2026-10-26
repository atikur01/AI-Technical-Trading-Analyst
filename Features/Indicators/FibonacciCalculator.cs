namespace TradingChartAnalyzer.Features.Indicators;

public sealed record FibLevel(double Ratio, decimal Price);

public sealed record FibonacciSet(
    string Direction,
    long FromTime,
    decimal FromPrice,
    long ToTime,
    decimal ToPrice,
    IReadOnlyList<FibLevel> Retracements,
    IReadOnlyList<FibLevel> Extensions);

public static class FibonacciCalculator
{
    public static readonly double[] RetracementRatios = [0.236, 0.382, 0.5, 0.618, 0.786];
    public static readonly double[] ExtensionRatios = [1.272, 1.618];

    public static FibonacciSet? Calculate(IReadOnlyList<Swing> swings)
    {
        if (swings.Count < 2)
        {
            return null;
        }

        var last = swings[^1];
        var origin = swings.Reverse().Skip(1).FirstOrDefault(s => s.IsHigh != last.IsHigh);
        if (origin is null || origin.Price == last.Price)
        {
            return null;
        }

        var range = last.Price - origin.Price;

        decimal Level(double ratio) => last.Price - range * (decimal)ratio;

        return new FibonacciSet(
            last.IsHigh ? "bullish" : "bearish",
            origin.Time,
            origin.Price,
            last.Time,
            last.Price,
            RetracementRatios.Select(r => new FibLevel(r, Level(r))).ToList(),
            ExtensionRatios.Select(r => new FibLevel(r, origin.Price + range * (decimal)r)).ToList());
    }
}
