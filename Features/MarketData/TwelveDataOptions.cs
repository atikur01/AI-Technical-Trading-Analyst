namespace TradingChartAnalyzer.Features.MarketData;

public sealed class TwelveDataOptions
{
    public const string SectionName = "TwelveData";

    public string RestBaseUrl { get; set; } = "https://api.twelvedata.com";
    public string ApiKey { get; set; } = string.Empty;
    public int CacheSeconds { get; set; } = 15;
    public int PollSeconds { get; set; } = 20;
    public List<string> ForexPairs { get; set; } = [];
    public List<string> Stocks { get; set; } = [];
}
