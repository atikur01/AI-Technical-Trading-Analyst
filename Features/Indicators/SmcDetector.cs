using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Indicators;

public sealed record SmcZone(long Time, decimal Top, decimal Bottom, string Bias);

public sealed record SmcEqualLevel(long FromTime, long ToTime, decimal Price, string Type);

public sealed record SmcRange(decimal Top, decimal Bottom, decimal Equilibrium, double PositionPercent, string Zone, bool StrongHigh, bool StrongLow);

public sealed record SmcSnapshot(
    string SwingTrend,
    string InternalTrend,
    IReadOnlyList<StructureEvent> SwingEvents,
    IReadOnlyList<StructureEvent> InternalEvents,
    IReadOnlyList<SmcZone> SwingOrderBlocks,
    IReadOnlyList<SmcZone> InternalOrderBlocks,
    IReadOnlyList<SmcZone> FairValueGaps,
    IReadOnlyList<SmcEqualLevel> EqualLevels,
    SmcRange? Range);

public static class SmcDetector
{
    private const int SwingSize = 50;
    private const int InternalSize = 5;
    private const int EqualSize = 3;
    private const int AtrPeriod = 200;
    private const double EqualAtrFactor = 0.1;
    private const double HighVolatilityFactor = 2;
    private const double EquilibriumBandPercent = 2.5;
    private const int MaxEvents = 6;
    private const int MaxOrderBlocks = 3;
    private const int MaxFairValueGaps = 4;
    private const int MaxEqualLevels = 4;

    public static SmcSnapshot? Detect(IReadOnlyList<Candle> candles, decimal currentPrice)
    {
        if (candles.Count <= SwingSize + 1)
        {
            return null;
        }

        var atr = IndicatorCalculator.Atr(candles, AtrPeriod);
        var (parsedHighs, parsedLows) = ParseBars(candles, atr);
        var swing = Structure(candles, SwingSize, parsedHighs, parsedLows, null);
        var internalStructure = Structure(candles, InternalSize, parsedHighs, parsedLows, swing);

        return new SmcSnapshot(
            TrendName(swing.Trend),
            TrendName(internalStructure.Trend),
            swing.Events.TakeLast(MaxEvents).ToList(),
            internalStructure.Events.TakeLast(MaxEvents).ToList(),
            ActiveBlocks(candles, swing),
            ActiveBlocks(candles, internalStructure),
            FairValueGaps(candles),
            EqualLevels(candles, atr),
            BuildRange(candles, swing, currentPrice));
    }

    private static (decimal[] Highs, decimal[] Lows) ParseBars(IReadOnlyList<Candle> candles, double[] atr)
    {
        var highs = new decimal[candles.Count];
        var lows = new decimal[candles.Count];

        for (var i = 0; i < candles.Count; i++)
        {
            var highVolatility = (double)(candles[i].High - candles[i].Low) >= HighVolatilityFactor * atr[i];
            highs[i] = highVolatility ? candles[i].Low : candles[i].High;
            lows[i] = highVolatility ? candles[i].High : candles[i].Low;
        }

        return (highs, lows);
    }

    private static List<Pivot> Pivots(IReadOnlyList<Candle> candles, int size)
    {
        var found = new List<Pivot>();
        var leg = 0;

        for (var i = size; i < candles.Count; i++)
        {
            var p = i - size;
            var highest = decimal.MinValue;
            var lowest = decimal.MaxValue;

            for (var j = p + 1; j <= i; j++)
            {
                highest = Math.Max(highest, candles[j].High);
                lowest = Math.Min(lowest, candles[j].Low);
            }

            var next = candles[p].High > highest ? 0 : candles[p].Low < lowest ? 1 : leg;
            if (next != leg)
            {
                var isHigh = next == 0;
                found.Add(new Pivot(p, i, isHigh, isHigh ? candles[p].High : candles[p].Low));
            }

            leg = next;
        }

        return found;
    }

    private static StructureResult Structure(IReadOnlyList<Candle> candles, int size, decimal[] parsedHighs, decimal[] parsedLows, StructureResult? swing)
    {
        var result = new StructureResult(candles.Count)
        {
            Pivots = Pivots(candles, size)
        };
        var pivotsByBar = result.Pivots.ToDictionary(p => p.ConfirmedAt);
        PivotState? high = null;
        PivotState? low = null;

        void Cross(int i, PivotState pivot, bool bull)
        {
            pivot.Crossed = true;
            var tag = result.Trend == (bull ? -1 : 1) ? "CHoCH" : "BOS";
            result.Events.Add(new StructureEvent(tag, bull ? "bullish" : "bearish", candles[i].OpenTimeSeconds, pivot.Level, candles[pivot.Index].OpenTimeSeconds, i));
            result.Trend = bull ? 1 : -1;

            var anchor = bull ? IndexOfExtreme(parsedLows, pivot.Index, i, min: true) : IndexOfExtreme(parsedHighs, pivot.Index, i, min: false);
            result.OrderBlocks.Add(new OrderBlock(anchor, parsedHighs[anchor], parsedLows[anchor], bull, i));
        }

        for (var i = size; i < candles.Count; i++)
        {
            if (pivotsByBar.TryGetValue(i, out var pivot))
            {
                var state = new PivotState(pivot.Index, pivot.Level);
                if (pivot.IsHigh)
                {
                    high = state;
                }
                else
                {
                    low = state;
                }
            }

            result.HighLevels[i] = high?.Level;
            result.LowLevels[i] = low?.Level;

            var close = candles[i].Close;

            if (high is { Crossed: false } && close > high.Level && high.Level != swing?.HighLevels[i])
            {
                Cross(i, high, bull: true);
            }

            if (low is { Crossed: false } && close < low.Level && low.Level != swing?.LowLevels[i])
            {
                Cross(i, low, bull: false);
            }
        }

        return result;
    }

    private static int IndexOfExtreme(decimal[] values, int from, int to, bool min)
    {
        var best = from;

        for (var j = from + 1; j < to; j++)
        {
            if (min ? values[j] < values[best] : values[j] > values[best])
            {
                best = j;
            }
        }

        return best;
    }

    private static List<SmcZone> ActiveBlocks(IReadOnlyList<Candle> candles, StructureResult structure) =>
        structure.OrderBlocks
            .Where(block => !IsMitigated(candles, block.CreatedAt, block.Bull, block.Top, block.Bottom))
            .TakeLast(MaxOrderBlocks)
            .Select(block => new SmcZone(candles[block.Index].OpenTimeSeconds, block.Top, block.Bottom, block.Bull ? "bullish" : "bearish"))
            .ToList();

    private static bool IsMitigated(IReadOnlyList<Candle> candles, int from, bool bull, decimal top, decimal bottom)
    {
        for (var j = from; j < candles.Count; j++)
        {
            if (bull ? candles[j].Low < bottom : candles[j].High > top)
            {
                return true;
            }
        }

        return false;
    }

    private static List<SmcZone> FairValueGaps(IReadOnlyList<Candle> candles)
    {
        var gaps = new List<SmcZone>();
        decimal deltaSum = 0;

        for (var i = 2; i < candles.Count; i++)
        {
            var middle = candles[i - 1];
            var delta = Math.Abs(middle.Close - middle.Open) / middle.Open * 100;
            deltaSum += delta;

            if (delta <= deltaSum / (i - 1) * 2)
            {
                continue;
            }

            var first = candles[i - 2];
            var current = candles[i];

            if (current.Low > first.High && middle.Close > first.High && !IsMitigated(candles, i + 1, true, current.Low, first.High))
            {
                gaps.Add(new SmcZone(middle.OpenTimeSeconds, current.Low, first.High, "bullish"));
            }
            else if (current.High < first.Low && middle.Close < first.Low && !IsMitigated(candles, i + 1, false, first.Low, current.High))
            {
                gaps.Add(new SmcZone(middle.OpenTimeSeconds, first.Low, current.High, "bearish"));
            }
        }

        return gaps.TakeLast(MaxFairValueGaps).ToList();
    }

    private static List<SmcEqualLevel> EqualLevels(IReadOnlyList<Candle> candles, double[] atr)
    {
        var equals = new List<SmcEqualLevel>();
        Pivot? lastHigh = null;
        Pivot? lastLow = null;

        foreach (var pivot in Pivots(candles, EqualSize))
        {
            var previous = pivot.IsHigh ? lastHigh : lastLow;

            if (previous is not null && (double)Math.Abs(previous.Level - pivot.Level) < EqualAtrFactor * atr[pivot.ConfirmedAt])
            {
                equals.Add(new SmcEqualLevel(
                    candles[previous.Index].OpenTimeSeconds,
                    candles[pivot.Index].OpenTimeSeconds,
                    (previous.Level + pivot.Level) / 2,
                    pivot.IsHigh ? "EQH" : "EQL"));
            }

            if (pivot.IsHigh)
            {
                lastHigh = pivot;
            }
            else
            {
                lastLow = pivot;
            }
        }

        return equals.TakeLast(MaxEqualLevels).ToList();
    }

    private static SmcRange? BuildRange(IReadOnlyList<Candle> candles, StructureResult swing, decimal currentPrice)
    {
        var pivotsByBar = swing.Pivots.ToDictionary(p => p.ConfirmedAt);
        decimal? top = null;
        decimal? bottom = null;

        for (var i = 0; i < candles.Count; i++)
        {
            top = top is null ? null : Math.Max(top.Value, candles[i].High);
            bottom = bottom is null ? null : Math.Min(bottom.Value, candles[i].Low);

            if (pivotsByBar.TryGetValue(i, out var pivot))
            {
                if (pivot.IsHigh)
                {
                    top = pivot.Level;
                }
                else
                {
                    bottom = pivot.Level;
                }
            }
        }

        if (top is null || bottom is null || top <= bottom)
        {
            return null;
        }

        var position = (double)((currentPrice - bottom.Value) / (top.Value - bottom.Value) * 100);
        var zone = Math.Abs(position - 50) <= EquilibriumBandPercent ? "equilibrium" : position > 50 ? "premium" : "discount";

        return new SmcRange(top.Value, bottom.Value, (top.Value + bottom.Value) / 2, Math.Round(position, 1), zone, swing.Trend == -1, swing.Trend == 1);
    }

    private static string TrendName(int trend) => trend switch
    {
        1 => "bullish",
        -1 => "bearish",
        _ => "none"
    };

    private sealed record Pivot(int Index, int ConfirmedAt, bool IsHigh, decimal Level);

    private sealed record OrderBlock(int Index, decimal Top, decimal Bottom, bool Bull, int CreatedAt);

    private sealed class PivotState(int index, decimal level)
    {
        public int Index { get; } = index;
        public decimal Level { get; } = level;
        public bool Crossed { get; set; }
    }

    private sealed class StructureResult(int length)
    {
        public List<Pivot> Pivots { get; set; } = [];
        public List<StructureEvent> Events { get; } = [];
        public List<OrderBlock> OrderBlocks { get; } = [];
        public decimal?[] HighLevels { get; } = new decimal?[length];
        public decimal?[] LowLevels { get; } = new decimal?[length];
        public int Trend { get; set; }
    }
}
