namespace TradingChartAnalyzer.Features.MarketData;

public interface ITwelveDataMarketDataClient
{
    Task<IReadOnlyList<Candle>> GetKlinesAsync(string symbol, Timeframe timeframe, int limit, CancellationToken cancellationToken);
}
