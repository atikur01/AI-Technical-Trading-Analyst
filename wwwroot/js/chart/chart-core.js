(function ($, App) {
    const theme = {
        background: '#131722',
        text: '#d1d4dc',
        grid: '#1f2330',
        border: '#2a2e39',
        up: '#26a69a',
        down: '#ef5350'
    };

    const overlayStyles = {
        ema20: { color: '#f7a600', title: 'EMA 20' },
        ema50: { color: '#2962ff', title: 'EMA 50' },
        ema200: { color: '#ab47bc', title: 'EMA 200' },
        vwap: { color: '#00bcd4', title: 'VWAP' }
    };

    const emaPeriods = { ema20: 20, ema50: 50, ema200: 200 };

    let chart = null;
    let candleSeries = null;
    let futureSeries = null;
    let overlaySeries = {};
    let rsiPane = null;
    let macdPane = null;
    let smcPrimitive = null;
    const MIN_PRICE_ZOOM = 0.05;
    const MAX_PRICE_ZOOM = 20;

    let loadToken = 0;
    let priceShift = 0;
    let priceZoom = 1;
    let syncing = false;
    const markerSources = {};

    function baseOptions() {
        return {
            autoSize: true,
            layout: { background: { type: 'solid', color: theme.background }, textColor: theme.text, fontSize: 12, attributionLogo: false },
            grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
            rightPriceScale: { borderColor: theme.border },
            timeScale: { borderColor: theme.border, timeVisible: true, secondsVisible: false, rightOffset: 12 }
        };
    }

    function toCandle(row) {
        return {
            time: row.time,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.volume)
        };
    }

    function renderLegend(candle) {
        if (!candle) {
            $('#chart-legend').empty();
            return;
        }
        const change = candle.close - candle.open;
        const percent = candle.open ? (change / candle.open) * 100 : 0;
        const cls = App.format.signClass(change);
        const item = function (label, value) {
            return '<span>' + label + ' <span class="' + cls + '">' + App.format.price(value) + '</span></span>';
        };
        $('#chart-legend').html(
            item('O', candle.open) + item('H', candle.high) + item('L', candle.low) + item('C', candle.close) +
            '<span class="' + cls + '">' + App.format.signed(change, 2) + ' (' + App.format.signed(percent, 2) + '%)</span>' +
            '<span>Vol <span class="text-tv-text">' + App.format.number(candle.volume, 2) + '</span></span>'
        );
    }

    function updateLastPrice() {
        const candles = App.state.candles;
        if (!candles.length) return;
        const last = candles[candles.length - 1];
        const first = candles[Math.max(0, candles.length - 2)];
        $('#last-price')
            .text(App.format.price(last.close))
            .removeClass('text-tv-up text-tv-down text-tv-muted')
            .addClass(last.close >= first.close ? 'text-tv-up' : 'text-tv-down');
    }

    function syncRange(source, targets) {
        source.timeScale().subscribeVisibleLogicalRangeChange(function (range) {
            if (syncing || !range) return;
            syncing = true;
            targets().forEach(function (target) {
                target.timeScale().setVisibleLogicalRange(range);
            });
            syncing = false;
        });
    }

    function createPane(containerId) {
        const paneChart = LightweightCharts.createChart(document.getElementById(containerId), baseOptions());
        paneChart.timeScale().applyOptions({ visible: false });
        return paneChart;
    }

    function allCharts() {
        return [chart, rsiPane && rsiPane.chart, macdPane && macdPane.chart].filter(Boolean);
    }

    function wireSync(paneChart) {
        syncRange(paneChart, function () {
            return allCharts().filter(function (c) { return c !== paneChart; });
        });
        const range = chart.timeScale().getVisibleLogicalRange();
        if (range) paneChart.timeScale().setVisibleLogicalRange(range);
    }

    function ensureRsi() {
        if (rsiPane) return rsiPane;
        const paneChart = createPane('chart-rsi');
        const series = paneChart.addLineSeries({ color: '#ab47bc', lineWidth: 1, priceLineVisible: false, title: 'RSI' });
        series.createPriceLine({ price: 70, color: '#787b86', lineStyle: 2, lineWidth: 1, axisLabelVisible: false });
        series.createPriceLine({ price: 30, color: '#787b86', lineStyle: 2, lineWidth: 1, axisLabelVisible: false });
        rsiPane = { chart: paneChart, series: series };
        wireSync(paneChart);
        return rsiPane;
    }

    function ensureMacd() {
        if (macdPane) return macdPane;
        const paneChart = createPane('chart-macd');
        macdPane = {
            chart: paneChart,
            histogram: paneChart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false }),
            line: paneChart.addLineSeries({ color: '#2962ff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'MACD' }),
            signal: paneChart.addLineSeries({ color: '#f7a600', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: 'Signal' })
        };
        wireSync(paneChart);
        return macdPane;
    }

    function getOverlay(key, factory) {
        if (!overlaySeries[key]) overlaySeries[key] = factory();
        return overlaySeries[key];
    }

    function lineSeries(color, title, style) {
        return chart.addLineSeries({
            color: color,
            lineWidth: 1,
            lineStyle: style || 0,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            title: title || ''
        });
    }

    function removeOverlay(key) {
        if (overlaySeries[key]) {
            chart.removeSeries(overlaySeries[key]);
            delete overlaySeries[key];
        }
    }

    function removeSmc() {
        if (!smcPrimitive) return;
        candleSeries.detachPrimitive(smcPrimitive);
        smcPrimitive = null;
    }

    function applyIndicator(key) {
        const candles = App.state.candles;
        const enabled = App.state.indicators.has(key);

        if (key in emaPeriods) {
            if (!enabled) return removeOverlay(key);
            const style = overlayStyles[key];
            getOverlay(key, function () { return lineSeries(style.color, style.title); })
                .setData(App.indicators.ema(candles, emaPeriods[key]));
        } else if (key === 'vwap') {
            if (!enabled) return removeOverlay(key);
            getOverlay(key, function () { return lineSeries(overlayStyles.vwap.color, overlayStyles.vwap.title); })
                .setData(App.indicators.vwap(candles));
        } else if (key === 'smc') {
            if (!enabled) return removeSmc();
            if (!smcPrimitive) {
                smcPrimitive = new App.SmcPrimitive();
                candleSeries.attachPrimitive(smcPrimitive);
            }
            smcPrimitive.setResult(App.smc.compute(candles));
        } else if (key === 'bollinger') {
            if (!enabled) {
                removeOverlay('bbUpper');
                removeOverlay('bbMiddle');
                removeOverlay('bbLower');
                return;
            }
            const bands = App.indicators.bollinger(candles, 20, 2);
            getOverlay('bbUpper', function () { return lineSeries('#5d6b98', 'BB'); }).setData(bands.upper);
            getOverlay('bbMiddle', function () { return lineSeries('#f7a600', '', 2); }).setData(bands.middle);
            getOverlay('bbLower', function () { return lineSeries('#5d6b98', ''); }).setData(bands.lower);
        } else if (key === 'rsi') {
            $('#pane-rsi').toggleClass('hidden', !enabled);
            if (enabled) ensureRsi().series.setData(App.indicators.rsi(candles, 14));
        } else if (key === 'macd') {
            $('#pane-macd').toggleClass('hidden', !enabled);
            if (enabled) {
                const pane = ensureMacd();
                const macd = App.indicators.macd(candles, 12, 26, 9);
                pane.histogram.setData(macd.histogram);
                pane.line.setData(macd.line);
                pane.signal.setData(macd.signal);
            }
        }
    }

    function refreshIndicators() {
        ['smc', 'ema20', 'ema50', 'ema200', 'vwap', 'bollinger', 'rsi', 'macd'].forEach(applyIndicator);
    }

    function showError(message) {
        $('#chart-loading').addClass('hidden');
        $('#chart-error-text').text(message);
        $('#chart-error').removeClass('hidden').addClass('flex');
    }

    function timeToLogical(time) {
        const candles = App.state.candles;
        if (!candles.length) return null;
        const step = App.timeframeStep();
        const lastIndex = candles.length - 1;
        if (time >= candles[lastIndex].time) return lastIndex + (time - candles[lastIndex].time) / step;
        if (time <= candles[0].time) return (time - candles[0].time) / step;
        let low = 0;
        let high = lastIndex;
        while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (candles[mid].time <= time) low = mid;
            else high = mid - 1;
        }
        return low + (time - candles[low].time) / step;
    }

    const INITIAL_VISIBLE_BARS = 120;
    const RIGHT_OFFSET_BARS = 12;
    const FUTURE_BARS = 500;

    function refreshFutureTimes() {
        const candles = App.state.candles;
        if (!candles.length) return;
        const step = App.timeframeStep();
        const lastTime = candles[candles.length - 1].time;
        const future = [];
        for (let i = 1; i <= FUTURE_BARS; i++) future.push({ time: lastTime + i * step });
        futureSeries.setData(future);
    }

    function showLatest(count) {
        chart.timeScale().setVisibleLogicalRange({ from: count - INITIAL_VISIBLE_BARS, to: count - 1 + RIGHT_OFFSET_BARS });
    }

    function refreshMarkers() {
        const merged = [];
        Object.keys(markerSources).forEach(function (source) {
            markerSources[source].forEach(function (marker) { merged.push(marker); });
        });
        merged.sort(function (a, b) { return a.time - b.time; });
        candleSeries.setMarkers(merged);
    }

    App.chartCore = {
        init: function () {
            chart = LightweightCharts.createChart(document.getElementById('chart-main'), baseOptions());
            candleSeries = chart.addCandlestickSeries({
                upColor: theme.up,
                downColor: theme.down,
                borderUpColor: theme.up,
                borderDownColor: theme.down,
                wickUpColor: theme.up,
                wickDownColor: theme.down,
                autoscaleInfoProvider: function (baseImpl) {
                    const info = baseImpl();
                    if (!info || (!priceShift && priceZoom === 1)) return info;
                    const center = (info.priceRange.minValue + info.priceRange.maxValue) / 2 + priceShift;
                    const half = ((info.priceRange.maxValue - info.priceRange.minValue) / 2) * priceZoom;
                    return {
                        priceRange: { minValue: center - half, maxValue: center + half },
                        margins: info.margins
                    };
                }
            });

            futureSeries = chart.addLineSeries({
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false
            });

            chart.subscribeCrosshairMove(function (param) {
                const bar = param.seriesData && param.seriesData.get(candleSeries);
                if (bar) {
                    const candle = App.state.candles.find(function (c) { return c.time === param.time; });
                    renderLegend({ open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: candle ? candle.volume : 0 });
                } else {
                    renderLegend(App.state.candles[App.state.candles.length - 1]);
                }
            });

            syncRange(chart, function () {
                return allCharts().filter(function (c) { return c !== chart; });
            });
        },

        load: function () {
            const token = ++loadToken;
            $('#chart-error').addClass('hidden').removeClass('flex');
            $('#chart-loading').removeClass('hidden');

            return App.api.get('/api/market/klines', { symbol: App.state.symbol, interval: App.state.timeframe, limit: 500 })
                .done(function (rows) {
                    if (token !== loadToken) return;
                    const candles = rows.map(toCandle);
                    App.state.candles = candles;
                    candleSeries.setData(candles);
                    refreshFutureTimes();
                    refreshIndicators();
                    refreshMarkers();
                    showLatest(candles.length);
                    renderLegend(candles[candles.length - 1]);
                    updateLastPrice();
                    $('#chart-loading').addClass('hidden');
                    App.realtimeFeed.connect(App.state.symbol, App.state.timeframe);
                    $(document).trigger('chart:loaded');
                })
                .fail(function (error) {
                    if (token !== loadToken) return;
                    showError(error.message);
                });
        },

        applyRealtime: function (candle) {
            const candles = App.state.candles;
            const last = candles[candles.length - 1];
            if (!last || candle.time < last.time) return;
            if (candle.time === last.time) candles[candles.length - 1] = candle;
            else candles.push(candle);
            candleSeries.update(candle);
            if (candle.time !== last.time) refreshFutureTimes();
            refreshIndicators();
            updateLastPrice();
        },

        setIndicator: function (key, enabled) {
            if (enabled) App.state.indicators.add(key);
            else App.state.indicators.delete(key);
            applyIndicator(key);
            if (key === 'smc' || key === 'bollinger' || key in emaPeriods || key === 'vwap') return;
            const range = chart.timeScale().getVisibleLogicalRange();
            if (range) {
                allCharts().forEach(function (c) { c.timeScale().setVisibleLogicalRange(range); });
            }
        },

        setMarkers: function (source, markers) {
            markerSources[source] = markers;
            if (candleSeries) refreshMarkers();
        },

        clearMarkers: function (source) {
            App.chartCore.setMarkers(source, []);
        },

        timeToX: function (time) {
            const logical = timeToLogical(time);
            return logical == null ? null : chart.timeScale().logicalToCoordinate(logical);
        },

        priceToY: function (price) {
            return candleSeries.priceToCoordinate(price);
        },

        focusTime: function (time, barsBefore, barsAfter) {
            const logical = timeToLogical(time);
            if (logical == null) return;
            chart.timeScale().setVisibleLogicalRange({ from: logical - barsBefore, to: logical + barsAfter });
        },

        hasTime: function (time) {
            const candles = App.state.candles;
            return candles.length > 0 && time >= candles[0].time && time <= candles[candles.length - 1].time;
        },

        attachPrimitive: function (primitive) {
            candleSeries.attachPrimitive(primitive);
        },

        detachPrimitive: function (primitive) {
            candleSeries.detachPrimitive(primitive);
        },

        container: function () {
            return document.getElementById('chart-main');
        },

        plotWidth: function () {
            return chart.timeScale().width();
        },

        plotHeight: function () {
            return document.getElementById('chart-main').clientHeight - chart.timeScale().height();
        },

        pointToChart: function (x, y) {
            const logical = chart.timeScale().coordinateToLogical(x);
            const price = candleSeries.coordinateToPrice(y);
            const candles = App.state.candles;
            if (logical == null || price == null || !candles.length) return null;

            const step = App.timeframeStep();
            const index = Math.round(logical);
            const lastIndex = candles.length - 1;
            let time;
            if (index < 0) time = candles[0].time + index * step;
            else if (index > lastIndex) time = candles[lastIndex].time + (index - lastIndex) * step;
            else time = candles[index].time;

            return { time: time, price: price, logical: logical };
        },

        setInteractive: function (enabled) {
            chart.applyOptions({ handleScroll: enabled, handleScale: enabled });
        },

        fit: function () {
            chart.timeScale().fitContent();
        },

        showFutureBars: function (count) {
            const range = chart.timeScale().getVisibleLogicalRange();
            if (!range) return;
            const needed = App.state.candles.length - 1 + count + 2;
            if (range.to < needed) chart.timeScale().setVisibleLogicalRange({ from: range.from, to: needed });
        },

        scrollToLatest: function () {
            chart.timeScale().scrollToRealTime();
        },

        zoom: function (factor) {
            const range = chart.timeScale().getVisibleLogicalRange();
            if (!range) return;
            const center = (range.from + range.to) / 2;
            const half = ((range.to - range.from) / 2) * factor;
            chart.timeScale().setVisibleLogicalRange({ from: center - half, to: center + half });
        },

        pan: function (fraction) {
            const range = chart.timeScale().getVisibleLogicalRange();
            if (!range) return;
            const shift = (range.to - range.from) * fraction;
            chart.timeScale().setVisibleLogicalRange({ from: range.from + shift, to: range.to + shift });
        },

        setPriceMode: function (mode) {
            const modes = LightweightCharts.PriceScaleMode;
            priceShift = 0;
            priceZoom = 1;
            chart.priceScale('right').applyOptions({
                mode: mode === 'log' ? modes.Logarithmic : mode === 'percent' ? modes.Percentage : modes.Normal
            });
        },

        setAutoScale: function (enabled) {
            priceShift = 0;
            priceZoom = 1;
            chart.priceScale('right').applyOptions({ autoScale: enabled });
        },

        zoomPrice: function (factor) {
            const scale = chart.priceScale('right');
            if (scale.options().mode !== LightweightCharts.PriceScaleMode.Normal) return;
            priceZoom = Math.min(MAX_PRICE_ZOOM, Math.max(MIN_PRICE_ZOOM, priceZoom * factor));
            scale.applyOptions({ autoScale: true });
        },

        isOverPriceScale: function (x, y) {
            return x > chart.timeScale().width() && y <= this.plotHeight();
        },

        panPrice: function (deltaY) {
            const scale = chart.priceScale('right');
            if (!deltaY || !scale.options().autoScale || scale.options().mode !== LightweightCharts.PriceScaleMode.Normal) return;
            const top = candleSeries.coordinateToPrice(0);
            const moved = candleSeries.coordinateToPrice(deltaY);
            if (top == null || moved == null) return;
            priceShift += top - moved;
            scale.applyOptions({ autoScale: true });
        },

        isAutoScale: function () {
            return chart.priceScale('right').options().autoScale;
        },

        screenshot: function () {
            return chart.takeScreenshot();
        },

        chart: function () {
            return chart;
        }
    };
})(jQuery, window.App);
