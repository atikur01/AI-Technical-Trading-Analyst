namespace TradingChartAnalyzer.Features.Indicators;

public sealed record MarketSnapshot(
    string Symbol,
    string PrimaryTimeframe,
    decimal CurrentPrice,
    SnapshotRange ValidRange,
    IReadOnlyList<TimeframeSnapshot> Timeframes);

public sealed record SnapshotRange(decimal MinPrice, decimal MaxPrice, long FromTime, long ToTime);

public sealed record TimeframeSnapshot(
    string Timeframe,
    double Atr,
    IndicatorValues Indicators,
    IReadOnlyList<double[]> Candles,
    IReadOnlyList<SwingSnapshot> Swings,
    IReadOnlyList<StructureEvent> StructureEvents,
    IReadOnlyList<PriceLevel> Levels,
    FibonacciSet? Fibonacci,
    SmcSnapshot? Smc);

public sealed record IndicatorValues(
    double Ema20,
    double Ema50,
    double Ema200,
    double Rsi14,
    double MacdLine,
    double MacdSignal,
    double MacdHistogram,
    double BollingerUpper,
    double BollingerMiddle,
    double BollingerLower,
    double Vwap);

public sealed record SwingSnapshot(long Time, decimal Price, string Type, string? Label);
