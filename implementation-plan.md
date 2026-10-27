# AI Trading Chart Analyzer — ইমপ্লিমেন্টেশন প্ল্যান (Cursor Prompt সহ)

> **প্রজেক্ট:** `TradingChartAnalyzer` (ASP.NET Core MVC, .NET 9)
> **ফ্রন্টএন্ড:** Tailwind CSS + jQuery + TradingView Lightweight Charts
> **ডেটা সোর্স:** Binance Spot — `BTCUSDT`
> **AI মডেল:** `muse-spark-1.3-contributor`
> **লক্ষ্য:** একজন অভিজ্ঞ ট্রেডারের মতো চার্ট অ্যানালাইসিস করা, ট্রেড সেটআপ খুঁজে বের করা, চার্টে AI নিজেই লাইন/ফিবোনাচি/জোন আঁকবে, এবং ব্যাকটেস্ট করা যাবে।

---

## ১. এই ডকুমেন্ট কীভাবে ব্যবহার করবেন

1. পুরো ফাইলটি Cursor-এ খুলুন।
2. **সেকশন ৩ — "Master Prompt"** অংশটি Cursor Agent/Composer-এ পেস্ট করুন।
3. তারপর **সেকশন ৪**-এর ফেজ অনুযায়ী এক এক করে Phase Prompt দিন। প্রতিটি ফেজ শেষে অ্যাপ রান করে যাচাই করুন, তারপর পরের ফেজে যান।
4. একসাথে সব ফেজ দেবেন না — ছোট ধাপে কাজ করালে Cursor-এর আউটপুট অনেক বেশি নির্ভুল হয়।

---

## ২. আর্কিটেকচার ওভারভিউ

### ২.১ মূল নীতি

| নীতি | ব্যাখ্যা |
|---|---|
| **AI হিসাব করবে না, সিদ্ধান্ত নেবে** | EMA, RSI, ATR, Swing High/Low, Fibonacci লেভেল — সব C#-এ নির্ভুলভাবে হিসাব হবে। AI শুধু এই স্ট্রাকচার্ড ডেটা পড়ে ট্রেডারের মতো ব্যাখ্যা ও সেটআপ দেবে। এতে AI-এর ভুল সংখ্যা (hallucination) কমে। |
| **AI-এর আউটপুট = JSON** | AI ফ্রি-টেক্সট নয়, একটি নির্দিষ্ট JSON স্কিমা রিটার্ন করবে, যেখানে `analysis`, `setups` ও `drawings` থাকবে। সার্ভার এটা ভ্যালিডেট করবে। |
| **ড্রয়িং হবে ডিক্লারেটিভ** | AI বলবে "এই দুই পয়েন্টে ট্রেন্ডলাইন", "এই swing থেকে ফিবোনাচি" — ফ্রন্টএন্ড সেই JSON দেখে Lightweight Charts-এ রেন্ডার করবে। |
| **ব্যাকটেস্ট ডিটারমিনিস্টিক** | ব্যাকটেস্ট C#-এ রুল-বেসড চলবে, কোনো look-ahead bias থাকবে না। AI-এর দেওয়া সেটআপের রুলও ব্যাকটেস্ট করা যাবে। |
| **Feature-first আর্কিটেকচার** | প্রতিটি ফিচারের Controller, Service, Model, View একই ফোল্ডারে। |

### ২.২ ফোল্ডার স্ট্রাকচার (Feature-first)

```
TradingChartAnalyzer/
├── Features/
│   ├── Chart/
│   │   ├── ChartController.cs
│   │   └── Views/Index.cshtml
│   ├── MarketData/
│   │   ├── BinanceOptions.cs
│   │   ├── IBinanceMarketDataClient.cs
│   │   ├── BinanceMarketDataClient.cs
│   │   ├── Candle.cs
│   │   ├── Timeframe.cs
│   │   └── MarketDataController.cs
│   ├── Indicators/
│   │   ├── IndicatorCalculator.cs        (EMA, SMA, RSI, MACD, ATR, Bollinger, VWAP)
│   │   ├── SwingDetector.cs              (Swing High/Low, market structure: HH/HL/LH/LL, BOS/CHoCH)
│   │   ├── SupportResistanceDetector.cs
│   │   ├── FibonacciCalculator.cs
│   │   └── MarketSnapshot.cs             (AI-কে পাঠানোর জন্য কম্প্যাক্ট সারাংশ)
│   ├── Analysis/
│   │   ├── AiOptions.cs
│   │   ├── IAiChatClient.cs
│   │   ├── AiChatClient.cs
│   │   ├── AnalysisPromptBuilder.cs
│   │   ├── AnalysisResultValidator.cs
│   │   ├── AnalysisService.cs
│   │   ├── AnalysisController.cs
│   │   └── Models/ (AnalysisRequest, AnalysisResult, TradeSetup, Drawing)
├── Shared/
│   ├── Http/ (Polly retry, error handling)
│   └── Views/_Layout.cshtml
├── wwwroot/
│   ├── css/input.css → site.css (Tailwind build output)
│   └── js/
│       ├── chart/ (chart-core.js, realtime-feed.js)
│       ├── drawings/ (drawing-renderer.js, primitives/: trendline, fib, rect-zone, position-box, label)
│       └── analysis/ (analysis-panel.js)
└── Program.cs
```

> Feature ফোল্ডারে View রাখার জন্য `RazorViewEngineOptions.ViewLocationFormats`-এ `/Features/{1}/Views/{0}.cshtml` ও `/Shared/Views/{0}.cshtml` যোগ করতে হবে।

### ২.৩ ডেটা ফ্লো

```
[Browser]
  ├─ Binance WebSocket (btcusdt@kline_<tf>) ──► রিয়েলটাইম ক্যান্ডেল আপডেট
  ├─ GET /api/market/klines ──► [MarketData] ──► Binance REST /api/v3/klines
  ├─ POST /api/analysis ──► [Analysis]
  │        ├─ Candles (multi-timeframe) ──► [Indicators] ──► MarketSnapshot
  │        ├─ PromptBuilder ──► muse-spark-1.3-contributor ──► JSON
  │        └─ Validator ──► AnalysisResult { analysis, setups[], drawings[] }
  │                          └─► Frontend drawing-renderer চার্টে আঁকে
```

### ২.৪ AI রেসপন্স JSON স্কিমা (Contract)

```json
{
  "analysis": {
    "trend": { "htf": "bullish|bearish|ranging", "ltf": "bullish|bearish|ranging" },
    "marketStructure": "string",
    "keyLevels": [{ "price": 0, "type": "support|resistance", "strength": 1 }],
    "summary": "string",
    "bias": "long|short|neutral",
    "confidence": 0
  },
  "setups": [
    {
      "id": "setup-1",
      "direction": "long|short",
      "type": "breakout|pullback|reversal|range",
      "entry": 0, "stopLoss": 0,
      "takeProfits": [0, 0],
      "riskReward": 0,
      "confluences": ["string"],
      "invalidation": "string"
    }
  ],
  "drawings": [
    { "type": "trendline", "points": [{ "time": 0, "price": 0 }, { "time": 0, "price": 0 }], "color": "#hex", "label": "string", "extend": "right|none" },
    { "type": "horizontal", "price": 0, "color": "#hex", "label": "string", "style": "solid|dashed" },
    { "type": "fibonacci", "from": { "time": 0, "price": 0 }, "to": { "time": 0, "price": 0 }, "levels": [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] },
    { "type": "zone", "from": { "time": 0, "price": 0 }, "to": { "time": 0, "price": 0 }, "kind": "supply|demand|fvg|orderblock" },
    { "type": "position", "setupId": "setup-1", "time": 0, "entry": 0, "stopLoss": 0, "takeProfit": 0 },
    { "type": "marker", "time": 0, "position": "above|below", "shape": "arrowUp|arrowDown|circle", "text": "BOS" }
  ]
}
```

---

## ৩. Master Prompt (Cursor-এ প্রথমে এটি পেস্ট করুন)

```text
তুমি একজন সিনিয়র .NET + ফ্রন্টএন্ড ইঞ্জিনিয়ার এবং একই সাথে ১০+ বছরের অভিজ্ঞ ক্রিপ্টো ট্রেডার (Price Action, Market Structure, SMC, Fibonacci, Indicator confluence)।

## প্রজেক্ট কনটেক্সট
- বিদ্যমান প্রজেক্ট: ASP.NET Core MVC, .NET 9, নাম TradingChartAnalyzer (ডিফল্ট টেমপ্লেট, HomeController আছে)।
- ফ্রন্টএন্ড: Tailwind CSS (Tailwind standalone CLI দিয়ে build, CDN play script নয়), jQuery 3.7.1, TradingView Lightweight Charts (নির্দিষ্ট ভার্শন পিন করবে, যেমন lightweight-charts@4.2.3; series primitives API ব্যবহার করে কাস্টম ড্রয়িং)।
- মার্কেট ডেটা: Binance Spot public API — REST `https://api.binance.com/api/v3/klines` এবং WebSocket `wss://stream.binance.com:9443/ws/btcusdt@kline_<interval>`। সিম্বল ডিফল্ট BTCUSDT।
- AI মডেল: `muse-spark-1.3-contributor`। এটি একটি OpenAI-compatible Chat Completions endpoint দিয়ে কল হবে। BaseUrl, ApiKey, Model, Temperature, MaxTokens, TimeoutSeconds সব `appsettings.json`-এর `Ai` সেকশন থেকে Options pattern দিয়ে আসবে; ApiKey শুধু `dotnet user-secrets` বা environment variable-এ থাকবে, কখনো কোডে বা কমিটে নয়।

## অ্যাপ যা করবে
1. TradingView-এর মতো ডার্ক থিম চার্ট পেজ: ক্যান্ডেলস্টিক, ভলিউম হিস্টোগ্রাম, টাইমফ্রেম সিলেক্টর (1m, 5m, 15m, 1h, 4h, 1d), indicator টগল (EMA 20/50/200, RSI, MACD, Bollinger, VWAP), crosshair, OHLC লেজেন্ড, রিয়েলটাইম আপডেট।
2. "Analyze with AI" বাটন: সার্ভার মাল্টি-টাইমফ্রেম ক্যান্ডেল (যেমন 1d, 4h, 1h + বর্তমান টাইমফ্রেম) নেবে, C#-এ indicators, swing points, market structure (HH/HL/LH/LL, BOS, CHoCH), support/resistance, fibonacci লেভেল হিসাব করবে, একটি কম্প্যাক্ট MarketSnapshot বানিয়ে AI-কে পাঠাবে। AI একটি কঠোর JSON স্কিমায় analysis, setups ও drawings ফেরত দেবে।
3. AI-এর drawings চার্টে স্বয়ংক্রিয়ভাবে আঁকা হবে: trendline, horizontal level, fibonacci retracement/extension, supply/demand/FVG/order block zone, long/short position box (entry, SL, TP সহ), markers (BOS/CHoCH)। প্রতিটি ড্রয়িং টাইপ আলাদা primitive ক্লাস; সাইড প্যানেল থেকে show/hide ও clear করা যাবে।
4. সাইড প্যানেলে ট্রেডারের মতো রিপোর্ট: HTF/LTF trend, bias, confidence, key levels, প্রতিটি setup-এর entry/SL/TP/RR, confluences, invalidation। কোনো setup-এ ক্লিক করলে সেই setup-এর ড্রয়িং হাইলাইট হবে।

## বাধ্যতামূলক কোডিং নিয়ম
- Feature-first architecture: `Features/<FeatureName>/` এর ভেতরে Controller, Service, Models, Views। Razor view location কনফিগার করবে।
- কোডে কোনো কমেন্ট লিখবে না।
- কোনো টেস্ট কোড লিখবে না।
- Clean, maintainable, production-ready কোড; DRY মেনে চলবে; অপ্রয়োজনীয় abstraction বা premature optimization করবে না।
- Dependency Injection, Options pattern, `IHttpClientFactory` (typed clients), `CancellationToken` সব async মেথডে।
- Nullable enabled; `decimal` ব্যবহার করবে দাম/PnL-এর জন্য, indicator ক্যালকুলেশনে `double` চলবে।
- API endpoints `/api/...` রুটে `[ApiController]` দিয়ে; ভ্যালিডেশন এরর হলে ProblemDetails।
- Binance REST কলে retry + timeout (Microsoft.Extensions.Http.Resilience), এবং ক্যান্ডেল ডেটা `IMemoryCache`-এ শর্ট-টার্ম ক্যাশ।
- AI রেসপন্স: `response_format` JSON হিসেবে চাইবে; JSON পার্স ব্যর্থ হলে একবার রিপেয়ার-রিট্রাই; তারপর `AnalysisResultValidator` দিয়ে যাচাই করবে (long-এ SL < entry < TP, short-এ উল্টো; দাম বর্তমান রেঞ্জের যুক্তিসঙ্গত সীমায়; time ক্যান্ডেল রেঞ্জের মধ্যে; RR সার্ভারে পুনরায় হিসাব)। অবৈধ setup/drawing বাদ দেবে, পুরো রেসপন্স ফেলে দেবে না।
- ব্যাকটেস্টে look-ahead bias থাকবে না: সিগন্যাল শুধু ক্লোজড ক্যান্ডেলে, এন্ট্রি পরের ক্যান্ডেলের open-এ; একই ক্যান্ডেলে SL ও TP দুটোই হিট করলে কনজারভেটিভভাবে SL ধরবে।
- ফ্রন্টএন্ড: jQuery মডিউল প্যাটার্ন, ফিচার অনুযায়ী আলাদা JS ফাইল, কোনো inline script নয়। Tailwind দিয়ে TradingView-স্টাইল ডার্ক UI, রেসপন্সিভ, loading/error/empty state সহ।
- UI-তে স্পষ্ট disclaimer: "এটি আর্থিক পরামর্শ নয়।"

## AI System Prompt (AnalysisPromptBuilder-এ ব্যবহার করবে)
"You are a professional crypto trader with 10+ years of experience in price action, market structure, Smart Money Concepts, Fibonacci and indicator confluence. You receive a pre-computed market snapshot for BTCUSDT across multiple timeframes. Never invent numbers: only use prices and timestamps present in the snapshot. Analyze top-down (HTF → LTF), identify trend, structure, key levels, liquidity and confluence. Propose at most 3 high-quality setups with minimum 1:2 risk-reward; if no valid setup exists return an empty setups array and explain why. Produce drawings that a professional would put on the chart to justify the analysis. Respond ONLY with JSON matching the given schema."
— এর সাথে implementation-plan.md-এর সেকশন ২.৪-এর JSON স্কিমা এবং MarketSnapshot JSON user message হিসেবে যাবে।

## কাজের ধরন
আমি ফেজ অনুযায়ী নির্দেশ দেব। প্রতিটি ফেজে শুধু সেই ফেজের কাজ করবে, শেষে কোন ফাইল তৈরি/পরিবর্তন হলো তার সংক্ষিপ্ত তালিকা দেবে, এবং `dotnet build` সফল কিনা নিশ্চিত করবে। এখন শুধু কনটেক্সট বুঝে নাও এবং Phase 1-এর জন্য অপেক্ষা করো।
```

---

## ৪. ফেজ-ভিত্তিক প্রম্পট

### Phase 1 — প্রজেক্ট ফাউন্ডেশন

```text
Phase 1 করো:
1. Feature-first স্ট্রাকচার তৈরি করো; HomeController/Views/Home সরিয়ে Features/Chart-এ ChartController ও Index view বানাও, ডিফল্ট রুট Chart/Index।
2. Razor ViewLocationFormats-এ /Features/{1}/Views/{0}.cshtml এবং /Shared/Views/{0}.cshtml যোগ করো; _Layout, _ViewStart, _ViewImports সেই অনুযায়ী সরাও।
3. Tailwind standalone CLI সেটআপ: wwwroot/css/input.css, tailwind.config.js (content: Features/**/*.cshtml, Shared/**/*.cshtml, wwwroot/js/**/*.js), TradingView-এর মতো ডার্ক কালার টোকেন (bg #131722, panel #1e222d, border #2a2e39, text #d1d4dc, up #26a69a, down #ef5350)। csproj-এ build-এর আগে Tailwind চালানোর MSBuild target যোগ করো।
4. jQuery 3.7.1 ও lightweight-charts (পিন করা ভার্শন) _Layout-এ যোগ করো।
5. appsettings.json-এ "Binance" (RestBaseUrl, WsBaseUrl, DefaultSymbol) ও "Ai" (BaseUrl, Model = "muse-spark-1.3-contributor", Temperature = 0.2, MaxTokens, TimeoutSeconds) সেকশন; ApiKey user-secrets থেকে।
6. লেআউট: টপ বার (সিম্বল, টাইমফ্রেম বাটন, indicator ড্রপডাউন, "Analyze with AI"), মাঝে চার্ট, ডানে কলাপসিবল প্যানেল।
```

### Phase 2 — মার্কেট ডেটা ও চার্ট

```text
Phase 2 করো:
1. Features/MarketData: Candle record (OpenTime, Open, High, Low, Close, Volume, CloseTime), Timeframe enum ↔ Binance interval ম্যাপিং, typed HttpClient BinanceMarketDataClient (GetKlinesAsync with limit ≤ 1000), resilience handler, IMemoryCache।
2. GET /api/market/klines?symbol=BTCUSDT&interval=1h&limit=500 endpoint।
3. wwwroot/js/chart/chart-core.js: চার্ট তৈরি, candlestick + volume (আলাদা price scale), টাইমফ্রেম পরিবর্তনে রিলোড, OHLC লেজেন্ড crosshair-এ আপডেট, resize হ্যান্ডলিং।
4. wwwroot/js/chart/realtime-feed.js: Binance WebSocket kline stream, series.update(), টাইমফ্রেম পরিবর্তনে পুরনো সকেট বন্ধ, auto-reconnect with backoff।
5. ক্লায়েন্ট-সাইড indicator overlay (EMA 20/50/200, Bollinger, VWAP মূল প্যানে; RSI ও MACD আলাদা pane বা আলাদা ছোট চার্টে, টাইম স্কেল সিঙ্ক)।
```

### Phase 3 — Indicator ও Market Snapshot (সার্ভার)

```text
Phase 3 করো:
1. Features/Indicators-এ IndicatorCalculator: SMA, EMA, RSI(14, Wilder), MACD(12,26,9), ATR(14), Bollinger(20,2), VWAP (session ভিত্তিক)।
2. SwingDetector: lookback-ভিত্তিক pivot high/low, তারপর market structure লেবেল (HH, HL, LH, LL) এবং BOS/CHoCH ইভেন্ট (time, price, direction)।
3. SupportResistanceDetector: swing ক্লাস্টারিং (ATR-ভিত্তিক tolerance) করে লেভেল ও touch count/strength।
4. FibonacciCalculator: সর্বশেষ গুরুত্বপূর্ণ impulse swing থেকে retracement (0.236–0.786) ও extension (1.272, 1.618) লেভেল।
5. MarketSnapshot বিল্ডার: প্রতিটি টাইমফ্রেমের জন্য শেষ ~150 ক্যান্ডেলের কম্প্যাক্ট OHLCV, সর্বশেষ indicator মান, swings, structure events, S/R levels, fib levels, current price, ATR। টোকেন বাঁচাতে সংখ্যা যুক্তিসঙ্গত precision-এ রাউন্ড করবে।
```

### Phase 4 — AI Analysis

```text
Phase 4 করো:
1. Features/Analysis: AiOptions, IAiChatClient + AiChatClient (OpenAI-compatible /chat/completions, model = muse-spark-1.3-contributor, response_format json_object, timeout, cancellation)।
2. AnalysisPromptBuilder: Master Prompt-এর system prompt + JSON স্কিমা + MarketSnapshot।
3. AnalysisResult মডেল (System.Text.Json polymorphic Drawing টাইপ, "type" discriminator দিয়ে)।
4. AnalysisResultValidator: সেটআপ ও ড্রয়িং যাচাই, RR পুনঃহিসাব, অবৈধ আইটেম বাদ এবং warnings লিস্টে কারণ যোগ।
5. AnalysisService ও POST /api/analysis { symbol, timeframe } → AnalysisResult। একই symbol+timeframe+শেষ ক্যান্ডেলের জন্য রেজাল্ট কয়েক মিনিট ক্যাশ। রেট লিমিটিং (AddRateLimiter) যোগ করো।
6. AI ব্যর্থ হলে ব্যবহারকারী-বান্ধব ProblemDetails।
```

### Phase 5 — চার্টে AI ড্রয়িং

```text
Phase 5 করো:
1. wwwroot/js/drawings/primitives/: Lightweight Charts series primitive হিসেবে TrendlinePrimitive, HorizontalLinePrimitive (createPriceLine ব্যবহার করা যাবে), FibonacciPrimitive (লেভেল লাইন + শেডেড ব্যান্ড + ডানে লেবেল ও দাম), ZonePrimitive (supply/demand/FVG/OB আলাদা রঙ, ডানে extend), PositionBoxPrimitive (TradingView-এর long/short position টুলের মতো সবুজ TP ও লাল SL বক্স, RR লেবেল), এবং markers series.setMarkers দিয়ে।
2. drawing-renderer.js: AnalysisResult.drawings নিয়ে টাইপ অনুযায়ী primitive তৈরি, setupId দিয়ে গ্রুপ, showAll/hideAll/clear/highlight(setupId)। টাইমফ্রেম পরিবর্তনে ড্রয়িং রাখা হবে কিনা টগল।
3. analysis-panel.js: "Analyze with AI" ক্লিক → loading skeleton → রেজাল্ট রেন্ডার (trend ব্যাজ, bias, confidence বার, key levels, setup কার্ড — direction রঙে, entry/SL/TP/RR, confluences চিপ, invalidation), কার্ডে ক্লিক করলে highlight ও চার্ট সেই এলাকায় স্ক্রল, warnings দেখানো, disclaimer।
```

### Phase 7 — পলিশ ও প্রোডাকশন রেডিনেস

```text
Phase 7 করো:
1. গ্লোবাল এরর হ্যান্ডলিং (UseExceptionHandler + ProblemDetails), structured logging (AI latency, token usage, Binance এরর)।
2. Health check endpoint (/health) — Binance reachability।
3. ফ্রন্টএন্ডে keyboard shortcut (টাইমফ্রেম 1–6, A = Analyze, Esc = প্যানেল বন্ধ), টোস্ট নোটিফিকেশন, মোবাইলে প্যানেল bottom sheet।
4. সব কনফিগ মান appsettings-এ, কোনো হার্ডকোডেড URL/কী নয়।
5. পুরো কোডবেস রিভিউ করে duplicate কোড সরাও এবং README-তে রান করার ধাপ (user-secrets সেট, Tailwind build, dotnet run) লেখো।
```

---

## ৫. যাচাই চেকলিস্ট (প্রতিটি ফেজ শেষে)

- [ ] `dotnet build` কোনো warning/error ছাড়া সফল
- [ ] চার্ট লোড হয় এবং WebSocket দিয়ে শেষ ক্যান্ডেল লাইভ আপডেট হয়
- [ ] টাইমফ্রেম পরিবর্তনে ডেটা, indicator ও সকেট ঠিকভাবে বদলায়
- [ ] AI রেসপন্সের সব দাম/সময় snapshot-এর রেঞ্জের মধ্যে, অবৈধ setup বাদ পড়ে ও warning দেখায়
- [ ] Fibonacci লেভেল ম্যানুয়ালি হিসাব করে মিলিয়ে দেখা হয়েছে
- [ ] Position box-এর RR প্যানেলের RR-এর সাথে মেলে
- [ ] ব্যাকটেস্টে এন্ট্রি সবসময় সিগন্যাল ক্যান্ডেলের পরের open-এ
- [ ] ApiKey কোথাও কমিট হয়নি
- [ ] UI-তে disclaimer দেখা যায়

---

## ৬. ঝুঁকি ও সতর্কতা

| ঝুঁকি | সমাধান |
|---|---|
| AI ভুল দাম বা সময় দিতে পারে | সব সংখ্যা snapshot থেকে নেওয়ার নির্দেশ + সার্ভার ভ্যালিডেটর |
| `muse-spark-1.3-contributor` মডেলের endpoint/JSON mode সাপোর্ট নিশ্চিত নয় | `IAiChatClient` interface-এর পেছনে রাখা হয়েছে; প্রোভাইডারের ডকুমেন্টেশন দেখে BaseUrl ও request ফরম্যাট মিলিয়ে নিন; JSON mode না থাকলে প্রম্পটে JSON-only নির্দেশ + পার্স-রিট্রাই যথেষ্ট |
| Binance রেট লিমিট / কিছু দেশে `api.binance.com` ব্লক | ক্যাশ, retry, এবং `RestBaseUrl` কনফিগারযোগ্য (প্রয়োজনে `data-api.binance.vision`) |
| Overfitting ব্যাকটেস্ট | ফি ও স্লিপেজ বাধ্যতামূলক, আলাদা তারিখ রেঞ্জে যাচাই করার পরামর্শ UI-তে |
| আর্থিক ঝুঁকি | অ্যাপ শুধু অ্যানালাইসিস টুল; কোনো অটো-ট্রেডিং নেই; disclaimer |
