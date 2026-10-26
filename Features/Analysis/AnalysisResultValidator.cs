using System.Text.RegularExpressions;
using TradingChartAnalyzer.Features.Analysis.Models;
using TradingChartAnalyzer.Features.Indicators;

namespace TradingChartAnalyzer.Features.Analysis;

public static partial class AnalysisResultValidator
{
    private const int MaxSetups = 3;
    private const int MaxLabelLength = 60;
    private const decimal MinRiskReward = 1m;
    private const decimal RangeMargin = 0.2m;

    private static readonly string[] Trends = ["bullish", "bearish", "ranging"];
    private static readonly string[] Biases = ["long", "short", "neutral"];
    private static readonly string[] SetupTypes = ["breakout", "pullback", "reversal", "range"];
    private static readonly string[] ZoneKinds = ["supply", "demand", "fvg", "orderblock"];
    private static readonly string[] MarkerShapes = ["arrowUp", "arrowDown", "circle"];
    private static readonly double[] DefaultFibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColor();

    public static AnalysisResult Validate(AnalysisResult raw, MarketSnapshot snapshot)
    {
        var range = snapshot.ValidRange;
        var minPrice = range.MinPrice * (1 - RangeMargin);
        var maxPrice = range.MaxPrice * (1 + RangeMargin);
        var result = new AnalysisResult { Warnings = raw.Warnings.ToList() };

        bool PriceOk(decimal price) => price >= minPrice && price <= maxPrice;
        bool TimeOk(long time) => time >= range.FromTime && time <= range.ToTime;
        bool PointOk(ChartPoint point) => PriceOk(point.Price) && TimeOk(point.Time);

        result.Analysis = NormalizeAnalysis(raw.Analysis, PriceOk, result.Warnings);
        result.Setups = ValidateSetups(raw.Setups, PriceOk, result.Warnings);

        var setupsById = result.Setups.ToDictionary(s => s.Id);
        var validated = new List<Drawing>();

        foreach (var drawing in raw.Drawings)
        {
            var normalized = NormalizeDrawing(drawing, setupsById, PriceOk, TimeOk, PointOk);
            if (normalized is null)
            {
                result.Warnings.Add($"Dropped invalid {drawing.GetType().Name.Replace("Drawing", string.Empty).ToLowerInvariant()} drawing.");
                continue;
            }

            validated.Add(normalized);
        }

        result.Drawings = validated;

        foreach (var setup in result.Setups.Where(s => validated.OfType<PositionDrawing>().All(p => p.SetupId != s.Id)))
        {
            result.Drawings.Add(new PositionDrawing
            {
                SetupId = setup.Id,
                Time = snapshot.ValidRange.ToTime,
                Entry = setup.Entry,
                StopLoss = setup.StopLoss,
                TakeProfit = setup.TakeProfits[0],
                Label = null
            });
        }

        return result;
    }

    private static MarketAnalysis NormalizeAnalysis(MarketAnalysis? analysis, Func<decimal, bool> priceOk, List<string> warnings)
    {
        analysis ??= new MarketAnalysis();
        analysis.Trend ??= new TrendInfo();
        analysis.Trend.Htf = Pick(analysis.Trend.Htf, Trends, "ranging");
        analysis.Trend.Ltf = Pick(analysis.Trend.Ltf, Trends, "ranging");
        analysis.Bias = Pick(analysis.Bias, Biases, "neutral");
        analysis.Confidence = Math.Clamp(analysis.Confidence, 0, 100);
        analysis.Summary = analysis.Summary?.Trim() ?? string.Empty;
        analysis.MarketStructure = analysis.MarketStructure?.Trim() ?? string.Empty;

        var levels = (analysis.KeyLevels ?? [])
            .Select(l => { l.Type = l.Type?.Trim().ToLowerInvariant() ?? string.Empty; l.Strength = Math.Clamp(l.Strength, 1, 5); return l; })
            .Where(l => priceOk(l.Price) && (l.Type == "support" || l.Type == "resistance"))
            .ToList();

        if (levels.Count != (analysis.KeyLevels?.Count ?? 0))
        {
            warnings.Add("Dropped invalid key levels.");
        }

        analysis.KeyLevels = levels;
        return analysis;
    }

    private static List<TradeSetup> ValidateSetups(List<TradeSetup> setups, Func<decimal, bool> priceOk, List<string> warnings)
    {
        var valid = new List<TradeSetup>();

        foreach (var setup in setups)
        {
            setup.Direction = setup.Direction?.Trim().ToLowerInvariant() ?? string.Empty;
            var reason = Check(setup, priceOk);
            if (reason is not null)
            {
                warnings.Add($"Dropped setup '{setup.Id}': {reason}.");
                continue;
            }

            if (valid.Count == MaxSetups)
            {
                warnings.Add($"Dropped setup '{setup.Id}': limit of {MaxSetups} setups.");
                continue;
            }

            setup.Id = string.IsNullOrWhiteSpace(setup.Id) || valid.Any(s => s.Id == setup.Id) ? $"setup-{valid.Count + 1}" : setup.Id.Trim();
            setup.Type = Pick(setup.Type, SetupTypes, "pullback");
            setup.RiskReward = Math.Round(Math.Abs(setup.TakeProfits[0] - setup.Entry) / Math.Abs(setup.Entry - setup.StopLoss), 2);
            setup.Confluences = (setup.Confluences ?? []).Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()).ToList();
            setup.Invalidation = setup.Invalidation?.Trim() ?? string.Empty;
            valid.Add(setup);
        }

        return valid;
    }

    private static string? Check(TradeSetup setup, Func<decimal, bool> priceOk)
    {
        var isLong = setup.Direction == "long";
        if (!isLong && setup.Direction != "short")
        {
            return "unknown direction";
        }

        if (setup.TakeProfits is null || setup.TakeProfits.Count == 0)
        {
            return "no take profit";
        }

        var prices = setup.TakeProfits.Append(setup.Entry).Append(setup.StopLoss).ToList();
        if (prices.Any(p => p <= 0 || !priceOk(p)))
        {
            return "price outside the market range";
        }

        var ordered = isLong
            ? setup.StopLoss < setup.Entry && setup.TakeProfits.All(tp => tp > setup.Entry)
            : setup.StopLoss > setup.Entry && setup.TakeProfits.All(tp => tp < setup.Entry);

        if (!ordered)
        {
            return "stop loss, entry and take profit are inconsistent with the direction";
        }

        var reward = Math.Abs(setup.TakeProfits[0] - setup.Entry);
        var risk = Math.Abs(setup.Entry - setup.StopLoss);
        return reward / risk < MinRiskReward ? "risk-reward below minimum" : null;
    }

    private static Drawing? NormalizeDrawing(
        Drawing drawing,
        IReadOnlyDictionary<string, TradeSetup> setups,
        Func<decimal, bool> priceOk,
        Func<long, bool> timeOk,
        Func<ChartPoint, bool> pointOk)
    {
        drawing.Label = Truncate(drawing.Label);

        if (!string.IsNullOrWhiteSpace(drawing.SetupId) && !setups.ContainsKey(drawing.SetupId))
        {
            drawing.SetupId = null;
        }

        switch (drawing)
        {
            case TrendlineDrawing trendline:
                trendline.Color = NormalizeColor(trendline.Color, "#2962ff");
                trendline.Extend = trendline.Extend == "right" ? "right" : "none";
                return trendline.Points is { Count: 2 } && trendline.Points.All(pointOk) && trendline.Points[0].Time != trendline.Points[1].Time ? trendline : null;

            case HorizontalDrawing horizontal:
                horizontal.Color = NormalizeColor(horizontal.Color, "#9598a1");
                horizontal.Style = horizontal.Style == "dashed" ? "dashed" : "solid";
                return priceOk(horizontal.Price) ? horizontal : null;

            case FibonacciDrawing fibonacci:
                fibonacci.Levels = fibonacci.Levels is { Count: > 0 } ? fibonacci.Levels.Where(l => l is >= 0 and <= 4).Distinct().Order().ToList() : DefaultFibLevels.ToList();
                return pointOk(fibonacci.From) && pointOk(fibonacci.To) && fibonacci.From.Price != fibonacci.To.Price ? fibonacci : null;

            case ZoneDrawing zone:
                zone.Kind = Pick(zone.Kind, ZoneKinds, "demand");
                return pointOk(zone.From) && pointOk(zone.To) && zone.From.Price != zone.To.Price ? zone : null;

            case PositionDrawing position:
                if (position.SetupId is null || !setups.TryGetValue(position.SetupId, out var setup) || !timeOk(position.Time))
                {
                    return null;
                }

                position.Entry = setup.Entry;
                position.StopLoss = setup.StopLoss;
                position.TakeProfit = setup.TakeProfits[0];
                return position;

            case MarkerDrawing marker:
                marker.Position = marker.Position == "below" ? "below" : "above";
                marker.Shape = Pick(marker.Shape, MarkerShapes, "circle");
                marker.Text = Truncate(marker.Text) ?? string.Empty;
                return timeOk(marker.Time) ? marker : null;

            default:
                return null;
        }
    }

    private static string Pick(string? value, string[] allowed, string fallback) =>
        allowed.FirstOrDefault(a => string.Equals(a, value?.Trim(), StringComparison.OrdinalIgnoreCase)) ?? fallback;

    private static string NormalizeColor(string? color, string fallback) =>
        color is not null && HexColor().IsMatch(color) ? color : fallback;

    private static string? Truncate(string? value)
    {
        var trimmed = value?.Trim();
        return trimmed is { Length: > MaxLabelLength } ? trimmed[..MaxLabelLength] : trimmed;
    }
}
