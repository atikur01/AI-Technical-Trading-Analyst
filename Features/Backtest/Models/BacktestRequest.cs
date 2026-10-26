using System.Text.Json;
using TradingChartAnalyzer.Features.Analysis.Models;

namespace TradingChartAnalyzer.Features.Backtest.Models;

public sealed class BacktestRequest
{
    public string? Symbol { get; set; }
    public string Strategy { get; set; } = string.Empty;
    public Dictionary<string, JsonElement> Params { get; set; } = [];
    public string Timeframe { get; set; } = "1h";
    public DateTimeOffset From { get; set; }
    public DateTimeOffset To { get; set; }
    public decimal InitialBalance { get; set; } = 10_000m;
    public decimal RiskPercent { get; set; } = 1m;
    public decimal FeePercent { get; set; } = 0.1m;
    public decimal SlippagePercent { get; set; } = 0.05m;
    public TradeSetup? Setup { get; set; }
}
