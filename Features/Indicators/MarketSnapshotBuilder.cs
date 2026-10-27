using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Indicators;

public static class MarketSnapshotBuilder
{
    private const int SnapshotCandles = 150;
    private const int SnapshotSwings = 12;
    private const int SnapshotEvents = 6;
    private const int FutureCandlesAllowed = 50;

    public static MarketSnapshot Build(string symbol, Timeframe primary, IReadOnlyDictionary<Timeframe, IReadOnlyList<Candle>> candlesByTimeframe)
    {
        var primaryCandles = candlesByTimeframe[primary];
        var currentPrice = primaryCandles[^1].Close;

        var included = candlesByTimeframe.Values.SelectMany(c => c.TakeLast(SnapshotCandles)).ToList();
        var range = new SnapshotRange(
            included.Min(c => c.Low),
            included.Max(c => c.High),
            included.Min(c => c.OpenTimeSeconds),
            primaryCandles[^1].OpenTimeSeconds + FutureCandlesAllowed * primary.ToMilliseconds() / 1000);

        var timeframes = candlesByTimeframe
            .OrderBy(pair => pair.Key)
            .Select(pair => BuildTimeframe(pair.Key, pair.Value, currentPrice, range.FromTime))
            .ToList();

        return new MarketSnapshot(symbol, primary.ToInterval(), Round(currentPrice, currentPrice), range, timeframes);
    }

    private static TimeframeSnapshot BuildTimeframe(Timeframe timeframe, IReadOnlyList<Candle> candles, decimal currentPrice, long fromTime)
    {
        var context = IndicatorContext.Create(candles);
        var last = candles.Count - 1;
        var atr = Last(context.Atr14);
        var swings = SwingDetector.LabelStructure(context.Pivots);

        var indicators = new IndicatorValues(
            Round(context.Ema20[last], currentPrice),
            Round(context.Ema50[last], currentPrice),
            Round(context.Ema200[last], currentPrice),
            Math.Round(Safe(context.Rsi14[last]), 1),
            Round(context.Macd.Line[last], currentPrice),
            Round(context.Macd.Signal[last], currentPrice),
            Round(context.Macd.Histogram[last], currentPrice),
            Round(context.Bollinger.Upper[last], currentPrice),
            Round(context.Bollinger.Middle[last], currentPrice),
            Round(context.Bollinger.Lower[last], currentPrice),
            Round(context.Vwap[last], currentPrice));

        return new TimeframeSnapshot(
            timeframe.ToInterval(),
            Round(atr, currentPrice),
            indicators,
            candles.TakeLast(SnapshotCandles).Select(c => CompactCandle(c, currentPrice)).ToList(),
            swings.TakeLast(SnapshotSwings).Select(s => new SwingSnapshot(s.Time, Round(s.Price, currentPrice), s.IsHigh ? "high" : "low", s.Label)).ToList(),
            SwingDetector.FindStructureEvents(candles, context.Pivots)
                .TakeLast(SnapshotEvents)
                .Select(e => e with { Price = Round(e.Price, currentPrice) })
                .ToList(),
            SupportResistanceDetector.Detect(context.Pivots, currentPrice, atr)
                .Select(l => l with { Price = Round(l.Price, currentPrice) })
                .ToList(),
            RoundFibonacci(FibonacciCalculator.Calculate(context.Pivots), currentPrice),
            RoundSmc(SmcDetector.Detect(candles, currentPrice), currentPrice, fromTime));
    }

    private static SmcSnapshot? RoundSmc(SmcSnapshot? smc, decimal reference, long fromTime)
    {
        if (smc is null)
        {
            return null;
        }

        List<StructureEvent> Events(IReadOnlyList<StructureEvent> events) => events
            .Where(e => e.BrokenSwingTime >= fromTime)
            .Select(e => e with { Price = Round(e.Price, reference) })
            .ToList();

        List<SmcZone> Zones(IReadOnlyList<SmcZone> zones) => zones
            .Where(z => z.Time >= fromTime)
            .Select(z => z with { Top = Round(z.Top, reference), Bottom = Round(z.Bottom, reference) })
            .ToList();

        return smc with
        {
            SwingEvents = Events(smc.SwingEvents),
            InternalEvents = Events(smc.InternalEvents),
            SwingOrderBlocks = Zones(smc.SwingOrderBlocks),
            InternalOrderBlocks = Zones(smc.InternalOrderBlocks),
            FairValueGaps = Zones(smc.FairValueGaps),
            EqualLevels = smc.EqualLevels
                .Where(l => l.FromTime >= fromTime)
                .Select(l => l with { Price = Round(l.Price, reference) })
                .ToList(),
            Range = smc.Range is null
                ? null
                : smc.Range with
                {
                    Top = Round(smc.Range.Top, reference),
                    Bottom = Round(smc.Range.Bottom, reference),
                    Equilibrium = Round(smc.Range.Equilibrium, reference)
                }
        };
    }

    private static double[] CompactCandle(Candle c, decimal reference) =>
    [
        c.OpenTimeSeconds,
        (double)Round(c.Open, reference),
        (double)Round(c.High, reference),
        (double)Round(c.Low, reference),
        (double)Round(c.Close, reference),
        Math.Round((double)c.Volume, 2)
    ];

    private static FibonacciSet? RoundFibonacci(FibonacciSet? set, decimal reference) => set is null
        ? null
        : set with
        {
            FromPrice = Round(set.FromPrice, reference),
            ToPrice = Round(set.ToPrice, reference),
            Retracements = set.Retracements.Select(l => l with { Price = Round(l.Price, reference) }).ToList(),
            Extensions = set.Extensions.Select(l => l with { Price = Round(l.Price, reference) }).ToList()
        };

    private static double Last(double[] series) => series.Reverse().FirstOrDefault(v => !double.IsNaN(v));

    private static double Safe(double value) => double.IsNaN(value) ? 0 : value;

    private static decimal Round(decimal value, decimal reference) => Math.Round(value, reference >= 10 ? 2 : 6);

    private static double Round(double value, decimal reference) => Math.Round(Safe(value), reference >= 10 ? 2 : 6);
}
