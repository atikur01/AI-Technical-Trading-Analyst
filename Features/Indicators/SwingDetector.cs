using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Indicators;

public sealed record Swing(int Index, int ConfirmIndex, long Time, decimal Price, bool IsHigh, string? Label = null);

public sealed record StructureEvent(string Type, string Direction, long Time, decimal Price, long BrokenSwingTime, int Index);

public static class SwingDetector
{
    public const int DefaultLookback = 5;

    public static IReadOnlyList<Swing> FindPivots(IReadOnlyList<Candle> candles, int lookback = DefaultLookback)
    {
        var pivots = new List<Swing>();

        for (var i = lookback; i < candles.Count - lookback; i++)
        {
            if (IsPivot(candles, i, lookback, high: true))
            {
                pivots.Add(new Swing(i, i + lookback, candles[i].OpenTimeSeconds, candles[i].High, true));
            }
            else if (IsPivot(candles, i, lookback, high: false))
            {
                pivots.Add(new Swing(i, i + lookback, candles[i].OpenTimeSeconds, candles[i].Low, false));
            }
        }

        return pivots;
    }

    public static IReadOnlyList<Swing> LabelStructure(IReadOnlyList<Swing> pivots)
    {
        var labelled = new List<Swing>(pivots.Count);
        Swing? previousHigh = null;
        Swing? previousLow = null;

        foreach (var pivot in pivots)
        {
            string? label = null;

            if (pivot.IsHigh)
            {
                if (previousHigh is not null)
                {
                    label = pivot.Price > previousHigh.Price ? "HH" : "LH";
                }

                previousHigh = pivot;
            }
            else
            {
                if (previousLow is not null)
                {
                    label = pivot.Price > previousLow.Price ? "HL" : "LL";
                }

                previousLow = pivot;
            }

            labelled.Add(pivot with { Label = label });
        }

        return labelled;
    }

    public static IReadOnlyList<StructureEvent> FindStructureEvents(IReadOnlyList<Candle> candles, IReadOnlyList<Swing> pivots)
    {
        var events = new List<StructureEvent>();
        Swing? lastHigh = null;
        Swing? lastLow = null;
        var trend = 0;
        var next = 0;

        for (var i = 0; i < candles.Count; i++)
        {
            while (next < pivots.Count && pivots[next].ConfirmIndex <= i)
            {
                if (pivots[next].IsHigh)
                {
                    lastHigh = pivots[next];
                }
                else
                {
                    lastLow = pivots[next];
                }

                next++;
            }

            var close = candles[i].Close;

            if (lastHigh is not null && close > lastHigh.Price)
            {
                events.Add(new StructureEvent(trend == -1 ? "CHoCH" : "BOS", "bullish", candles[i].OpenTimeSeconds, lastHigh.Price, lastHigh.Time, i));
                trend = 1;
                lastHigh = null;
            }
            else if (lastLow is not null && close < lastLow.Price)
            {
                events.Add(new StructureEvent(trend == 1 ? "CHoCH" : "BOS", "bearish", candles[i].OpenTimeSeconds, lastLow.Price, lastLow.Time, i));
                trend = -1;
                lastLow = null;
            }
        }

        return events;
    }

    private static bool IsPivot(IReadOnlyList<Candle> candles, int index, int lookback, bool high)
    {
        var value = high ? candles[index].High : candles[index].Low;

        for (var offset = 1; offset <= lookback; offset++)
        {
            var left = high ? candles[index - offset].High : candles[index - offset].Low;
            var right = high ? candles[index + offset].High : candles[index + offset].Low;

            if (high ? left >= value || right > value : left <= value || right < value)
            {
                return false;
            }
        }

        return true;
    }
}
