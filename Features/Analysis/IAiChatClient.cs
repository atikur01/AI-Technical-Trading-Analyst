namespace TradingChartAnalyzer.Features.Analysis;

public interface IAiChatClient
{
    Task<string> CompleteJsonAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken);
}

public sealed class AiUnavailableException(string message, Exception? inner = null) : Exception(message, inner);
