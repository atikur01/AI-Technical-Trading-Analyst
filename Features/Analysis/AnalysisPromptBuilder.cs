using System.Text.Json;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Shared.Json;

namespace TradingChartAnalyzer.Features.Analysis;

public static class AnalysisPromptBuilder
{
    public const string SystemPrompt =
        "You are a professional crypto trader with 10+ years of experience in price action, market structure, Smart Money Concepts, Fibonacci and indicator confluence. " +
        "You receive a pre-computed market snapshot for BTCUSDT across multiple timeframes. " +
        "Never invent numbers: only use prices and timestamps present in the snapshot. " +
        "Analyze top-down (HTF to LTF), identify trend, structure, key levels, liquidity and confluence. " +
        "Propose at most 3 high-quality setups with minimum 1:2 risk-reward; if no valid setup exists return an empty setups array and explain why. " +
        "Produce drawings that a professional would put on the chart to justify the analysis. " +
        "Respond ONLY with JSON matching the given schema.";

    private const string Schema = """
        {
          "analysis": {
            "trend": { "htf": "bullish|bearish|ranging", "ltf": "bullish|bearish|ranging" },
            "marketStructure": "string",
            "keyLevels": [{ "price": 0, "type": "support|resistance", "strength": 1 }],
            "summary": "string",
            "bias": "long|short|neutral",
            "confidence": 0
          },
          "setups": [
            {
              "id": "setup-1",
              "direction": "long|short",
              "type": "breakout|pullback|reversal|range",
              "entry": 0, "stopLoss": 0,
              "takeProfits": [0, 0],
              "riskReward": 0,
              "confluences": ["string"],
              "invalidation": "string",
              "rules": { "entryCondition": "string", "indicator": "ema|rsi|fib|structure", "params": {} }
            }
          ],
          "drawings": [
            { "type": "trendline", "setupId": "optional", "points": [{ "time": 0, "price": 0 }, { "time": 0, "price": 0 }], "color": "#hex", "label": "string", "extend": "right|none" },
            { "type": "horizontal", "setupId": "optional", "price": 0, "color": "#hex", "label": "string", "style": "solid|dashed" },
            { "type": "fibonacci", "setupId": "optional", "from": { "time": 0, "price": 0 }, "to": { "time": 0, "price": 0 }, "levels": [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] },
            { "type": "zone", "setupId": "optional", "from": { "time": 0, "price": 0 }, "to": { "time": 0, "price": 0 }, "kind": "supply|demand|fvg|orderblock", "label": "string" },
            { "type": "position", "setupId": "setup-1", "time": 0, "entry": 0, "stopLoss": 0, "takeProfit": 0 },
            { "type": "marker", "setupId": "optional", "time": 0, "position": "above|below", "shape": "arrowUp|arrowDown|circle", "text": "BOS" }
          ]
        }
        """;

    private const string Rules =
        "Rules: all times are unix seconds taken from the snapshot candles or swings (never future times except position boxes at the latest candle). " +
        "Every price must lie inside snapshot.validRange. For long setups stopLoss < entry < every takeProfit; for short setups the reverse. " +
        "Each setup must have one position drawing. Respond with a single JSON object and nothing else.";

    public static string BuildUserPrompt(MarketSnapshot snapshot) =>
        $"JSON schema:\n{Schema}\n\n{Rules}\n\nMarket snapshot:\n{JsonSerializer.Serialize(snapshot, AppJson.Options)}";

    public static string BuildRepairPrompt(string userPrompt) =>
        $"{userPrompt}\n\nYour previous reply was not valid JSON for the schema. Reply again with ONLY one valid JSON object.";
}
