namespace TradingChartAnalyzer.Features.Analysis.Models;

public sealed class AnalysisResult
{
    public MarketAnalysis? Analysis { get; set; }
    public List<TradeSetup> Setups { get; set; } = [];
    public List<Drawing> Drawings { get; set; } = [];
    public List<string> Warnings { get; set; } = [];
}

public sealed class MarketAnalysis
{
    public TrendInfo Trend { get; set; } = new();
    public string MarketStructure { get; set; } = string.Empty;
    public List<KeyLevel> KeyLevels { get; set; } = [];
    public string Summary { get; set; } = string.Empty;
    public string Bias { get; set; } = "neutral";
    public double Confidence { get; set; }
}

public sealed class TrendInfo
{
    public string Htf { get; set; } = "ranging";
    public string Ltf { get; set; } = "ranging";
}

public sealed class KeyLevel
{
    public decimal Price { get; set; }
    public string Type { get; set; } = string.Empty;
    public double Strength { get; set; }
}

public sealed class TradeSetup
{
    public string Id { get; set; } = string.Empty;
    public string Direction { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Entry { get; set; }
    public decimal StopLoss { get; set; }
    public List<decimal> TakeProfits { get; set; } = [];
    public decimal RiskReward { get; set; }
    public List<string> Confluences { get; set; } = [];
    public string Invalidation { get; set; } = string.Empty;
}
