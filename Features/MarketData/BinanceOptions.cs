namespace TradingChartAnalyzer.Features.MarketData;

public sealed class BinanceOptions
{
    public const string SectionName = "Binance";

    public string RestBaseUrl { get; set; } = "https://api.binance.com";
    public string WsBaseUrl { get; set; } = "wss://stream.binance.com:9443/ws";
    public string DefaultSymbol { get; set; } = "BTCUSDT";
    public int CacheSeconds { get; set; } = 10;
    public int TimeoutSeconds { get; set; } = 15;
    public int MaxRangeCandles { get; set; } = 50_000;
}
