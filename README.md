# AI Trading Chart Analyzer

ASP.NET Core MVC (.NET 9) app that shows a live Binance chart, asks an AI model to analyze it and draw trade setups on the chart.

## Run

1. Copy `.env.example` to `.env` and set the AI key (`.env` is git-ignored, never commit it):

   ```
   Ai__ApiKey=<your key>
   ```

2. Install Tailwind once (`npm install`). It then runs automatically before every build and writes `wwwroot/css/site.css`. To build manually:

   ```
   npx tailwindcss -i wwwroot/css/input.css -o wwwroot/css/site.css --minify
   ```

3. Start the app:

   ```
   dotnet run
   ```

## Configuration (`appsettings.json`)

- `TwelveData`: forex and stocks come from [Twelve Data](https://twelvedata.com). Set `TwelveData__ApiKey` in `.env` (free key). `ForexPairs` and `Stocks` are the symbols offered in the picker; `PollSeconds` is how often the live candle refreshes (the free tier allows 8 requests/min, and each analysis uses 4).
- `Binance`: `RestBaseUrl` (use `https://data-api.binance.vision` if `api.binance.com` is blocked), `WsBaseUrl`, `DefaultSymbol`.
- `Ai`: `BaseUrl` (Responses API endpoint), `Model`, `Temperature`, `MaxTokens` (reasoning tokens count against it), `TimeoutSeconds`.

## Endpoints

- `GET /api/market/klines`, `POST /api/analysis` (rate limited), `GET /health`

## Shortcuts

`1`–`6` timeframe, `A` analyze, `Esc` cancel tool / deselect / close panel.

Chart: `+` `-` zoom, `←` `→` pan (Shift = fast), `Home` fit, `End` latest.

Drawing tools: `V` cursor, `T` trend line, `H` horizontal line, `F` fib, `R` rectangle, `M` measure, `Del` delete selected. Drag a drawing to move it, drag its handles to resize. Manual drawings are saved per symbol in the browser.

This tool is for analysis only and is not financial advice.
