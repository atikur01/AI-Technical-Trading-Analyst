using System.Net.Http.Headers;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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

        services.AddOptions<AnalysisOptions>()
            .Bind(configuration.GetSection(AnalysisOptions.SectionName))
            .Validate(o => o.PerMinuteLimitPerIp > 0 && o.DailyLimitPerIp > 0, "Analysis rate limits must be positive.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.FallbackDirectory), "Analysis:FallbackDirectory is required.")
            .ValidateOnStart();

        services.AddSingleton<AnalysisFallbackStore>();
        services.AddScoped<AnalysisService>();

        services.AddRateLimiter(_ => { });
        services.AddOptions<RateLimiterOptions>().Configure<IOptions<AnalysisOptions>>((limiter, analysisOptions) =>
        {
            var limits = analysisOptions.Value;
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.AddPolicy(AnalysisRateLimit.PolicyName, context => RateLimitPartition.GetFixedWindowLimiter(
                ClientKey(context),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = limits.PerMinuteLimitPerIp, Window = TimeSpan.FromMinutes(1) }));
            limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context => IsAnalysisRequest(context)
                ? RateLimitPartition.GetFixedWindowLimiter(
                    ClientKey(context),
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = limits.DailyLimitPerIp, Window = TimeSpan.FromDays(1) })
                : RateLimitPartition.GetNoLimiter(string.Empty));
            limiter.OnRejected = async (context, token) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
                }

                await context.HttpContext.Response.WriteAsJsonAsync(
                    new ProblemDetails { Status = StatusCodes.Status429TooManyRequests, Title = RejectionMessage(retryAfter) },
                    token);
            };
        });

        return services;
    }

    private static string ClientKey(HttpContext context) => context.Connection.RemoteIpAddress?.ToString() ?? "anonymous";

    private static bool IsAnalysisRequest(HttpContext context) =>
        context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName == AnalysisRateLimit.PolicyName;

    private static string RejectionMessage(TimeSpan retryAfter) => retryAfter > TimeSpan.FromMinutes(1)
        ? "Daily analysis limit reached. Please come back later."
        : "Too many analysis requests. Please wait a minute and try again.";
}
