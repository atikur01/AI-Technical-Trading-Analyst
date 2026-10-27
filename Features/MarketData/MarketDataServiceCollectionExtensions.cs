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

        services.AddOptions<TwelveDataOptions>()
            .Bind(configuration.GetSection(TwelveDataOptions.SectionName))
            .Validate(o => Uri.IsWellFormedUriString(o.RestBaseUrl, UriKind.Absolute), "TwelveData:RestBaseUrl must be an absolute URL.")
            .Validate(o => o.RequestsPerMinute > 0 && o.QueueLimit >= 0 && o.MaxQueueWaitSeconds > 0, "TwelveData rate limit settings must be positive.")
            .ValidateOnStart();

        services.AddSingleton<TwelveDataRateLimiter>();
        services.AddMemoryCache();

        services.AddHttpClient<IBinanceMarketDataClient, BinanceMarketDataClient>((provider, client) =>
        {
            var options = provider.GetRequiredService<IOptions<BinanceOptions>>().Value;
            client.BaseAddress = new Uri(options.RestBaseUrl);
        }).AddStandardResilienceHandler();

        services.AddHttpClient<ITwelveDataMarketDataClient, TwelveDataMarketDataClient>((provider, client) =>
        {
            var options = provider.GetRequiredService<IOptions<TwelveDataOptions>>().Value;
            client.BaseAddress = new Uri(options.RestBaseUrl);
            client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", $"apikey {options.ApiKey}");
        }).AddStandardResilienceHandler();

        services.AddTransient<IMarketDataService, MarketDataService>();

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
