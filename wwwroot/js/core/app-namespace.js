window.App = window.App || {};

(function (App) {
    const root = document.getElementById('app');

    App.timeframeSeconds = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '4h': 14400,
        '1d': 86400,
        '1w': 604800,
        '1M': 2592000
    };

    App.state = {
        symbol: root.dataset.symbol,
        wsBaseUrl: root.dataset.wsBaseUrl,
        pollSeconds: Number(root.dataset.pollSeconds),
        timeframe: '1M',
        candles: [],
        indicators: new Set(),
        analysis: null
    };

    App.isCryptoSymbol = function (symbol) {
        return symbol.length > 4 && symbol.endsWith('USDT');
    };

    App.timeframeStep = function () {
        return App.timeframeSeconds[App.state.timeframe];
    };
})(window.App);
