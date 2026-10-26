(function ($, App) {
    const desktop = window.matchMedia('(min-width: 768px)');

    function isOpen() {
        return desktop.matches ? !$('#side-panel').hasClass('md:hidden') : !$('#side-panel').hasClass('translate-y-full');
    }

    function setOpen(open) {
        const $panel = $('#side-panel');
        if (desktop.matches) $panel.toggleClass('md:hidden', !open);
        else $panel.toggleClass('translate-y-full', !open);
    }

    App.panel = {
        open: function () {
            setOpen(true);
        },
        close: function () {
            setOpen(false);
        },
        toggle: function () {
            setOpen(!isOpen());
        }
    };

    function setTimeframe(timeframe) {
        if (!App.timeframeSeconds[timeframe] || timeframe === App.state.timeframe) return;
        App.state.timeframe = timeframe;
        $('[data-timeframe]').removeClass('is-active').filter('[data-timeframe="' + timeframe + '"]').addClass('is-active');
        if (!$('#keep-drawings').is(':checked')) App.drawingRenderer.clear();
        App.chartCore.load();
        $(document).trigger('timeframe:changed');
    }

    function bindKeyboard() {
        const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];
        const toolKeys = { v: 'cursor', p: 'pan', t: 'trendline', h: 'horizontal', f: 'fibonacci', r: 'rect', m: 'measure' };
        $(document).on('keydown', function (event) {
            if ($(event.target).is('input, select, textarea')) return;

            if (event.ctrlKey || event.metaKey) {
                if (!event.altKey && App.drawingTools.handleShortcut(event)) event.preventDefault();
                return;
            }
            if (event.altKey) return;

            if (App.chartControls.handleKey(event)) {
                event.preventDefault();
                return;
            }

            const key = event.key.toLowerCase();
            if (key >= '1' && key <= '8') setTimeframe(timeframes[Number(key) - 1]);
            else if (key === '/') {
                event.preventDefault();
                App.symbolSearch.open();
            } else if (key === 'a') App.analysisPanel.run();
            else if (toolKeys[key]) App.drawingTools.setTool(toolKeys[key]);
            else if (key === 'delete' || key === 'backspace') App.drawingTools.deleteSelected();
            else if (key === 'escape' && !App.drawingTools.cancel()) App.panel.close();
        });
    }

    function bindToolbar() {
        $('[data-timeframe]').on('click', function () {
            setTimeframe($(this).data('timeframe'));
        });

        $('#indicator-toggle').on('click', function (event) {
            event.stopPropagation();
            $('#indicator-menu').toggleClass('is-open');
        });
        $('#indicator-menu').on('click', function (event) { event.stopPropagation(); });
        $(document).on('click', function () { $('#indicator-menu').removeClass('is-open'); });

        $('.indicator-check').on('change', function () {
            App.chartCore.setIndicator($(this).val(), $(this).is(':checked'));
        });

        $('#panel-toggle').on('click', App.panel.toggle);
        $('#panel-close').on('click', App.panel.close);
        $('#chart-retry').on('click', function () { App.chartCore.load(); });
    }

    $(function () {
        $('.indicator-check').each(function () {
            if ($(this).is(':checked')) App.state.indicators.add($(this).val());
        });

        App.chartCore.init();
        App.chartControls.init();
        App.drawingTools.init();
        App.chartGestures.init();
        App.symbolSearch.init();
        App.analysisPanel.init();
        bindToolbar();
        bindKeyboard();

        $('[data-timeframe="' + App.state.timeframe + '"]').addClass('is-active');
        App.chartCore.load();
    });
})(jQuery, window.App);
