namespace TradingChartAnalyzer.Features.Analysis;

public sealed class AnalysisOptions
{
    public const string SectionName = "Analysis";

    public int PerMinuteLimitPerIp { get; set; } = 5;
    public int DailyLimitPerIp { get; set; } = 30;
    public string FallbackDirectory { get; set; } = "App_Data/analysis-fallback";
}
