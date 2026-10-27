(function ($, App) {
    const esc = App.format.esc;
    const price = App.format.price;
    const LOADING_STEPS = [
        'Reading market structure',
        'Mapping support and resistance',
        'Checking higher timeframe trend',
        'Scoring trade setups',
        'Drawing levels on the chart'
    ];
    const STEP_INTERVAL_MS = 2800;
    const BIAS_COLORS = { bullish: '#22c997', bearish: '#f6465d' };
    const NEUTRAL_COLOR = '#7d8699';
    const MAX_STRENGTH = 5;

    let selectedSetupId = null;
    let stepTimer = null;

    function stopSteps() {
        clearInterval(stepTimer);
        stepTimer = null;
    }

    function stepRow(label, index, active) {
        const state = index < active ? 'done' : index === active ? 'active' : 'todo';
        const icons = {
            done: '<span class="flex h-5 w-5 items-center justify-center rounded-full bg-tv-up/20 text-[10px] text-tv-up">✓</span>',
            active: '<span class="h-5 w-5 animate-spin rounded-full border-2 border-tv-border border-t-tv-accent"></span>',
            todo: '<span class="h-5 w-5 rounded-full border-2 border-tv-border"></span>'
        };
        const colors = { done: 'text-tv-muted', active: 'text-tv-text', todo: 'text-tv-muted/60' };
        return '<li class="flex items-center gap-3 text-sm transition ' + colors[state] + '">' + icons[state] + esc(label) + '</li>';
    }

    function renderSteps(active) {
        return LOADING_STEPS.map(function (label, index) { return stepRow(label, index, active); }).join('');
    }

    function skeleton() {
        return '<div class="animate-fade-up space-y-4">' +
            '<div class="relative overflow-hidden rounded-xl border border-tv-border bg-tv-raised/60 p-4">' +
            '<div class="scan-line absolute inset-x-0 top-0 animate-scan"></div>' +
            '<div class="mb-3 text-sm font-semibold">Analyzing ' + esc(App.state.symbol) + ' · ' + esc(App.state.timeframe) + '</div>' +
            '<ul id="analysis-steps" class="space-y-3">' + renderSteps(0) + '</ul></div>' +
            '<div class="skeleton h-24 w-full"></div><div class="skeleton h-32 w-full"></div>' +
            '<p class="text-center text-xs text-tv-muted">This can take up to a minute.</p></div>';
    }

    function startSteps() {
        stopSteps();
        let active = 0;
        stepTimer = setInterval(function () {
            active = Math.min(active + 1, LOADING_STEPS.length - 1);
            $('#analysis-steps').html(renderSteps(active));
        }, STEP_INTERVAL_MS);
    }

    function badge(value) {
        return '<span class="badge badge-' + esc(value) + '">' + esc(value) + '</span>';
    }

    function renderTrend(analysis) {
        const confidence = Math.max(0, Math.min(100, Math.round(analysis.confidence)));
        const color = BIAS_COLORS[analysis.bias] || NEUTRAL_COLOR;
        return '<div class="card flex items-center gap-4">' +
            '<div class="relative h-20 w-20 shrink-0">' +
            '<div class="confidence-ring absolute inset-0 rounded-full" style="--value:' + confidence + ';--ring-color:' + color + '"></div>' +
            '<div class="absolute inset-0 flex flex-col items-center justify-center"><span class="num text-xl font-bold">' + confidence +
            '</span><span class="text-[9px] font-semibold uppercase tracking-wider text-tv-muted">conf</span></div></div>' +
            '<div class="min-w-0 flex-1 space-y-2">' +
            '<div><div class="label !mb-0.5">AI bias</div><div class="text-2xl font-bold capitalize leading-none" style="color:' + color + '">' + esc(analysis.bias) + '</div></div>' +
            '<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tv-muted">' +
            '<span class="flex items-center gap-1.5">HTF ' + badge(analysis.trend.htf) + '</span>' +
            '<span class="flex items-center gap-1.5">LTF ' + badge(analysis.trend.ltf) + '</span></div></div></div>';
    }

    function renderSummary(analysis) {
        if (!analysis.marketStructure && !analysis.summary) return '';
        return '<div class="card space-y-2 text-sm leading-relaxed">' +
            (analysis.marketStructure ? '<p><span class="font-semibold">Structure</span> <span class="text-tv-muted">' + esc(analysis.marketStructure) + '</span></p>' : '') +
            (analysis.summary ? '<p class="text-tv-muted">' + esc(analysis.summary) + '</p>' : '') +
            '</div>';
    }

    function strengthDots(strength) {
        const filled = Math.max(0, Math.min(MAX_STRENGTH, Math.round(strength)));
        return '<span class="tracking-widest text-tv-accent">' + '●'.repeat(filled) +
            '<span class="text-tv-border">' + '●'.repeat(MAX_STRENGTH - filled) + '</span></span>';
    }

    function renderLevels(levels) {
        if (!levels.length) return '';
        const rows = levels.slice().sort(function (a, b) { return b.price - a.price; }).map(function (level) {
            const color = level.type === 'support' ? 'bg-tv-up/15 text-tv-up' : 'bg-tv-down/15 text-tv-down';
            return '<div class="flex items-center justify-between gap-2 text-sm"><span class="badge ' + color + '">' + esc(level.type) + '</span>' +
                '<span class="num font-semibold">' + price(level.price) + '</span><span class="text-[8px]">' + strengthDots(level.strength) + '</span></div>';
        }).join('');
        return '<div class="card space-y-2"><div class="label">Key levels</div>' + rows + '</div>';
    }

    function riskRewardBar(setup) {
        const risk = Math.abs(setup.entry - setup.stopLoss);
        const finalTarget = setup.takeProfits[setup.takeProfits.length - 1];
        const reward = finalTarget == null ? 0 : Math.abs(finalTarget - setup.entry);
        const total = risk + reward;
        if (!total) return '';
        const riskShare = Math.round((risk / total) * 100);
        return '<div class="flex h-1.5 overflow-hidden rounded-full bg-tv-border" title="Risk vs reward">' +
            '<div class="bg-tv-down" style="width:' + riskShare + '%"></div><div class="bg-tv-up" style="width:' + (100 - riskShare) + '%"></div></div>';
    }

    function setupCell(label, value, cls) {
        return '<div class="rounded-lg bg-tv-bg px-2 py-1.5"><div class="text-[10px] font-semibold uppercase tracking-wider text-tv-muted">' + label +
            '</div><div class="num text-sm font-semibold ' + (cls || '') + '">' + value + '</div></div>';
    }

    function renderSetup(setup) {
        const accent = setup.direction === 'long' ? 'border-l-tv-up' : 'border-l-tv-down';
        const chips = setup.confluences.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join(' ');
        const targets = setup.takeProfits.map(price).join(' · ');

        return '<div class="card setup-card space-y-3 border-l-4 ' + accent + '" data-setup-id="' + esc(setup.id) + '">' +
            '<div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2">' + badge(setup.direction) +
            '<span class="text-sm font-medium capitalize">' + esc(setup.type) + '</span></div>' +
            '<button type="button" class="copy-setup tool-btn !h-7 !w-7" data-setup-id="' + esc(setup.id) + '" title="Copy trade plan" aria-label="Copy trade plan">' +
            '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg></button></div>' +
            '<div class="grid grid-cols-3 gap-2">' +
            setupCell('Entry', price(setup.entry)) + setupCell('Stop', price(setup.stopLoss), 'text-tv-down') + setupCell('R:R', setup.riskReward.toFixed(2), 'text-tv-accent') +
            '</div>' +
            riskRewardBar(setup) +
            setupCell('Targets', targets, 'text-tv-up') +
            (chips ? '<div class="flex flex-wrap gap-1">' + chips + '</div>' : '') +
            (setup.invalidation ? '<p class="text-xs leading-relaxed text-tv-muted"><span class="font-semibold text-tv-text">Invalidation</span> ' + esc(setup.invalidation) + '</p>' : '') +
            '</div>';
    }

    function renderSetups(setups) {
        if (!setups.length) {
            return '<div class="card text-center text-sm text-tv-muted"><div class="mb-1 text-base font-semibold text-tv-text">No clean setup right now</div>Waiting for a better opportunity is a valid position.</div>';
        }
        return '<div class="space-y-3"><div class="label !mb-0 px-1">Trade setups · ' + setups.length + '</div>' + setups.map(renderSetup).join('') + '</div>';
    }

    function renderWarnings(warnings) {
        if (!warnings.length) return '';
        const rows = warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
        return '<div class="card !border-yellow-500/30 !bg-yellow-500/5 text-xs text-yellow-400"><div class="mb-1 font-semibold">Validation notes</div><ul class="list-disc space-y-0.5 pl-4">' + rows + '</ul></div>';
    }

    function render(result) {
        $('#analysis-result').html(
            '<div class="space-y-3">' +
            renderTrend(result.analysis) + renderSummary(result.analysis) + renderSetups(result.setups) + renderLevels(result.analysis.keyLevels) +
            renderWarnings(result.warnings) +
            '<button type="button" id="analysis-rerun" class="btn w-full">Re-run analysis</button>' +
            '<p class="text-center text-[11px] text-tv-muted">AI-generated · not financial advice</p>' +
            '</div>'
        );
    }

    function showError(message) {
        $('#analysis-result').html(
            '<div class="card space-y-3 !border-tv-down/40 text-center">' +
            '<span class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-tv-down/15 text-lg font-bold text-tv-down">!</span>' +
            '<p class="text-sm text-tv-muted">' + esc(message) + '</p>' +
            '<button type="button" class="btn btn-primary" id="analysis-retry">Try again</button></div>'
        );
    }

    function setupText(setup) {
        return [
            setup.direction.toUpperCase() + ' ' + App.state.symbol + ' ' + App.state.timeframe + ' (' + setup.type + ')',
            'Entry: ' + price(setup.entry),
            'Stop: ' + price(setup.stopLoss),
            'Targets: ' + setup.takeProfits.map(price).join(', '),
            'R:R: ' + setup.riskReward.toFixed(2)
        ].join('\n');
    }

    function copySetup(setupId) {
        const setup = App.state.analysis && App.state.analysis.setups.find(function (item) { return item.id === setupId; });
        if (!setup || !navigator.clipboard) return App.toast.show('Copy is not available here.', 'warning');
        navigator.clipboard.writeText(setupText(setup))
            .then(function () { App.toast.show('Trade plan copied.', 'success'); })
            .catch(function () { App.toast.show('Could not copy the trade plan.', 'error'); });
    }

    function selectSetup(setupId) {
        selectedSetupId = selectedSetupId === setupId ? null : setupId;
        $('.setup-card').removeClass('is-selected').filter(function () {
            return selectedSetupId !== null && this.getAttribute('data-setup-id') === selectedSetupId;
        }).addClass('is-selected');
        App.drawingRenderer.highlight(selectedSetupId);
    }

    function syncControls() {
        const hasDrawings = App.drawingRenderer.hasDrawings();
        const hasAnalysis = !!App.state.analysis;
        $('#drawing-controls').toggleClass('hidden', !hasAnalysis && !hasDrawings).toggleClass('flex', hasAnalysis || hasDrawings);
        $('#drawings-toggle').toggleClass('hidden', !hasDrawings);
        $('#keep-drawings-wrap').toggleClass('hidden', !hasDrawings).toggleClass('flex', hasDrawings);
        $('#drawings-toggle').text(App.drawingRenderer.isHidden() ? 'Show drawings' : 'Hide drawings');
    }

    let initialResultHtml = '';
    let running = false;
    let generation = 0;

    function restorePanel() {
        if (App.state.analysis) render(App.state.analysis);
        else $('#analysis-result').html(initialResultHtml);
    }

    App.analysisPanel = {
        reset: function () {
            generation++;
            running = false;
            stopSteps();
            App.state.analysis = null;
            selectedSetupId = null;
            $('#analysis-result').html(initialResultHtml);
            syncControls();
            $(document).trigger('analysis:updated');
        },

        init: function () {
            initialResultHtml = $('#analysis-result').html();
            $('#analysis-result')
                .on('click', '.copy-setup', function (event) {
                    event.stopPropagation();
                    copySetup(this.getAttribute('data-setup-id'));
                })
                .on('click', '.setup-card', function () {
                    selectSetup(this.getAttribute('data-setup-id'));
                })
                .on('click', '#analysis-retry, #analysis-start, #analysis-rerun', App.analysisPanel.run);

            $('#drawings-toggle').on('click', function () {
                App.drawingRenderer.toggle();
                syncControls();
            });

            $('#drawings-clear').on('click', function () {
                App.drawingRenderer.clear();
                App.analysisPanel.reset();
            });

            $(document).on('drawings:changed', syncControls);
        },

        run: function () {
            if (running) return;

            running = true;
            const requestGeneration = generation;
            const requested = { symbol: App.state.symbol, timeframe: App.state.timeframe };
            const isStale = function () {
                return requestGeneration !== generation || requested.symbol !== App.state.symbol || requested.timeframe !== App.state.timeframe;
            };

            App.panel.open();
            $('#analysis-result').html(skeleton());
            startSteps();

            return App.api.post('/api/analysis', requested)
                .done(function (result) {
                    if (isStale()) return restorePanel();
                    App.state.analysis = result;
                    selectedSetupId = null;
                    render(result);
                    App.drawingRenderer.render(result.drawings);
                    syncControls();
                    $(document).trigger('analysis:updated');
                    App.toast.show('Analysis ready: ' + result.setups.length + ' setup(s).', 'success');
                })
                .fail(function (error) {
                    if (isStale()) return restorePanel();
                    showError(error.message);
                    App.toast.show(error.message, 'error');
                })
                .always(function () {
                    if (requestGeneration !== generation) return;
                    running = false;
                    stopSteps();
                });
        }
    };
})(jQuery, window.App);
