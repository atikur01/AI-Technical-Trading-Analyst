using System.Threading.RateLimiting;
using Microsoft.Extensions.Options;

namespace TradingChartAnalyzer.Features.MarketData;

public sealed class TwelveDataRateLimiter : IDisposable
{
    private readonly SlidingWindowRateLimiter _limiter;
    private readonly TimeSpan _maxQueueWait;

    public TwelveDataRateLimiter(IOptions<TwelveDataOptions> options)
    {
        var value = options.Value;
        _maxQueueWait = TimeSpan.FromSeconds(value.MaxQueueWaitSeconds);
        _limiter = new SlidingWindowRateLimiter(new SlidingWindowRateLimiterOptions
        {
            PermitLimit = value.RequestsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            SegmentsPerWindow = 12,
            QueueLimit = value.QueueLimit,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            AutoReplenishment = true
        });
    }

    public async Task WaitAsync(CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(_maxQueueWait);

        try
        {
            using var lease = await _limiter.AcquireAsync(1, timeout.Token);
            if (!lease.IsAcquired)
            {
                throw new MarketDataRateLimitedException();
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new MarketDataRateLimitedException();
        }
    }

    public void Dispose() => _limiter.Dispose();
}
