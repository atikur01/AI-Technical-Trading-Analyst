namespace TradingChartAnalyzer.Features.MarketData;

public interface IBinanceMarketDataClient
{
    Task<IReadOnlyList<Candle>> GetKlinesAsync(string symbol, Timeframe timeframe, int limit, CancellationToken cancellationToken);

    Task<IReadOnlyList<string>> GetSymbolsAsync(CancellationToken cancellationToken);

    Task<bool> PingAsync(CancellationToken cancellationToken);
}
