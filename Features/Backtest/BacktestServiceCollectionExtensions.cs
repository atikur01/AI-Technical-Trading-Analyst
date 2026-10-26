namespace TradingChartAnalyzer.Features.Backtest;

public static class BacktestServiceCollectionExtensions
{
    public static IServiceCollection AddBacktest(this IServiceCollection services)
    {
        services.AddSingleton<BacktestEngine>();
        services.AddScoped<BacktestService>();
        return services;
    }
}
