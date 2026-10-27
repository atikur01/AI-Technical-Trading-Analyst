namespace TradingChartAnalyzer.Features.MarketData;

public interface IMarketDataService
{
    Task<IReadOnlyList<Candle>> GetKlinesAsync(string symbol, Timeframe timeframe, int limit, CancellationToken cancellationToken);

    Task<IReadOnlyList<MarketSymbol>> GetSymbolsAsync(CancellationToken cancellationToken);
}
