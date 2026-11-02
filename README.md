# AI Technical Trading Analyst

**Top-down, multi-timeframe chart analysis powered by Meta Muse Spark, drawn directly on a live chart.**

![.NET 10](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Meta Muse Spark](https://img.shields.io/badge/AI-Meta%20Muse%20Spark-0467DF?logo=meta&logoColor=white)

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), theme **Build for Your World**.

| | |
|---|---|
| **Live demo** | [ai-trading-analysis.runasp.net](http://ai-trading-analysis.runasp.net/) |

## Screenshots

<p align="center">
  <img src="screenshorts/Screenshot%20(699).png" alt="Screenshot 1" width="49%">
  <img src="screenshorts/Screenshot%20(700).png" alt="Screenshot 2" width="49%">
</p>

## Table of Contents

- [Problem](#problem)
- [Solution](#solution)
- [Features](#features)
- [How Meta Muse Spark Is Used](#how-meta-muse-spark-is-used)
- [Reliability](#reliability)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [API](#api)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Credits](#credits)
- [Disclaimer](#disclaimer)

## Problem

Reading a chart properly means checking several timeframes, marking structure, order blocks, fair value gaps, liquidity and Fibonacci levels, and only then deciding whether a trade makes sense. That takes a trader 15 to 30 minutes per chart, and it is easy to skip steps or see what you want to see.

## Solution

AI Technical Trading Analyst does that top-down pass in under a minute. It draws its reasoning directly on a live chart (zones, levels, structure breaks, entry/stop/target boxes and a projected price path) so you can check it against the chart instead of trusting a black box.

## Features

- **One-click AI analysis**: bias, confidence, market structure, key levels and up to 3 trade scenarios, all drawn on the chart.
- **Interactive scenarios**: click a scenario to highlight its drawings, or copy the trade plan.
- **Live markets**: crypto via Binance WebSocket, forex and stocks via Twelve Data, from 1m to 1M timeframes.
- **Macro mode**: weekly and monthly charts produce a cycle narrative and project 6 to 12 future candles.
- **Manual drawing tools**: trend line, horizontal, Fibonacci, rectangle and measure, saved per symbol.
- **Indicators**: SMC overlay, EMA 20/50/200, Bollinger, VWAP, RSI, RSI divergence and MACD.

## How Meta Muse Spark Is Used

```
Market data (Binance, Twelve Data)
        │  4 timeframes × 500 closed candles
        ▼
Deterministic indicators: EMA, ATR, RSI, swings, S/R,
SMC (BOS/CHoCH, order blocks, FVG, EQH/EQL, premium/discount)
        │  compact JSON market snapshot
        ▼
Meta Muse Spark (Meta Model API, Responses endpoint, JSON mode)
        │  analysis + trade scenarios + chart drawings
        ▼
Validator: prices inside range, SL/entry/TP order,
minimum 1:2 R:R, trend filter, valid timestamps
        │  rejected items become visible "validation notes"
        ▼
Chart renderer (TradingView Lightweight Charts custom primitives)
```

- The model call is in [AiChatClient.cs](Features/Analysis/AiChatClient.cs) and the prompts are in [AnalysisPromptBuilder.cs](Features/Analysis/AnalysisPromptBuilder.cs).
- All numbers are computed in code and handed to Muse Spark. The model reasons over them but is told never to invent prices.
- Every response is checked by [AnalysisResultValidator.cs](Features/Analysis/AnalysisResultValidator.cs) before it reaches the chart.
- If the model returns invalid JSON, it gets one automatic repair attempt.

## Reliability

- Analyses are cached per symbol, timeframe and last closed candle, and identical concurrent requests share one model call.
- Per-IP rate limits apply: 5 per minute and 30 per day by default.
- Every successful analysis is saved to `App_Data/analysis-fallback`. If the model is unavailable, the last saved analysis for that chart is shown and clearly labelled.
- Market data calls use timeouts, retries and circuit breakers, and the Twelve Data free tier is protected by a rate limiter.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core (.NET 10), Serilog, Microsoft.Extensions.Http.Resilience |
| AI | Meta Muse Spark (`muse-spark-1.3`) via the Meta Model API |
| Frontend | JavaScript, Tailwind CSS, TradingView Lightweight Charts |
| Market data | Binance (REST and WebSocket), Twelve Data |
| Packaging | Docker |

## Getting Started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) and npm
- A Meta Model API key and a free [Twelve Data](https://twelvedata.com) key

### Run locally

1. Copy `.env.example` to `.env` and set the keys (`.env` is git-ignored):

   ```
   Ai__ApiKey=<Meta Model API key>
   TwelveData__ApiKey=<free key from twelvedata.com>
   ```

2. Install frontend dependencies once. Tailwind then builds `wwwroot/css/site.css` before every build:

   ```
   npm install
   ```

3. Start the app and open the URL it prints:

   ```
   dotnet run
   ```

## Deployment

```
docker build -t ai-technical-trading-analyst .
docker run -p 8080:8080 -e Ai__ApiKey=... -e TwelveData__ApiKey=... ai-technical-trading-analyst
```

The image works on any container host, such as Render, Fly.io, Azure App Service or Google Cloud Run. Set the two keys as host secrets. The image sets `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` so that per-IP limits use the real client IP behind the host's proxy.

## Configuration

Settings live in `appsettings.json`.

| Section | Keys |
|---|---|
| `Ai` | `BaseUrl`, `Model`, `Temperature`, `MaxTokens`, `TimeoutSeconds` |
| `Analysis` | `PerMinuteLimitPerIp`, `DailyLimitPerIp`, `FallbackDirectory` |
| `Binance` | `RestBaseUrl`, `WsBaseUrl`, `DefaultSymbol` |
| `TwelveData` | `ForexPairs`, `Stocks`, `PollSeconds`, `CacheSeconds` |

- The Binance defaults use the public market-data mirrors (`data-api.binance.vision`), which also work in regions where `api.binance.com` is blocked.
- The Twelve Data free tier allows 8 requests per minute, and each analysis uses up to 4.

## API

| Method | Endpoint | Notes |
|---|---|---|
| `GET` | `/api/market/klines` | Candle data |
| `POST` | `/api/analysis` | Rate limited |
| `GET` | `/health` | Health check |

## Keyboard Shortcuts

| Keys | Action |
|---|---|
| `1` to `8` | Switch timeframe |
| `A` | Analyze |
| `Esc` | Cancel tool, deselect, close panel |
| `+` `-` | Zoom |
| `←` `→` | Pan (Shift = fast) |
| `Home` / `End` | Fit / jump to latest |
| `V` `P` | Cursor / pan |
| `T` `H` `F` `R` `M` | Trend line / horizontal / Fibonacci / rectangle / measure |
| `Del` | Delete selected drawing |

## Credits

- [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/), Apache-2.0
- Market data from [Binance](https://www.binance.com) and [Twelve Data](https://twelvedata.com)
- AI analysis by Meta Muse Spark via the Meta Model API

## Disclaimer

AI Technical Trading Analyst is an educational analysis tool. Its output is AI-generated and may be wrong. Trade scenarios are hypotheses, not recommendations, and nothing here is financial advice.
