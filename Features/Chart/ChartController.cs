using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using TradingChartAnalyzer.Features.Analysis;
using TradingChartAnalyzer.Features.MarketData;

namespace TradingChartAnalyzer.Features.Chart;

public sealed class ChartController(
    IOptions<BinanceOptions> binanceOptions,
    IOptions<TwelveDataOptions> twelveDataOptions,
    IOptions<AiOptions> aiOptions) : Controller
{
    public IActionResult Index() => View(new ChartViewModel(
        binanceOptions.Value.DefaultSymbol,
        binanceOptions.Value.WsBaseUrl,
        twelveDataOptions.Value.PollSeconds,
        aiOptions.Value.Model));
}

public sealed record ChartViewModel(string Symbol, string WsBaseUrl, int PollSeconds, string AiModel);
