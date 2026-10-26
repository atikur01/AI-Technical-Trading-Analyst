(function ($, App) {
    const esc = App.format.esc;
    const price = App.format.price;
    let selectedSetupId = null;

    function skeleton() {
        const bar = function (width) {
            return '<div class="skeleton h-4 ' + width + '"></div>';
        };
        return '<div class="space-y-3">' +
            bar('w-1/2') + bar('w-full') + bar('w-3/4') +
            '<div class="skeleton h-28 w-full"></div><div class="skeleton h-28 w-full"></div>' +
            '<p class="text-center text-xs text-tv-muted">The AI is analyzing the market. This can take up to a minute…</p></div>';
    }

    function badge(value) {
        return '<span class="badge badge-' + esc(value) + '">' + esc(value) + '</span>';
    }

    function renderTrend(analysis) {
        return '<div class="card space-y-2">' +
            '<div class="flex items-center justify-between"><span class="label !mb-0">HTF trend</span>' + badge(analysis.trend.htf) + '</div>' +
            '<div class="flex items-center justify-between"><span class="label !mb-0">LTF trend</span>' + badge(analysis.trend.ltf) + '</div>' +
            '<div class="flex items-center justify-between"><span class="label !mb-0">Bias</span>' + badge(analysis.bias) + '</div>' +
            '<div><div class="mb-1 flex justify-between text-xs text-tv-muted"><span>Confidence</span><span>' + analysis.confidence + '%</span></div>' +
            '<div class="h-2 overflow-hidden rounded bg-tv-border"><div class="h-full bg-tv-accent" style="width:' + analysis.confidence + '%"></div></div></div>' +
            '</div>';
    }

    function renderSummary(analysis) {
        return '<div class="card space-y-2 text-sm">' +
            (analysis.marketStructure ? '<p><span class="font-semibold">Structure:</span> ' + esc(analysis.marketStructure) + '</p>' : '') +
            (analysis.summary ? '<p class="text-tv-text">' + esc(analysis.summary) + '</p>' : '') +
            '</div>';
    }

    function renderLevels(levels) {
        if (!levels.length) return '';
        const rows = levels.slice().sort(function (a, b) { return b.price - a.price; }).map(function (level) {
            const color = level.type === 'support' ? 'text-tv-up' : 'text-tv-down';
            return '<div class="flex items-center justify-between text-sm"><span class="' + color + ' capitalize">' + esc(level.type) + '</span>' +
                '<span>' + price(level.price) + '</span><span class="text-xs text-tv-muted">' + '●'.repeat(level.strength) + '</span></div>';
        }).join('');
        return '<div class="card space-y-1"><div class="label">Key levels</div>' + rows + '</div>';
    }

    function renderSetup(setup) {
        const isLong = setup.direction === 'long';
        const border = isLong ? 'border-l-tv-up' : 'border-l-tv-down';
        const cell = function (label, value, cls) {
            return '<div><div class="text-xs text-tv-muted">' + label + '</div><div class="text-sm font-semibold ' + (cls || '') + '">' + value + '</div></div>';
        };
        const chips = setup.confluences.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join(' ');
        const targets = setup.takeProfits.map(price).join(' / ');

        return '<div class="card setup-card cursor-pointer border-l-4 ' + border + ' space-y-2 hover:bg-tv-panel" data-setup-id="' + esc(setup.id) + '">' +
            '<div class="flex items-center justify-between"><div class="flex items-center gap-2">' + badge(setup.direction) +
            '<span class="text-sm capitalize">' + esc(setup.type) + '</span></div><span class="text-xs text-tv-muted">' + esc(setup.id) + '</span></div>' +
            '<div class="grid grid-cols-3 gap-2">' +
            cell('Entry', price(setup.entry)) + cell('Stop', price(setup.stopLoss), 'text-tv-down') + cell('RR', setup.riskReward.toFixed(2)) +
            '</div>' +
            '<div>' + cell('Targets', targets, 'text-tv-up') + '</div>' +
            (chips ? '<div class="flex flex-wrap gap-1">' + chips + '</div>' : '') +
            (setup.invalidation ? '<p class="text-xs text-tv-muted"><span class="font-semibold text-tv-text">Invalidation:</span> ' + esc(setup.invalidation) + '</p>' : '') +
            '<button type="button" class="btn w-full backtest-setup" data-setup-id="' + esc(setup.id) + '">Backtest this setup</button>' +
            '</div>';
    }

    function renderSetups(setups) {
        if (!setups.length) {
            return '<div class="card text-sm text-tv-muted">No valid trade setup right now. Waiting for a better opportunity is a valid position.</div>';
        }
        return '<div class="space-y-3"><div class="label !mb-0">Trade setups</div>' + setups.map(renderSetup).join('') + '</div>';
    }

    function renderWarnings(warnings) {
        if (!warnings.length) return '';
        const rows = warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
        return '<div class="card border-yellow-500/50 text-xs text-yellow-400"><div class="mb-1 font-semibold">Validation notes</div><ul class="list-disc space-y-0.5 pl-4">' + rows + '</ul></div>';
    }

    function render(result) {
        $('#analysis-result').html(
            '<div class="space-y-3">' +
            renderTrend(result.analysis) + renderSummary(result.analysis) + renderLevels(result.analysis.keyLevels) +
            renderSetups(result.setups) + renderWarnings(result.warnings) +
            '<p class="text-center text-xs text-tv-muted">This is not financial advice. / এটি আর্থিক পরামর্শ নয়।</p>' +
            '</div>'
        );
    }

    function showError(message) {
        $('#analysis-result').html(
            '<div class="card space-y-3 border-tv-down/50 text-center"><p class="text-sm text-tv-down">' + esc(message) + '</p>' +
            '<button type="button" class="btn" id="analysis-retry">Try again</button></div>'
        );
    }

    function selectSetup(setupId) {
        selectedSetupId = selectedSetupId === setupId ? null : setupId;
        $('.setup-card').removeClass('ring-1 ring-tv-accent');
        if (selectedSetupId) {
            $('.setup-card[data-setup-id="' + selectedSetupId + '"]').addClass('ring-1 ring-tv-accent');
        }
        App.drawingRenderer.highlight(selectedSetupId);
    }

    function syncControls() {
        const hasDrawings = App.drawingRenderer.hasDrawings();
        $('#drawing-controls').toggleClass('hidden', !hasDrawings).toggleClass('flex', hasDrawings);
        $('#keep-drawings-wrap').toggleClass('hidden', !hasDrawings).toggleClass('flex', hasDrawings);
        $('#drawings-toggle').text(App.drawingRenderer.isHidden() ? 'Show drawings' : 'Hide drawings');
    }

    let initialResultHtml = '';

    App.analysisPanel = {
        reset: function () {
            App.state.analysis = null;
            selectedSetupId = null;
            $('#analysis-result').html(initialResultHtml);
            syncControls();
            $(document).trigger('analysis:updated');
        },

        init: function () {
            initialResultHtml = $('#analysis-result').html();
            $('#analyze-button').on('click', App.analysisPanel.run);

            $('#analysis-result')
                .on('click', '.setup-card', function () {
                    selectSetup($(this).data('setup-id'));
                })
                .on('click', '.backtest-setup', function (event) {
                    event.stopPropagation();
                    App.backtestPanel.runForSetup($(this).data('setup-id'));
                })
                .on('click', '#analysis-retry, #analysis-start', App.analysisPanel.run);

            $('#drawings-toggle').on('click', function () {
                App.drawingRenderer.toggle();
                syncControls();
            });

            $('#drawings-clear').on('click', function () {
                App.drawingRenderer.clear();
                syncControls();
            });

            $(document).on('drawings:changed', syncControls);
        },

        run: function () {
            const $button = $('#analyze-button');
            if ($button.prop('disabled')) return;

            App.panel.open('analysis');
            $button.prop('disabled', true).text('Analyzing…');
            $('#analysis-result').html(skeleton());

            return App.api.post('/api/analysis', { symbol: App.state.symbol, timeframe: App.state.timeframe })
                .done(function (result) {
                    App.state.analysis = result;
                    selectedSetupId = null;
                    render(result);
                    App.drawingRenderer.render(result.drawings);
                    syncControls();
                    $(document).trigger('analysis:updated');
                    App.toast.show('Analysis ready: ' + result.setups.length + ' setup(s).', 'success');
                })
                .fail(function (error) {
                    showError(error.message);
                    App.toast.show(error.message, 'error');
                })
                .always(function () {
                    $button.prop('disabled', false).text('Analyze with AI');
                });
        }
    };
})(jQuery, window.App);
