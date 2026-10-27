# ChartAI: Multi-Timeframe Chart Analysis with Meta Muse Spark

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), theme **Build for Your World**.

**Live demo:** _add your deployed URL here_ · **Demo video:** _add link here_

## The problem

Reading a chart properly means checking several timeframes, marking structure, order blocks, fair value gaps, liquidity and Fibonacci levels, and only then deciding whether a trade makes sense. That takes a trader 15–30 minutes per chart, and it is easy to skip steps or see what you want to see.

ChartAI does that top-down pass in under a minute. It draws its reasoning directly on a live chart (zones, levels, structure breaks, entry/stop/target boxes and a projected price path) so you can check it against the chart instead of trusting a black box.

## How Meta's model is used

```
Market data (Binance, Twelve Data)
        │  4 timeframes × 500 closed candles
        ▼
Deterministic indicators: EMA, ATR, RSI, swings, S/R, SMC (BOS/CHoCH, order blocks, FVG, EQH/EQL, premium/discount)
        │  compact JSON market snapshot
        ▼
Meta Muse Spark (Meta Model API, Responses endpoint, JSON mode)
        │  analysis + trade scenarios + chart drawings
        ▼
Validator: prices inside range, SL/entry/TP order, minimum 1:2 R:R, trend filter, valid timestamps
        │  rejected items become visible "validation notes"
        ▼
Chart renderer (TradingView Lightweight Charts custom primitives)
```

- The model call is in [Features/Analysis/AiChatClient.cs](Features/Analysis/AiChatClient.cs) and the prompts are in [Features/Analysis/AnalysisPromptBuilder.cs](Features/Analysis/AnalysisPromptBuilder.cs).
- All numbers are computed in code and handed to Muse Spark. The model reasons over them but is told never to invent prices. Every response is checked by [AnalysisResultValidator.cs](Features/Analysis/AnalysisResultValidator.cs) before it reaches the chart.
- If the model returns invalid JSON, it gets one automatic repair attempt.
- Weekly and monthly charts switch to a macro prompt that writes a cycle narrative and projects 6–12 future candles.

## Features

- Live crypto (Binance WebSocket), forex and stocks (Twelve Data), with 1m to 1M timeframes
- One-click AI analysis that returns bias, confidence, market structure, key levels and up to 3 trade scenarios, all drawn on the chart
- Click a scenario to highlight its drawings, or copy the trade plan
- Manual drawing tools (trend line, horizontal, Fibonacci, rectangle, measure), saved per symbol
- Indicators: SMC overlay, EMA 20/50/200, Bollinger, VWAP, RSI, RSI divergence, MACD

## Reliability

- Analyses are cached per symbol, timeframe and last closed candle, and identical requests running at the same time share one model call.
- Per-IP rate limits apply: 5 per minute and 30 per day by default (`Analysis` section).
- Every successful analysis is saved to `App_Data/analysis-fallback`. If the model is unavailable, the last saved analysis for that chart is shown and clearly labelled.
- Market data calls use timeouts, retries and circuit breakers, and the Twelve Data free tier is protected by a rate limiter.

## Run locally

1. Copy `.env.example` to `.env` and set the keys (`.env` is git-ignored):

   ```
   Ai__ApiKey=<Meta Model API key>
   TwelveData__ApiKey=<free key from twelvedata.com>
   ```

2. Run `npm install` once. Tailwind then builds `wwwroot/css/site.css` before every build.
3. Run `dotnet run`, then open the URL it prints.

## Deploy

```
docker build -t chartai .
docker run -p 8080:8080 -e Ai__ApiKey=... -e TwelveData__ApiKey=... chartai
```

The image works on any container host, such as Render, Fly.io, Azure App Service or Google Cloud Run. Set the two keys as host secrets. The image sets `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` so that per-IP limits use the real client IP behind the host's proxy.

## Configuration (`appsettings.json`)

- `Ai`: `BaseUrl`, `Model` (`muse-spark-1.3`), `Temperature`, `MaxTokens`, `TimeoutSeconds`.
- `Analysis`: `PerMinuteLimitPerIp`, `DailyLimitPerIp`, `FallbackDirectory`.
- `Binance`: `RestBaseUrl`, `WsBaseUrl`, `DefaultSymbol`. The defaults use the public market-data mirrors (`data-api.binance.vision`), which also work in regions where `api.binance.com` is blocked.
- `TwelveData`: `ForexPairs`, `Stocks`, `PollSeconds`, `CacheSeconds`. The free tier allows 8 requests per minute, and each analysis uses up to 4.

## Endpoints

- `GET /api/market/klines`
- `POST /api/analysis` (rate limited)
- `GET /health`

## Shortcuts

- `1`–`8` timeframe, `A` analyze, `Esc` cancel tool / deselect / close panel.
- `+` `-` zoom, `←` `→` pan (Shift = fast), `Home` fit, `End` latest.
- `V` cursor, `P` pan, `T` trend line, `H` horizontal, `F` fib, `R` rectangle, `M` measure, `Del` delete selected.

## Credits

- [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/), Apache-2.0
- Market data from [Binance](https://www.binance.com) and [Twelve Data](https://twelvedata.com)
- AI analysis by Meta Muse Spark via the Meta Model API

## Disclaimer

ChartAI is an educational analysis tool. Its output is AI-generated and may be wrong. Trade scenarios are hypotheses, not recommendations, and nothing here is financial advice.
