using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Chart;

public sealed class ChartController(IOptions<BinanceOptions> binanceOptions, IOptions<TwelveDataOptions> twelveDataOptions) : Controller
{
    public IActionResult Index() => View(new ChartViewModel(
        binanceOptions.Value.DefaultSymbol,
        binanceOptions.Value.WsBaseUrl,
        twelveDataOptions.Value.PollSeconds));
}

public sealed record ChartViewModel(string Symbol, string WsBaseUrl, int PollSeconds);
