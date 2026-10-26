namespace TradingChartAnalyzer.Features.MarketData;

public interface IBinanceMarketDataClient
{
    Task<IReadOnlyList<Candle>> GetKlinesAsync(string symbol, Timeframe timeframe, int limit, CancellationToken cancellationToken);

    Task<IReadOnlyList<Candle>> GetKlinesRangeAsync(string symbol, Timeframe timeframe, DateTimeOffset from, DateTimeOffset to, CancellationToken cancellationToken);

    Task<bool> PingAsync(CancellationToken cancellationToken);
}
