using Serilog;
using Serilog.Events;

namespace TradingChartAnalyzer.Shared.Logging;

public static class SerilogExtensions
{
    private const string LogDirectoryName = "logs";
    private const string OutputTemplate =
        "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext} {Message:lj}{NewLine}{Exception}";

    public static WebApplicationBuilder AddFileLogging(this WebApplicationBuilder builder)
    {
        var logDirectory = Path.Combine(builder.Environment.ContentRootPath, LogDirectoryName);
        ClearLogDirectory(logDirectory);

        var isDevelopment = builder.Environment.IsDevelopment();

        builder.Host.UseSerilog((context, configuration) =>
        {
            configuration
                .ReadFrom.Configuration(context.Configuration)
                .Enrich.FromLogContext()
                .WriteTo.File(
                    Path.Combine(logDirectory, "log-.txt"),
                    outputTemplate: OutputTemplate,
                    rollingInterval: RollingInterval.Day);

            if (isDevelopment)
            {
                configuration.MinimumLevel.Is(LogEventLevel.Verbose);
            }
        });

        return builder;
    }

    private static void ClearLogDirectory(string logDirectory)
    {
        if (!Directory.Exists(logDirectory))
        {
            return;
        }

        foreach (var file in Directory.EnumerateFiles(logDirectory))
        {
            try
            {
                File.Delete(file);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                continue;
            }
        }
    }
}
