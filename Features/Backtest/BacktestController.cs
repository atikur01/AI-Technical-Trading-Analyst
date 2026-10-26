using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using TradingChartAnalyzer.Features.Backtest.Models;
using TradingChartAnalyzer.Features.Backtest.Strategies;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Backtest;

[ApiController]
[Route("api/backtest")]
public sealed class BacktestController(BacktestService service, IOptions<BinanceOptions> binanceOptions) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<BacktestResult>> Run([FromBody] BacktestRequest request, CancellationToken cancellationToken)
    {
        if (!MarketDataRequestParser.TryNormalizeSymbol(request.Symbol ?? binanceOptions.Value.DefaultSymbol, out var symbol))
        {
            return Problem("Invalid symbol.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (!TimeframeExtensions.TryParse(request.Timeframe, out var timeframe))
        {
            return Problem("Unsupported timeframe.", statusCode: StatusCodes.Status400BadRequest);
        }

        var error = BacktestRequestValidator.Validate(request, timeframe);
        if (error is not null)
        {
            return Problem(error, statusCode: StatusCodes.Status400BadRequest);
        }

        var strategy = StrategyFactory.Create(request);
        if (strategy is null)
        {
            return Problem("Unknown strategy.", statusCode: StatusCodes.Status400BadRequest);
        }

        try
        {
            return await service.RunAsync(symbol, timeframe, request, strategy, cancellationToken);
        }
        catch (BacktestInputException exception)
        {
            return Problem(exception.Message, statusCode: StatusCodes.Status400BadRequest);
        }
    }
}
