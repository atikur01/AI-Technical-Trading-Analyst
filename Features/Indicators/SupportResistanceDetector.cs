namespace TradingChartAnalyzer.Features.Indicators;

public sealed record PriceLevel(decimal Price, string Type, int Touches);

public static class SupportResistanceDetector
{
    public static IReadOnlyList<PriceLevel> Detect(IReadOnlyList<Swing> swings, decimal currentPrice, double atr, int maxLevels = 8)
    {
        if (swings.Count == 0)
        {
            return [];
        }

        var tolerance = Math.Max((decimal)(double.IsNaN(atr) ? 0 : atr * 0.5), currentPrice * 0.001m);
        var clusters = new List<List<decimal>>();

        foreach (var price in swings.Select(s => s.Price).OrderBy(p => p))
        {
            var current = clusters.Count > 0 ? clusters[^1] : null;
            if (current is not null && price - current.Average() <= tolerance)
            {
                current.Add(price);
            }
            else
            {
                clusters.Add([price]);
            }
        }

        return clusters
            .Where(c => c.Count >= 2)
            .Select(c =>
            {
                var price = c.Average();
                return new PriceLevel(price, price < currentPrice ? "support" : "resistance", c.Count);
            })
            .OrderBy(l => Math.Abs(l.Price - currentPrice))
            .Take(maxLevels)
            .OrderBy(l => l.Price)
            .ToList();
    }
}
