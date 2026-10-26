namespace TradingChartAnalyzer.Features.Backtest.Models;

public enum TradeDirection
{
    Long,
    Short
}

public sealed record BacktestTrade(
    int Id,
    string Direction,
    long EntryTime,
    decimal EntryPrice,
    long ExitTime,
    decimal ExitPrice,
    decimal StopLoss,
    decimal TakeProfit,
    decimal Quantity,
    decimal Fees,
    decimal Pnl,
    decimal RMultiple,
    string ExitReason);

public sealed record EquityPoint(long Time, decimal Equity);

public sealed record BacktestMetrics(
    int TotalTrades,
    int Wins,
    int Losses,
    double WinRate,
    double? ProfitFactor,
    decimal NetPnl,
    double NetPnlPercent,
    double MaxDrawdownPercent,
    decimal Expectancy,
    double AverageRr,
    double SharpeRatio,
    decimal FinalBalance);

public sealed record BacktestResult(
    BacktestMetrics Metrics,
    IReadOnlyList<BacktestTrade> Trades,
    IReadOnlyList<EquityPoint> EquityCurve,
    int CandleCount,
    IReadOnlyList<string> Warnings);
