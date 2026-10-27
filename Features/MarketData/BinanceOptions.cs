namespace TradingChartAnalyzer.Features.MarketData;

public sealed class BinanceOptions
{
    public const string SectionName = "Binance";

    public string RestBaseUrl { get; set; } = "https://data-api.binance.vision";
    public string WsBaseUrl { get; set; } = "wss://data-stream.binance.vision/ws";
    public string DefaultSymbol { get; set; } = "BTCUSDT";
    public int CacheSeconds { get; set; } = 10;
}
