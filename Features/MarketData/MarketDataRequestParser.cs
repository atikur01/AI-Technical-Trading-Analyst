using System.Text.RegularExpressions;

namespace TradingChartAnalyzer.Features.MarketData;

public static partial class MarketDataRequestParser
{
    [GeneratedRegex("^[A-Z0-9.]{1,20}(/[A-Z0-9]{3,10})?$")]
    private static partial Regex SymbolPattern();

    public static bool TryNormalizeSymbol(string? symbol, out string normalized)
    {
        normalized = (symbol ?? string.Empty).Trim().ToUpperInvariant();
        return SymbolPattern().IsMatch(normalized);
    }
}
