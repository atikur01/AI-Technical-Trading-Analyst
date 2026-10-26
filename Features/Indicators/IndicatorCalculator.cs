using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Indicators;

public static class IndicatorCalculator
{
    public static double[] Closes(IReadOnlyList<Candle> candles) => candles.Select(c => (double)c.Close).ToArray();

    public static double[] Sma(IReadOnlyList<double> values, int period)
    {
        var result = NewSeries(values.Count);
        double sum = 0;
        var valid = 0;

        for (var i = 0; i < values.Count; i++)
        {
            if (double.IsNaN(values[i]))
            {
                sum = 0;
                valid = 0;
                continue;
            }

            sum += values[i];
            valid++;

            if (valid > period)
            {
                sum -= values[i - period];
                valid--;
            }

            if (valid == period)
            {
                result[i] = sum / period;
            }
        }

        return result;
    }

    public static double[] Ema(IReadOnlyList<double> values, int period)
    {
        var result = NewSeries(values.Count);
        var multiplier = 2.0 / (period + 1);
        var start = 0;

        while (start < values.Count && double.IsNaN(values[start]))
        {
            start++;
        }

        var seedIndex = start + period - 1;
        if (seedIndex >= values.Count)
        {
            return result;
        }

        double seed = 0;
        for (var i = start; i <= seedIndex; i++)
        {
            seed += values[i];
        }

        result[seedIndex] = seed / period;

        for (var i = seedIndex + 1; i < values.Count; i++)
        {
            result[i] = (values[i] - result[i - 1]) * multiplier + result[i - 1];
        }

        return result;
    }

    public static double[] Rsi(IReadOnlyList<double> closes, int period = 14)
    {
        var result = NewSeries(closes.Count);
        if (closes.Count <= period)
        {
            return result;
        }

        double gain = 0;
        double loss = 0;

        for (var i = 1; i <= period; i++)
        {
            var change = closes[i] - closes[i - 1];
            gain += Math.Max(change, 0);
            loss += Math.Max(-change, 0);
        }

        gain /= period;
        loss /= period;
        result[period] = RsiValue(gain, loss);

        for (var i = period + 1; i < closes.Count; i++)
        {
            var change = closes[i] - closes[i - 1];
            gain = (gain * (period - 1) + Math.Max(change, 0)) / period;
            loss = (loss * (period - 1) + Math.Max(-change, 0)) / period;
            result[i] = RsiValue(gain, loss);
        }

        return result;
    }

    public static double[] Atr(IReadOnlyList<Candle> candles, int period = 14)
    {
        var result = NewSeries(candles.Count);
        if (candles.Count <= period)
        {
            return result;
        }

        double sum = 0;
        for (var i = 1; i <= period; i++)
        {
            sum += TrueRange(candles, i);
        }

        result[period] = sum / period;

        for (var i = period + 1; i < candles.Count; i++)
        {
            result[i] = (result[i - 1] * (period - 1) + TrueRange(candles, i)) / period;
        }

        return result;
    }

    public static MacdSeries Macd(IReadOnlyList<double> closes, int fast = 12, int slow = 26, int signalPeriod = 9)
    {
        var fastEma = Ema(closes, fast);
        var slowEma = Ema(closes, slow);
        var line = NewSeries(closes.Count);

        for (var i = 0; i < closes.Count; i++)
        {
            if (!double.IsNaN(fastEma[i]) && !double.IsNaN(slowEma[i]))
            {
                line[i] = fastEma[i] - slowEma[i];
            }
        }

        var signal = Ema(line, signalPeriod);
        var histogram = NewSeries(closes.Count);

        for (var i = 0; i < closes.Count; i++)
        {
            if (!double.IsNaN(line[i]) && !double.IsNaN(signal[i]))
            {
                histogram[i] = line[i] - signal[i];
            }
        }

        return new MacdSeries(line, signal, histogram);
    }

    public static BollingerSeries Bollinger(IReadOnlyList<double> closes, int period = 20, double deviations = 2)
    {
        var middle = Sma(closes, period);
        var upper = NewSeries(closes.Count);
        var lower = NewSeries(closes.Count);

        for (var i = period - 1; i < closes.Count; i++)
        {
            if (double.IsNaN(middle[i]))
            {
                continue;
            }

            double variance = 0;
            for (var j = i - period + 1; j <= i; j++)
            {
                variance += Math.Pow(closes[j] - middle[i], 2);
            }

            var deviation = Math.Sqrt(variance / period) * deviations;
            upper[i] = middle[i] + deviation;
            lower[i] = middle[i] - deviation;
        }

        return new BollingerSeries(upper, middle, lower);
    }

    public static double[] Vwap(IReadOnlyList<Candle> candles)
    {
        var result = NewSeries(candles.Count);
        double cumulativePriceVolume = 0;
        double cumulativeVolume = 0;
        long currentDay = -1;

        for (var i = 0; i < candles.Count; i++)
        {
            var day = candles[i].OpenTime / 86_400_000L;
            if (day != currentDay)
            {
                currentDay = day;
                cumulativePriceVolume = 0;
                cumulativeVolume = 0;
            }

            var typical = (double)(candles[i].High + candles[i].Low + candles[i].Close) / 3;
            var volume = (double)candles[i].Volume;
            cumulativePriceVolume += typical * volume;
            cumulativeVolume += volume;
            result[i] = cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : typical;
        }

        return result;
    }

    private static double[] NewSeries(int length)
    {
        var series = new double[length];
        Array.Fill(series, double.NaN);
        return series;
    }

    private static double RsiValue(double gain, double loss) =>
        loss == 0 ? 100 : 100 - 100 / (1 + gain / loss);

    private static double TrueRange(IReadOnlyList<Candle> candles, int index)
    {
        var high = (double)candles[index].High;
        var low = (double)candles[index].Low;
        var previousClose = (double)candles[index - 1].Close;
        return Math.Max(high - low, Math.Max(Math.Abs(high - previousClose), Math.Abs(low - previousClose)));
    }
}

public sealed record MacdSeries(double[] Line, double[] Signal, double[] Histogram);

public sealed record BollingerSeries(double[] Upper, double[] Middle, double[] Lower);
