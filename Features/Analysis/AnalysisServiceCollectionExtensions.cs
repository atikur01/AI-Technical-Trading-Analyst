using System.Net.Http.Headers;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.Analysis;

public static class AnalysisServiceCollectionExtensions
{
    public static IServiceCollection AddAnalysis(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<AiOptions>()
            .Bind(configuration.GetSection(AiOptions.SectionName))
            .Validate(o => Uri.IsWellFormedUriString(o.BaseUrl, UriKind.Absolute), "Ai:BaseUrl must be an absolute URL.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.Model), "Ai:Model is required.")
            .ValidateOnStart();

        services.AddHttpClient<IAiChatClient, AiChatClient>((provider, client) =>
        {
            var options = provider.GetRequiredService<IOptions<AiOptions>>().Value;
            client.BaseAddress = new Uri(options.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
        });

        services.AddScoped<AnalysisService>();

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.AddPolicy(AnalysisRateLimit.PolicyName, context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1) }));
            limiter.OnRejected = async (context, token) =>
            {
                await context.HttpContext.Response.WriteAsJsonAsync(
                    new ProblemDetails { Status = StatusCodes.Status429TooManyRequests, Title = "Too many analysis requests. Please wait a minute and try again." },
                    token);
            };
        });

        return services;
    }
}
