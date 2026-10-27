using System.Text.Json;
using TradingChartAnalyzer.Features.Indicators;
using TradingChartAnalyzer.Features.MarketData;
using TradingChartAnalyzer.Shared.Json;

namespace TradingChartAnalyzer.Features.Analysis;

public static class AnalysisPromptBuilder
{
    public const string SystemPrompt =
        "You are a professional trader with 10+ years of experience in price action, market structure, Smart Money Concepts, Fibonacci and indicator confluence. " +
        "You receive a pre-computed market snapshot for the symbol named in it (crypto, forex or stock) across multiple timeframes. " +
        "Never invent numbers: only use prices and timestamps present in the snapshot. " +
        "Analyze top-down (HTF to LTF), identify trend, structure, key levels, liquidity and confluence. " +
        "When the primary timeframe is 1w or 1M the macro rules in the user prompt replace the 4h trend and lower-timeframe restrictions below. Otherwise trade strictly in the direction of the 4h trend (price above the 4h EMA200 allows longs only, below allows shorts only) and never propose counter-trend or reversal trades. " +
        "On timeframes below 4h be strict and prefer returning no setups unless the 4h trend, 4h structure and the primary timeframe all agree. " +
        "Place stops 1.5 to 2 ATR of the primary timeframe from entry beyond structure, and take profit at 2 to 3 times the risk. " +
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
              "invalidation": "string"
            }
          ],
          "drawings": [
            { "type": "trendline", "setupId": "optional", "points": [{ "time": 0, "price": 0 }, { "time": 0, "price": 0 }], "color": "#hex", "label": "string", "extend": "right|none" },
            { "type": "horizontal", "setupId": "optional", "price": 0, "color": "#hex", "label": "string", "style": "solid|dashed" },
            { "type": "fibonacci", "setupId": "optional", "from": { "time": 0, "price": 0 }, "to": { "time": 0, "price": 0 }, "levels": [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] },
            { "type": "zone", "setupId": "optional", "from": { "time": 0, "price": 0 }, "to": { "time": 0, "price": 0 }, "kind": "supply|demand|fvg|orderblock", "label": "string" },
            { "type": "position", "setupId": "setup-1", "time": 0, "entry": 0, "stopLoss": 0, "takeProfit": 0 },
            { "type": "projection", "candles": [{ "open": 0, "high": 0, "low": 0, "close": 0 }], "color": "#2962ff", "label": "string" },
            { "type": "marker", "setupId": "optional", "time": 0, "position": "above|below", "shape": "arrowUp|arrowDown|circle", "text": "BOS" }
          ]
        }
        """;

    private const string Rules =
        "Rules: all times are unix seconds taken from the snapshot candles or swings (never future times except position boxes at the latest candle). " +
        "Every price must lie inside snapshot.validRange. For long setups stopLoss < entry < every takeProfit; for short setups the reverse. " +
        "Each setup must have one position drawing. " +
        "Each timeframe carries an smc object (Smart Money Concepts): swingTrend/internalTrend, swingEvents and internalEvents (BOS continues the trend, CHoCH is the first break against it), unmitigated order blocks and fair value gaps, equalLevels (EQH/EQL liquidity pools) and range. " +
        "range.zone tells whether price sits in premium (above 50% of the swing range), discount (below) or equilibrium: favor longs from discount and shorts from premium, and treat a long entered in premium or a short entered in discount as lower quality. " +
        "range.strongHigh or strongLow marks the swing extreme expected to hold; a target at the opposite weak extreme is more likely to be reached. " +
        "Draw unmitigated order blocks and fair value gaps that support a setup as zone drawings (kind orderblock or fvg) using the zone time as from.time, top as from.price and bottom as to.price, and use EQH/EQL as take-profit targets or stop-clustering liquidity. " +
        "A CHoCH against the higher-timeframe trend is a warning to stay out, not an entry signal. " +
        "The projection drawing must be consistent with the first setup: its first candle opens at snapshot.currentPrice, each next candle opens at the previous close, and when the setup entry is below the current price (long) or above it (short) the first candles must travel to the entry first (bearish candles for a long pullback, bullish for a short), touch the entry, and only then continue toward the take profit with candles in the setup direction. " +
        "Respond with a single JSON object and nothing else.";

    private const string MacroRules =
        "Macro rules (primary timeframe is weekly or monthly): analyze like a senior discretionary position trader reading the macro cycle. " +
        "Describe where price came from (impulse legs, cycle high, major low), where it is now and where it is most likely headed. " +
        "Draw at most 3 zones (kind demand or supply) at the base candles that launched strong impulse moves and are still unmitigated, with from.time the base candle open time, from.price the zone top and to.price the zone bottom; zones extend to the right automatically. " +
        "Draw the key prior cycle high or low as a dashed horizontal drawing and mark structure breaks (BOS, CHoCH) with markers on existing candles. " +
        "Include exactly one projection drawing: 6 to 12 forecast candles of the primary timeframe continuing after the last candle, in order, each with open, high, low and close; their size must resemble recent candles of the primary timeframe, they must follow the bias, respect the zones and key levels, and end near a logical target; label it as a scenario, not a certainty. " +
        "Propose 0 to 2 swing setups with entry at a zone retest and the stop beyond the zone; the trend filter does not apply, minimum 1:2 risk-reward still does. " +
        "The summary must tell the story: context, the zone that matters, the projected path, and what invalidates it.";

    private static string MacroSection(MarketSnapshot snapshot) =>
        TimeframeExtensions.TryParse(snapshot.PrimaryTimeframe, out var primary) && primary.IsMacro() ? $"\n\n{MacroRules}" : string.Empty;

    public static string BuildUserPrompt(MarketSnapshot snapshot) =>
        $"JSON schema:\n{Schema}\n\n{Rules}{MacroSection(snapshot)}\n\nMarket snapshot:\n{JsonSerializer.Serialize(snapshot, AppJson.Options)}";

    public static string BuildRepairPrompt(string userPrompt) =>
        $"{userPrompt}\n\nYour previous reply was not valid JSON for the schema. Reply again with ONLY one valid JSON object.";
}
