using Microsoft.Extensions.Configuration.Memory;

namespace TradingChartAnalyzer.Shared.Configuration;

public static class DotEnvConfigurationExtensions
{
    public static IConfigurationBuilder AddDotEnvFile(this IConfigurationBuilder configuration, string path)
    {
        if (!File.Exists(path))
        {
            return configuration;
        }

        var values = File.ReadLines(path)
            .Select(line => line.Trim())
            .Where(line => line.Length > 0 && !line.StartsWith('#'))
            .Select(line => line.Split('=', 2))
            .Where(parts => parts.Length == 2 && parts[0].Trim().Length > 0)
            .ToDictionary(
                parts => parts[0].Trim().Replace("__", ConfigurationPath.KeyDelimiter),
                parts => parts[1].Trim().Trim('"', '\''),
                StringComparer.OrdinalIgnoreCase);

        var insertAt = configuration.Sources.ToList().FindLastIndex(source => source is FileConfigurationSource) + 1;
        configuration.Sources.Insert(insertAt, new MemoryConfigurationSource { InitialData = values! });

        return configuration;
    }
}
