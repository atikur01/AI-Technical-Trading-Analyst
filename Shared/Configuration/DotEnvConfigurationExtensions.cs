namespace TradingChartAnalyzer.Shared.Configuration;

public static class DotEnvConfigurationExtensions
{
    public static IConfigurationBuilder AddDotEnvFile(this IConfigurationBuilder configuration, string path = ".env")
    {
        var fullPath = Path.Combine(Directory.GetCurrentDirectory(), path);
        if (!File.Exists(fullPath))
        {
            return configuration;
        }

        var values = File.ReadLines(fullPath)
            .Select(line => line.Trim())
            .Where(line => line.Length > 0 && !line.StartsWith('#'))
            .Select(line => line.Split('=', 2))
            .Where(parts => parts.Length == 2 && parts[0].Trim().Length > 0)
            .ToDictionary(
                parts => parts[0].Trim().Replace("__", ConfigurationPath.KeyDelimiter),
                parts => parts[1].Trim().Trim('"', '\''),
                StringComparer.OrdinalIgnoreCase);

        return configuration.AddInMemoryCollection(values!);
    }
}
