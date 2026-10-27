(function ($, App) {
    const MAX_RESULTS = 50;

    let symbols = [];
    let loaded = null;
    let assetFilter = 'all';

    function esc(text) {
        return $('<div>').text(text).html();
    }

    function display(item) {
        if (item.assetClass === 'crypto') {
            return esc(item.symbol.replace(/USDT$/, '')) + '<span class="text-tv-muted">/USDT</span>';
        }
        return esc(item.symbol);
    }

    function render() {
        const query = $('#symbol-search').val().trim().toUpperCase();
        const matches = symbols.filter(function (s) {
            return (assetFilter === 'all' || s.assetClass === assetFilter) && s.symbol.indexOf(query) !== -1;
        });
        matches.sort(function (a, b) {
            return Number(b.symbol.indexOf(query) === 0) - Number(a.symbol.indexOf(query) === 0);
        });

        const html = matches.slice(0, MAX_RESULTS).map(function (item, index) {
            const active = item.symbol === App.state.symbol ? ' text-tv-accent' : '';
            return '<li role="option" data-symbol="' + esc(item.symbol) + '" class="symbol-item flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-tv-border' +
                (index === 0 ? ' bg-tv-border' : '') + active + '"><span>' + display(item) + '</span><span class="text-xs text-tv-muted">' +
                esc(item.assetClass) + '</span></li>';
        }).join('');

        $('#symbol-list').html(html || '<li class="px-2 py-1.5 text-sm text-tv-muted">No matching symbol.</li>');
    }

    function loadSymbols() {
        if (!loaded) {
            loaded = App.api.get('/api/market/symbols')
                .done(function (list) { symbols = list; })
                .fail(function (error) {
                    loaded = null;
                    App.toast.show(error.message, 'error');
                });
        }
        return loaded;
    }

    function close() {
        $('#symbol-menu').removeClass('is-open');
    }

    function select(symbol) {
        close();
        if (!symbol || symbol === App.state.symbol) return;

        App.state.symbol = symbol;
        App.state.candles = [];
        $('#symbol-label').text(symbol);
        $('#last-price').text('--');
        document.title = symbol;

        App.drawingRenderer.clear();
        App.manualDrawings.load();
        App.analysisPanel.reset();
        App.chartCore.load();
        $(document).trigger('symbol:changed');
    }

    function moveHighlight(step) {
        const $items = $('#symbol-list .symbol-item');
        if (!$items.length) return;
        const current = $items.index($items.filter('.bg-tv-border'));
        const next = (current + step + $items.length) % $items.length;
        $items.removeClass('bg-tv-border').eq(next).addClass('bg-tv-border')[0].scrollIntoView({ block: 'nearest' });
    }

    App.symbolSearch = {
        open: function () {
            $('#symbol-menu').addClass('is-open');
            $('#symbol-search').val('').trigger('focus');
            render();
            loadSymbols().done(render);
        },

        init: function () {
            $('#symbol-toggle').on('click', function (event) {
                event.stopPropagation();
                if ($('#symbol-menu').hasClass('is-open')) close();
                else App.symbolSearch.open();
            });

            $('#symbol-menu').on('click', function (event) { event.stopPropagation(); });
            $(document).on('click', close);

            $('#symbol-tabs').on('click', '.tab', function () {
                assetFilter = $(this).data('asset');
                $('#symbol-tabs .tab').removeClass('is-active');
                $(this).addClass('is-active');
                render();
                $('#symbol-search').trigger('focus');
            });

            $('#symbol-search').on('input', render).on('keydown', function (event) {
                if (event.key === 'ArrowDown') moveHighlight(1);
                else if (event.key === 'ArrowUp') moveHighlight(-1);
                else if (event.key === 'Enter') select($('#symbol-list .symbol-item.bg-tv-border').data('symbol'));
                else if (event.key === 'Escape') close();
                else return;
                event.preventDefault();
            });

            $('#symbol-list').on('click', '.symbol-item', function () {
                select($(this).data('symbol'));
            });
        }
    };
})(jQuery, window.App);
