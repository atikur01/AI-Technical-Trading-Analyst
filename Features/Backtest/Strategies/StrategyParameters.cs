using System.Text.Json;

namespace TradingChartAnalyzer.Features.Backtest.Strategies;

public sealed class StrategyParameters(IReadOnlyDictionary<string, JsonElement>? values)
{
    public double GetDouble(string name, double fallback)
    {
        if (values is null || !values.TryGetValue(name, out var element))
        {
            return fallback;
        }

        return element.ValueKind switch
        {
            JsonValueKind.Number => element.GetDouble(),
            JsonValueKind.String when double.TryParse(element.GetString(), System.Globalization.CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ => fallback
        };
    }

    public int GetInt(string name, int fallback) => (int)Math.Round(GetDouble(name, fallback));

    public decimal GetDecimal(string name, decimal fallback) => (decimal)GetDouble(name, (double)fallback);
}
