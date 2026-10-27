using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.MarketData;

public sealed class MarketDataService(
    IBinanceMarketDataClient binance,
    ITwelveDataMarketDataClient twelveData,
    IOptions<TwelveDataOptions> twelveDataOptions,
    ILogger<MarketDataService> logger) : IMarketDataService
{
    public Task<IReadOnlyList<Candle>> GetKlinesAsync(string symbol, Timeframe timeframe, int limit, CancellationToken cancellationToken) =>
        AssetClassResolver.Resolve(symbol) == AssetClass.Crypto
            ? binance.GetKlinesAsync(symbol, timeframe, limit, cancellationToken)
            : twelveData.GetKlinesAsync(symbol, timeframe, limit, cancellationToken);

    public async Task<IReadOnlyList<MarketSymbol>> GetSymbolsAsync(CancellationToken cancellationToken)
    {
        var crypto = await GetCryptoSymbolsAsync(cancellationToken);
        var configured = twelveDataOptions.Value;

        return crypto.Select(s => new MarketSymbol(s, AssetClass.Crypto))
            .Concat(configured.ForexPairs.Select(s => new MarketSymbol(s, AssetClass.Forex)))
            .Concat(configured.Stocks.Select(s => new MarketSymbol(s, AssetClass.Stock)))
            .ToList();
    }

    private async Task<IReadOnlyList<string>> GetCryptoSymbolsAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await binance.GetSymbolsAsync(cancellationToken);
        }
        catch (MarketDataUnavailableException exception)
        {
            logger.LogWarning(exception, "Crypto symbols are unavailable; listing forex and stocks only");
            return [];
        }
    }
}
