using System.Text.Json;
using System.Text.Json.Serialization;

namespace TradingChartAnalyzer.Shared.Json;

public static class AppJson
{
    public static void Configure(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PropertyNameCaseInsensitive = true;
        options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.NumberHandling = JsonNumberHandling.AllowReadingFromString;
        options.AllowOutOfOrderMetadataProperties = true;
    }

    public static readonly JsonSerializerOptions Options = Create();

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions();
        Configure(options);
        return options;
    }
}
