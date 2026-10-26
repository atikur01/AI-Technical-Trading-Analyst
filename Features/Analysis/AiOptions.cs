namespace TradingChartAnalyzer.Features.Analysis;

public sealed class AiOptions
{
    public const string SectionName = "Ai";

    public string BaseUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public double Temperature { get; set; } = 0.2;
    public int MaxTokens { get; set; } = 16000;
    public int TimeoutSeconds { get; set; } = 180;
    public int CacheMinutes { get; set; } = 5;
}
