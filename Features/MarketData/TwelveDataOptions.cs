namespace TradingChartAnalyzer.Features.MarketData;

public sealed class TwelveDataOptions
{
    public const string SectionName = "TwelveData";

    public string RestBaseUrl { get; set; } = "https://api.twelvedata.com";
    public string ApiKey { get; set; } = string.Empty;
    public int CacheSeconds { get; set; } = 30;
    public int PollSeconds { get; set; } = 60;
    public int RequestsPerMinute { get; set; } = 8;
    public int QueueLimit { get; set; } = 16;
    public int MaxQueueWaitSeconds { get; set; } = 20;
    public List<string> ForexPairs { get; set; } = [];
    public List<string> Stocks { get; set; } = [];
}
