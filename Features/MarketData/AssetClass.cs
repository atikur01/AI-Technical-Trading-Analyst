namespace TradingChartAnalyzer.Features.MarketData;

public enum AssetClass
{
    Crypto,
    Forex,
    Stock
}

public sealed record MarketSymbol(string Symbol, AssetClass AssetClass);

public static class AssetClassResolver
{
    private const string CryptoQuoteAsset = "USDT";

    public static AssetClass Resolve(string symbol)
    {
        if (symbol.Contains('/'))
        {
            return AssetClass.Forex;
        }

        return symbol.Length > CryptoQuoteAsset.Length && symbol.EndsWith(CryptoQuoteAsset, StringComparison.Ordinal)
            ? AssetClass.Crypto
            : AssetClass.Stock;
    }
}
