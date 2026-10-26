namespace TradingChartAnalyzer.Features.MarketData;

public sealed record Candle(
    long OpenTime,
    decimal Open,
    decimal High,
    decimal Low,
    decimal Close,
    decimal Volume,
    long CloseTime)
{
    public long OpenTimeSeconds => OpenTime / 1000;
}
