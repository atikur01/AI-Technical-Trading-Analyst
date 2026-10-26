using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.MarketData;

public static class MarketDataServiceCollectionExtensions
{
    public static IServiceCollection AddMarketData(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<BinanceOptions>()
            .Bind(configuration.GetSection(BinanceOptions.SectionName))
            .Validate(o => Uri.IsWellFormedUriString(o.RestBaseUrl, UriKind.Absolute), "Binance:RestBaseUrl must be an absolute URL.")
            .ValidateOnStart();

        services.AddMemoryCache();

        services.AddHttpClient<IBinanceMarketDataClient, BinanceMarketDataClient>((provider, client) =>
        {
            var options = provider.GetRequiredService<IOptions<BinanceOptions>>().Value;
            client.BaseAddress = new Uri(options.RestBaseUrl);
        }).AddStandardResilienceHandler();

        services.AddHealthChecks().AddCheck<BinanceHealthCheck>("binance");

        return services;
    }
}

public sealed class BinanceHealthCheck(IBinanceMarketDataClient client) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        await client.PingAsync(cancellationToken)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy("Binance is not reachable.");
}
