(function ($, App) {
    const ZOOM_IN = 0.8;
    const ZOOM_OUT = 1.25;
    const PAN_STEP = 0.1;
    const PAN_STEP_FAST = 0.5;

    let priceMode = 'normal';

    function syncButtons() {
        $('#ctl-auto').toggleClass('is-active', App.chartCore.isAutoScale());
        $('#ctl-log').toggleClass('is-active', priceMode === 'log');
        $('#ctl-percent').toggleClass('is-active', priceMode === 'percent');
    }

    function setPriceMode(mode) {
        priceMode = priceMode === mode ? 'normal' : mode;
        App.chartCore.setPriceMode(priceMode);
        syncButtons();
    }

    function reset() {
        priceMode = 'normal';
        App.chartCore.setPriceMode('normal');
        App.chartCore.setAutoScale(true);
        App.chartCore.fit();
        App.chartCore.scrollToLatest();
        syncButtons();
    }

    function screenshot() {
        const canvas = App.chartCore.screenshot();
        canvas.toBlob(function (blob) {
            if (!blob) return App.toast.show('Could not capture the chart.', 'error');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = App.state.symbol + '-' + App.state.timeframe + '-' + stamp + '.png';
            link.click();
            setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
            App.toast.show('Screenshot saved.', 'success');
        }, 'image/png');
    }

    App.chartControls = {
        init: function () {
            $('#ctl-fit').on('click', App.chartCore.fit);
            $('#ctl-latest').on('click', App.chartCore.scrollToLatest);
            $('#ctl-reset').on('click', reset);
            $('#ctl-auto').on('click', function () {
                App.chartCore.setAutoScale(!App.chartCore.isAutoScale());
                syncButtons();
            });
            $('#ctl-log').on('click', function () { setPriceMode('log'); });
            $('#ctl-percent').on('click', function () { setPriceMode('percent'); });
            $('#ctl-screenshot').on('click', screenshot);
            $('#ctl-zoom-in').on('click', function () { App.chartCore.zoom(ZOOM_IN); });
            $('#ctl-zoom-out').on('click', function () { App.chartCore.zoom(ZOOM_OUT); });

            $('#chart-main').on('mouseup wheel dblclick', function () {
                setTimeout(syncButtons, 0);
            });
            syncButtons();
        },

        handleKey: function (event) {
            const fast = event.shiftKey;
            switch (event.key) {
                case '+':
                case '=':
                    App.chartCore.zoom(ZOOM_IN);
                    return true;
                case '-':
                case '_':
                    App.chartCore.zoom(ZOOM_OUT);
                    return true;
                case 'ArrowLeft':
                    App.chartCore.pan(fast ? -PAN_STEP_FAST : -PAN_STEP);
                    return true;
                case 'ArrowRight':
                    App.chartCore.pan(fast ? PAN_STEP_FAST : PAN_STEP);
                    return true;
                case 'ArrowUp':
                    App.chartCore.zoom(ZOOM_IN);
                    return true;
                case 'ArrowDown':
                    App.chartCore.zoom(ZOOM_OUT);
                    return true;
                case 'End':
                    App.chartCore.scrollToLatest();
                    return true;
                case 'Home':
                    App.chartCore.fit();
                    return true;
                default:
                    return false;
            }
        }
    };
})(jQuery, window.App);
