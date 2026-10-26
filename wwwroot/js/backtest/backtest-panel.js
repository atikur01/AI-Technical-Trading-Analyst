(function ($, App) {
    const esc = App.format.esc;
    const fmt = App.format;
    const MAX_DEFAULT_CANDLES = 15000;
    const DEFAULT_RANGE_DAYS = 90;

    const strategies = {
        'ema-cross': [
            { key: 'fast', label: 'Fast EMA', value: 20 },
            { key: 'slow', label: 'Slow EMA', value: 50 },
            { key: 'atrStop', label: 'ATR stop ×', value: 2 },
            { key: 'rewardRisk', label: 'Reward : Risk', value: 2 }
        ],
        'rsi-reversal': [
            { key: 'period', label: 'RSI period', value: 14 },
            { key: 'oversold', label: 'Oversold', value: 30 },
            { key: 'overbought', label: 'Overbought', value: 70 },
            { key: 'atrStop', label: 'ATR stop ×', value: 1.5 },
            { key: 'rewardRisk', label: 'Reward : Risk', value: 2 }
        ],
        'fib-pullback': [
            { key: 'zoneStart', label: 'Zone start', value: 0.5 },
            { key: 'zoneEnd', label: 'Zone end', value: 0.618 },
            { key: 'stopRatio', label: 'Stop ratio', value: 0.786 },
            { key: 'atrBuffer', label: 'ATR buffer ×', value: 0.5 },
            { key: 'maxAge', label: 'Max age (bars)', value: 60 }
        ],
        'ai-setup': []
    };

    let result = null;
    let sortKey = 'id';
    let sortAscending = true;
    let equityChart = null;
    let datesTouched = false;

    function isoDate(date) {
        return date.toISOString().slice(0, 10);
    }

    function applyDefaultDates() {
        if (datesTouched) return;
        const step = App.timeframeStep();
        const days = Math.max(1, Math.min(DEFAULT_RANGE_DAYS, Math.floor((MAX_DEFAULT_CANDLES * step) / 86400)));
        const to = new Date();
        to.setUTCHours(0, 0, 0, 0);
        const from = new Date(to.getTime() - days * 86400000);
        $('#bt-from').val(isoDate(from));
        $('#bt-to').val(isoDate(to));
    }

    function renderParams() {
        const strategy = $('#bt-strategy').val();
        const isAi = strategy === 'ai-setup';
        $('#bt-setup-wrap').toggleClass('hidden', !isAi);
        $('#bt-params').html(strategies[strategy].map(function (p) {
            return '<div><label class="label" for="bt-p-' + p.key + '">' + esc(p.label) + '</label>' +
                '<input id="bt-p-' + p.key + '" data-param="' + p.key + '" type="number" step="any" class="field" value="' + p.value + '" /></div>';
        }).join(''));
    }

    function renderSetupOptions() {
        const setups = (App.state.analysis && App.state.analysis.setups) || [];
        const current = $('#bt-setup').val();
        $('#bt-setup').html(setups.length
            ? setups.map(function (s) {
                return '<option value="' + esc(s.id) + '">' + esc(s.id) + ' · ' + esc(s.direction) + ' · ' + esc(s.type) + '</option>';
            }).join('')
            : '<option value="">Run an AI analysis first</option>');
        if (current && setups.some(function (s) { return s.id === current; })) $('#bt-setup').val(current);
    }

    function collectRequest() {
        const strategy = $('#bt-strategy').val();
        const params = {};
        $('#bt-params [data-param]').each(function () {
            params[$(this).data('param')] = Number($(this).val());
        });

        const request = {
            symbol: App.state.symbol,
            strategy: strategy,
            params: params,
            timeframe: App.state.timeframe,
            from: $('#bt-from').val() + 'T00:00:00Z',
            to: $('#bt-to').val() + 'T00:00:00Z',
            initialBalance: Number($('#bt-balance').val()),
            riskPercent: Number($('#bt-risk').val()),
            feePercent: Number($('#bt-fee').val()),
            slippagePercent: Number($('#bt-slippage').val())
        };

        if (strategy === 'ai-setup') {
            const setups = (App.state.analysis && App.state.analysis.setups) || [];
            request.setup = setups.find(function (s) { return s.id === $('#bt-setup').val(); }) || null;
        }

        return request;
    }

    function metric(label, value, cls) {
        return '<div class="metric"><div class="text-xs text-tv-muted">' + label + '</div><div class="text-base font-semibold ' + (cls || '') + '">' + value + '</div></div>';
    }

    function renderMetrics(m) {
        const profitFactor = m.profitFactor == null ? '∞' : fmt.number(m.profitFactor, 2);
        return '<div class="grid grid-cols-2 gap-2">' +
            metric('Total trades', m.totalTrades) +
            metric('Win rate', fmt.number(m.winRate, 2) + '%') +
            metric('Profit factor', profitFactor) +
            metric('Net PnL', fmt.signed(m.netPnl, 2) + ' <span class="text-xs">(' + fmt.signed(m.netPnlPercent, 2) + '%)</span>', fmt.signClass(m.netPnl)) +
            metric('Max drawdown', fmt.number(m.maxDrawdownPercent, 2) + '%', 'text-tv-down') +
            metric('Expectancy', fmt.signed(m.expectancy, 2), fmt.signClass(m.expectancy)) +
            metric('Avg RR', fmt.signed(m.averageRr, 2) + 'R', fmt.signClass(m.averageRr)) +
            metric('Sharpe', fmt.number(m.sharpeRatio, 2)) +
            metric('Final balance', fmt.number(m.finalBalance, 2)) +
            '</div>';
    }

    function sortedTrades() {
        return result.trades.slice().sort(function (a, b) {
            const left = a[sortKey];
            const right = b[sortKey];
            const order = typeof left === 'string' ? left.localeCompare(right) : left - right;
            return sortAscending ? order : -order;
        });
    }

    function renderTradeRows() {
        return sortedTrades().map(function (t) {
            return '<tr class="trade-row cursor-pointer border-t border-tv-border hover:bg-tv-border" data-trade-id="' + t.id + '">' +
                '<td class="px-2 py-1">' + t.id + '</td>' +
                '<td class="px-2 py-1"><span class="badge badge-' + t.direction + '">' + t.direction + '</span></td>' +
                '<td class="px-2 py-1 whitespace-nowrap">' + fmt.dateTime(t.entryTime) + '</td>' +
                '<td class="px-2 py-1 text-right">' + fmt.price(t.entryPrice) + '</td>' +
                '<td class="px-2 py-1 text-right">' + fmt.price(t.exitPrice) + '</td>' +
                '<td class="px-2 py-1 text-right ' + fmt.signClass(t.pnl) + '">' + fmt.signed(t.pnl, 2) + '</td>' +
                '<td class="px-2 py-1 text-right ' + fmt.signClass(t.rMultiple) + '">' + fmt.signed(t.rMultiple, 2) + '</td>' +
                '<td class="px-2 py-1">' + esc(t.exitReason) + '</td></tr>';
        }).join('');
    }

    function renderTable() {
        const columns = [
            ['id', '#'], ['direction', 'Side'], ['entryTime', 'Entry time'], ['entryPrice', 'Entry'],
            ['exitPrice', 'Exit'], ['pnl', 'PnL'], ['rMultiple', 'R'], ['exitReason', 'Exit']
        ];
        const head = columns.map(function (c) {
            const arrow = sortKey === c[0] ? (sortAscending ? ' ▲' : ' ▼') : '';
            return '<th class="sort-header cursor-pointer select-none whitespace-nowrap px-2 py-1 text-left font-medium text-tv-muted" data-sort="' + c[0] + '">' + c[1] + arrow + '</th>';
        }).join('');

        return '<div class="max-h-72 overflow-auto rounded-lg border border-tv-border"><table class="w-full text-xs">' +
            '<thead class="sticky top-0 bg-tv-panel"><tr>' + head + '</tr></thead><tbody>' + renderTradeRows() + '</tbody></table></div>';
    }

    function drawEquity() {
        if (equityChart) {
            equityChart.remove();
            equityChart = null;
        }
        const container = document.getElementById('bt-equity');
        if (!container || !result.equityCurve.length) return;

        equityChart = LightweightCharts.createChart(container, {
            autoSize: true,
            layout: { background: { type: 'solid', color: '#131722' }, textColor: '#d1d4dc', fontSize: 11 },
            grid: { vertLines: { color: '#1f2330' }, horzLines: { color: '#1f2330' } },
            rightPriceScale: { borderColor: '#2a2e39' },
            timeScale: { borderColor: '#2a2e39', timeVisible: true }
        });
        const series = equityChart.addAreaSeries({
            lineColor: '#2962ff',
            topColor: 'rgba(41,98,255,0.4)',
            bottomColor: 'rgba(41,98,255,0.02)',
            lineWidth: 2
        });
        series.setData(result.equityCurve.map(function (p) { return { time: p.time, value: p.equity }; }));
        equityChart.timeScale().fitContent();
    }

    function drawMarkers() {
        const markers = [];
        result.trades.forEach(function (t) {
            const isLong = t.direction === 'long';
            if (App.chartCore.hasTime(t.entryTime)) {
                markers.push({
                    time: t.entryTime,
                    position: isLong ? 'belowBar' : 'aboveBar',
                    shape: isLong ? 'arrowUp' : 'arrowDown',
                    color: isLong ? '#26a69a' : '#ef5350',
                    text: '#' + t.id
                });
            }
            if (App.chartCore.hasTime(t.exitTime)) {
                markers.push({
                    time: t.exitTime,
                    position: isLong ? 'aboveBar' : 'belowBar',
                    shape: 'circle',
                    color: t.pnl >= 0 ? '#26a69a' : '#ef5350',
                    text: fmt.signed(t.pnl, 0)
                });
            }
        });
        App.chartCore.setMarkers('backtest', markers);
    }

    function renderResult() {
        const warnings = result.warnings.map(function (w) {
            return '<div class="card border-yellow-500/50 text-xs text-yellow-400">' + esc(w) + '</div>';
        }).join('');

        $('#bt-result').html(
            '<div class="space-y-3">' + renderMetrics(result.metrics) + warnings +
            '<div><div class="label">Equity curve</div><div id="bt-equity" class="h-40 overflow-hidden rounded-lg border border-tv-border"></div></div>' +
            '<div><div class="label">Trades (' + result.trades.length + ')</div><div id="bt-trades">' + (result.trades.length ? renderTable() : '<div class="card text-sm text-tv-muted">No trades were triggered in this range.</div>') + '</div></div>' +
            '<p class="text-center text-xs text-tv-muted">Past performance does not guarantee future results. This is not financial advice. / এটি আর্থিক পরামর্শ নয়।</p></div>'
        );
        drawEquity();
        drawMarkers();
    }

    function focusTrade(id) {
        const trade = result.trades.find(function (t) { return t.id === id; });
        if (!trade) return;
        if (!App.chartCore.hasTime(trade.entryTime)) {
            App.toast.show('This trade is outside the loaded chart range.', 'warning');
            return;
        }
        App.chartCore.focusTime(trade.entryTime, 40, 40);
    }

    function setBusy(busy) {
        $('#bt-run').prop('disabled', busy).text(busy ? 'Running…' : 'Run backtest');
    }

    App.backtestPanel = {
        init: function () {
            renderParams();
            renderSetupOptions();
            applyDefaultDates();

            $('#bt-strategy').on('change', renderParams);
            $('#bt-from, #bt-to').on('change', function () { datesTouched = true; });
            $('#backtest-button').on('click', function () { App.panel.open('backtest'); });

            $('#backtest-form').on('submit', function (event) {
                event.preventDefault();
                App.backtestPanel.run();
            });

            $('#bt-result')
                .on('click', '.trade-row', function () { focusTrade(Number($(this).data('trade-id'))); })
                .on('click', '.sort-header', function () {
                    const key = $(this).data('sort');
                    sortAscending = sortKey === key ? !sortAscending : true;
                    sortKey = key;
                    $('#bt-trades').html(renderTable());
                });

            $(document).on('analysis:updated', renderSetupOptions);
            $(document).on('timeframe:changed', function () {
                App.chartCore.clearMarkers('backtest');
                applyDefaultDates();
            });
        },

        run: function () {
            const request = collectRequest();
            if (request.strategy === 'ai-setup' && !request.setup) {
                App.toast.show('Run an AI analysis and pick a setup first.', 'warning');
                return $.Deferred().reject().promise();
            }

            setBusy(true);
            $('#bt-result').html('<div class="space-y-3"><div class="skeleton h-24 w-full"></div><div class="skeleton h-40 w-full"></div></div>');

            return App.api.post('/api/backtest', request)
                .done(function (data) {
                    result = data;
                    sortKey = 'id';
                    sortAscending = true;
                    renderResult();
                    App.toast.show('Backtest finished: ' + data.metrics.totalTrades + ' trades.', 'success');
                })
                .fail(function (error) {
                    $('#bt-result').html('<div class="card text-sm text-tv-down">' + esc(error.message) + '</div>');
                    App.toast.show(error.message, 'error');
                })
                .always(function () { setBusy(false); });
        },

        runForSetup: function (setupId) {
            App.panel.open('backtest');
            $('#bt-strategy').val('ai-setup');
            renderParams();
            renderSetupOptions();
            $('#bt-setup').val(setupId);
            App.backtestPanel.run();
        }
    };
})(jQuery, window.App);
