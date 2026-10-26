namespace TradingChartAnalyzer.Features.Analysis.Models;

public sealed class AnalysisRequest
{
    public string? Symbol { get; set; }
    public string Timeframe { get; set; } = "1h";
}
