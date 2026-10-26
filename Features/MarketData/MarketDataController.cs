using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.MarketData;

[ApiController]
[Route("api/market")]
public sealed class MarketDataController(IBinanceMarketDataClient client, IOptions<BinanceOptions> options) : ControllerBase
{
    [HttpGet("config")]
    public IActionResult GetConfig() => Ok(new
    {
        symbol = options.Value.DefaultSymbol,
        wsBaseUrl = options.Value.WsBaseUrl
    });

    [HttpGet("symbols")]
    public async Task<IActionResult> GetSymbols(CancellationToken cancellationToken) =>
        Ok(await client.GetSymbolsAsync(cancellationToken));

    [HttpGet("klines")]
    public async Task<IActionResult> GetKlines(
        [FromQuery] string? symbol,
        [FromQuery] string interval = "1h",
        [FromQuery] int limit = 500,
        CancellationToken cancellationToken = default)
    {
        if (!MarketDataRequestParser.TryNormalizeSymbol(symbol ?? options.Value.DefaultSymbol, out var normalizedSymbol))
        {
            return Problem("Invalid symbol.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (!TimeframeExtensions.TryParse(interval, out var timeframe))
        {
            return Problem("Unsupported interval.", statusCode: StatusCodes.Status400BadRequest);
        }

        var candles = await client.GetKlinesAsync(normalizedSymbol, timeframe, limit, cancellationToken);
        return Ok(candles.Select(c => new
        {
            time = c.OpenTimeSeconds,
            open = c.Open,
            high = c.High,
            low = c.Low,
            close = c.Close,
            volume = c.Volume
        }));
    }
}
