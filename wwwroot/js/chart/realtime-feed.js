(function (App) {
    const maxDelay = 30000;
    let socket = null;
    let token = 0;
    let attempt = 0;
    let timer = null;

    function open(id, symbol, interval) {
        const url = App.state.wsBaseUrl + '/' + symbol.toLowerCase() + '@kline_' + interval;
        socket = new WebSocket(url);

        socket.onopen = function () {
            attempt = 0;
        };

        socket.onmessage = function (event) {
            if (id !== token) return;
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
            App.api.get('/api/market/klines', { symbol: symbol, interval: interval, limit: 2 })
                .done(function (rows) {
                    if (id !== token) return;
                    rows.map(App.chartCore.toCandle).forEach(App.chartCore.applyRealtime);
                })
                .always(function () {
                    if (id === token) poll(id, symbol, interval);
                });
        }, App.state.pollSeconds * 1000);
    }

    App.realtimeFeed = {
        connect: function (symbol, interval) {
            App.realtimeFeed.disconnect();
            attempt = 0;
            if (App.isCryptoSymbol(symbol)) open(token, symbol, interval);
            else poll(token, symbol, interval);
        },
        disconnect: function () {
            token++;
            clearTimeout(timer);
            if (socket) {
                socket.onclose = null;
                socket.onmessage = null;
                socket.close();
                socket = null;
            }
        }
    };
})(window.App);
