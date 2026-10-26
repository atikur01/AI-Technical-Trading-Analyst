using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Indicators;

public sealed class IndicatorContext
{
    private IndicatorContext(IReadOnlyList<Candle> candles)
    {
        Candles = candles;
        Closes = IndicatorCalculator.Closes(candles);
        Ema20 = IndicatorCalculator.Ema(Closes, 20);
        Ema50 = IndicatorCalculator.Ema(Closes, 50);
        Ema200 = IndicatorCalculator.Ema(Closes, 200);
        Rsi14 = IndicatorCalculator.Rsi(Closes);
        Atr14 = IndicatorCalculator.Atr(candles);
        Macd = IndicatorCalculator.Macd(Closes);
        Bollinger = IndicatorCalculator.Bollinger(Closes);
        Vwap = IndicatorCalculator.Vwap(candles);
        Pivots = SwingDetector.FindPivots(candles);
    }

    public IReadOnlyList<Candle> Candles { get; }
    public double[] Closes { get; }
    public double[] Ema20 { get; }
    public double[] Ema50 { get; }
    public double[] Ema200 { get; }
    public double[] Rsi14 { get; }
    public double[] Atr14 { get; }
    public MacdSeries Macd { get; }
    public BollingerSeries Bollinger { get; }
    public double[] Vwap { get; }
    public IReadOnlyList<Swing> Pivots { get; }

    public static IndicatorContext Create(IReadOnlyList<Candle> candles) => new(candles);
}
