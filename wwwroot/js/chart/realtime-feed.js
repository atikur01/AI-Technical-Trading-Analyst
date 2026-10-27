(function ($, App) {
    const maxDelay = 30000;
    const staleAfter = 30000;
    const maxBackfillBars = 1000;
    let socket = null;
    let token = 0;
    let attempt = 0;
    let timer = null;
    let watchdog = null;
    let lastMessageAt = 0;
    let reconnecting = false;

    function backfill(id, symbol, interval) {
        const candles = App.state.candles;
        if (!candles.length) return $.Deferred().resolve().promise();
        const last = candles[candles.length - 1];
        const missing = Math.ceil((Date.now() / 1000 - last.time) / App.timeframeSeconds[interval]) + 1;
        const limit = Math.min(maxBackfillBars, Math.max(2, missing));
        return App.api.get('/api/market/klines', { symbol: symbol, interval: interval, limit: limit })
            .done(function (rows) {
                if (id !== token) return;
                rows.map(App.chartCore.toCandle).forEach(function (candle) {
                    App.chartCore.applyRealtime(candle);
                });
            });
    }

    function startWatchdog() {
        stopWatchdog();
        lastMessageAt = Date.now();
        watchdog = setInterval(function () {
            if (socket && Date.now() - lastMessageAt > staleAfter) socket.close();
        }, staleAfter / 2);
    }

    function stopWatchdog() {
        clearInterval(watchdog);
        watchdog = null;
    }

    function open(id, symbol, interval) {
        const url = App.state.wsBaseUrl + '/' + symbol.toLowerCase() + '@kline_' + interval;
        socket = new WebSocket(url);

        socket.onopen = function () {
            attempt = 0;
            startWatchdog();
            if (reconnecting) {
                reconnecting = false;
                backfill(id, symbol, interval);
            }
        };

        socket.onmessage = function (event) {
            if (id !== token) return;
            lastMessageAt = Date.now();
            const k = JSON.parse(event.data).k;
            if (!k) return;
            App.chartCore.applyRealtime({
                time: Math.floor(k.t / 1000),
                open: Number(k.o),
                high: Number(k.h),
                low: Number(k.l),
                close: Number(k.c),
                volume: Number(k.v)
            });
        };

        socket.onclose = function () {
            if (id !== token) return;
            stopWatchdog();
            reconnecting = true;
            const delay = Math.min(maxDelay, 1000 * Math.pow(2, attempt++));
            timer = setTimeout(function () {
                if (id === token) open(id, symbol, interval);
            }, delay);
        };

        socket.onerror = function () {
            socket.close();
        };
    }

    function poll(id, symbol, interval) {
        timer = setTimeout(function () {
            backfill(id, symbol, interval).always(function () {
                if (id === token) poll(id, symbol, interval);
            });
        }, App.state.pollSeconds * 1000);
    }

    App.realtimeFeed = {
        connect: function (symbol, interval) {
            App.realtimeFeed.disconnect();
            attempt = 0;
            reconnecting = false;
            if (App.isCryptoSymbol(symbol)) open(token, symbol, interval);
            else poll(token, symbol, interval);
        },
        disconnect: function () {
            token++;
            clearTimeout(timer);
            stopWatchdog();
            if (socket) {
                socket.onclose = null;
                socket.onmessage = null;
                socket.close();
                socket = null;
            }
        }
    };
})(jQuery, window.App);
