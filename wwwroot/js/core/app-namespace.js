window.App = window.App || {};

(function (App) {
    const root = document.getElementById('app');

    App.timeframeSeconds = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '1h': 3600,
        '4h': 14400,
        '1d': 86400
    };

    App.state = {
        symbol: root.dataset.symbol,
        wsBaseUrl: root.dataset.wsBaseUrl,
        timeframe: '1h',
        candles: [],
        indicators: new Set(),
        analysis: null
    };

    App.timeframeStep = function () {
        return App.timeframeSeconds[App.state.timeframe];
    };
})(window.App);
