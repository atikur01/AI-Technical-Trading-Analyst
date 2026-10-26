using System.Text.Json.Serialization;

namespace TradingChartAnalyzer.Features.Analysis.Models;

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type", UnknownDerivedTypeHandling = JsonUnknownDerivedTypeHandling.FailSerialization)]
[JsonDerivedType(typeof(TrendlineDrawing), "trendline")]
[JsonDerivedType(typeof(HorizontalDrawing), "horizontal")]
[JsonDerivedType(typeof(FibonacciDrawing), "fibonacci")]
[JsonDerivedType(typeof(ZoneDrawing), "zone")]
[JsonDerivedType(typeof(PositionDrawing), "position")]
[JsonDerivedType(typeof(MarkerDrawing), "marker")]
[JsonDerivedType(typeof(ProjectionDrawing), "projection")]
public abstract class Drawing
{
    public string? SetupId { get; set; }
    public string? Label { get; set; }
}

public sealed class ChartPoint
{
    public long Time { get; set; }
    public decimal Price { get; set; }
}

public sealed class TrendlineDrawing : Drawing
{
    public List<ChartPoint> Points { get; set; } = [];
    public string Color { get; set; } = "#2962ff";
    public string Extend { get; set; } = "none";
}

public sealed class HorizontalDrawing : Drawing
{
    public decimal Price { get; set; }
    public string Color { get; set; } = "#9598a1";
    public string Style { get; set; } = "solid";
}

public sealed class FibonacciDrawing : Drawing
{
    public ChartPoint From { get; set; } = new();
    public ChartPoint To { get; set; } = new();
    public List<double> Levels { get; set; } = [];
}

public sealed class ZoneDrawing : Drawing
{
    public ChartPoint From { get; set; } = new();
    public ChartPoint To { get; set; } = new();
    public string Kind { get; set; } = "demand";
}

public sealed class PositionDrawing : Drawing
{
    public long Time { get; set; }
    public decimal Entry { get; set; }
    public decimal StopLoss { get; set; }
    public decimal TakeProfit { get; set; }
}

public sealed class MarkerDrawing : Drawing
{
    public long Time { get; set; }
    public string Position { get; set; } = "above";
    public string Shape { get; set; } = "circle";
    public string Text { get; set; } = string.Empty;
}

public sealed class ProjectedCandle
{
    public decimal Open { get; set; }
    public decimal High { get; set; }
    public decimal Low { get; set; }
    public decimal Close { get; set; }
}

public sealed class ProjectionDrawing : Drawing
{
    public List<ProjectedCandle> Candles { get; set; } = [];
    public string Color { get; set; } = "#2962ff";
}
