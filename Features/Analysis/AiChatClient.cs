using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.Analysis;

public sealed class AiChatClient(HttpClient httpClient, IOptions<AiOptions> options, ILogger<AiChatClient> logger) : IAiChatClient
{
    private const int MaxLoggedBodyLength = 500;

    private readonly AiOptions _options = options.Value;

    public async Task<string> CompleteJsonAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new AiUnavailableException("AI provider is not configured.");
        }

        var payload = new
        {
            model = _options.Model,
            instructions = systemPrompt,
            input = userPrompt,
            temperature = _options.Temperature,
            max_output_tokens = _options.MaxTokens,
            text = new { format = new { type = "json_object" } }
        };

        var stopwatch = Stopwatch.StartNew();

        try
        {
            using var response = await httpClient.PostAsJsonAsync(string.Empty, payload, cancellationToken);
            var body = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("AI request failed with {StatusCode}: {Body}", (int)response.StatusCode, body.Length > MaxLoggedBodyLength ? body[..MaxLoggedBodyLength] : body);
                throw new AiUnavailableException("AI provider returned an error.");
            }

            using var document = JsonDocument.Parse(body);
            LogUsage(document.RootElement, stopwatch.ElapsedMilliseconds);
            return ExtractText(document.RootElement)
                ?? throw new AiUnavailableException("AI provider returned an empty response.");
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or JsonException && !cancellationToken.IsCancellationRequested)
        {
            logger.LogError(exception, "AI request failed after {ElapsedMs} ms", stopwatch.ElapsedMilliseconds);
            throw new AiUnavailableException("AI provider is currently unavailable.", exception);
        }
    }

    private void LogUsage(JsonElement root, long elapsedMilliseconds)
    {
        if (root.TryGetProperty("usage", out var usage))
        {
            logger.LogInformation("AI completed in {ElapsedMs} ms with usage {Usage}", elapsedMilliseconds, usage.GetRawText());
        }
    }

    private static string? ExtractText(JsonElement root)
    {
        if (!root.TryGetProperty("output", out var output) || output.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        var texts = output.EnumerateArray()
            .Where(item => item.TryGetProperty("type", out var type) && type.GetString() == "message")
            .Where(item => item.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
            .SelectMany(item => item.GetProperty("content").EnumerateArray())
            .Where(part => part.TryGetProperty("type", out var type) && type.GetString() == "output_text")
            .Where(part => part.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
            .Select(part => part.GetProperty("text").GetString())
            .Where(text => !string.IsNullOrWhiteSpace(text));

        var joined = string.Concat(texts);
        return joined.Length == 0 ? null : joined;
    }
}
