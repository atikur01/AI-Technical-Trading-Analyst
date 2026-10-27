(function ($, App) {
    const ZOOM_IN = 0.8;
    const ZOOM_OUT = 1.25;
    const PAN_STEP = 0.1;
    const PAN_STEP_FAST = 0.5;

    function reset() {
        App.chartCore.setPriceMode('normal');
        App.chartCore.setAutoScale(true);
        App.chartCore.fit();
        App.chartCore.scrollToLatest();
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

    function toggleAuto() {
        App.chartCore.setAutoScale(!App.chartCore.isAutoScale());
    }

    App.chartControls = {
        reset: reset,
        screenshot: screenshot,
        toggleAuto: toggleAuto,

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
