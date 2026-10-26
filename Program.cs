using Microsoft.AspNetCore.Mvc.Razor;
using TradingChartAnalyzer.Features.Analysis;
using TradingChartAnalyzer.Features.Backtest;
using TradingChartAnalyzer.Features.MarketData;
using TradingChartAnalyzer.Shared.Configuration;
using TradingChartAnalyzer.Shared.Http;
using TradingChartAnalyzer.Shared.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddDotEnvFile();

builder.Services
    .AddControllersWithViews()
    .AddJsonOptions(options => AppJson.Configure(options.JsonSerializerOptions));

builder.Services.Configure<RazorViewEngineOptions>(options =>
{
    options.ViewLocationFormats.Clear();
    options.ViewLocationFormats.Add("/Features/{1}/Views/{0}.cshtml");
    options.ViewLocationFormats.Add("/Shared/Views/{0}.cshtml");
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services
    .AddMarketData(builder.Configuration)
    .AddAnalysis(builder.Configuration)
    .AddBacktest();

var app = builder.Build();

app.UseExceptionHandler();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseStatusCodePages();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthorization();

app.MapStaticAssets();
app.MapHealthChecks("/health");
app.MapControllers();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Chart}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
