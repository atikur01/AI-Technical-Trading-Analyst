using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using TradingChartAnalyzer.Features.Analysis.Models;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Analysis;

[ApiController]
[Route("api/analysis")]
public sealed class AnalysisController(AnalysisService service, IOptions<BinanceOptions> binanceOptions) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting(AnalysisRateLimit.PolicyName)]
    public async Task<ActionResult<AnalysisResult>> Analyze([FromBody] AnalysisRequest request, CancellationToken cancellationToken)
    {
        if (!MarketDataRequestParser.TryNormalizeSymbol(request.Symbol ?? binanceOptions.Value.DefaultSymbol, out var symbol))
        {
            return Problem("Invalid symbol.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (!TimeframeExtensions.TryParse(request.Timeframe, out var timeframe))
        {
            return Problem("Unsupported timeframe.", statusCode: StatusCodes.Status400BadRequest);
        }

        return await service.AnalyzeAsync(symbol, timeframe, cancellationToken);
    }
}

public static class AnalysisRateLimit
{
    public const string PolicyName = "analysis";
}
