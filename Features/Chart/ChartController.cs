using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Chart;

public sealed class ChartController(IOptions<BinanceOptions> options) : Controller
{
    public IActionResult Index() => View(new ChartViewModel(options.Value.DefaultSymbol, options.Value.WsBaseUrl));
}

public sealed record ChartViewModel(string Symbol, string WsBaseUrl);
