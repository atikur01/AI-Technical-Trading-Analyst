(function ($, App) {
    const EDGE_GAP = 4;
    const PRICE_ZOOM_IN = 0.9;
    const PRICE_ZOOM_OUT = 1.1;

    let $menu = null;
    let $host = null;
    let lastY = 0;

    function close() {
        $menu.removeClass('is-open').empty();
    }

    function item(label, hint, action) {
        return { label: label, hint: hint, action: action };
    }

    function drawingItems(target) {
        return [
            item('Duplicate drawing', 'Ctrl+C, Ctrl+V', function () { App.drawingTools.duplicate(target); }),
            item('Delete drawing', 'Del', function () { App.manualDrawings.remove(target); })
        ];
    }

    function chartItems() {
        const items = [];
        if (App.manualDrawings.hasClipboard()) {
            items.push(item('Paste drawing', 'Ctrl+V', App.drawingTools.paste));
        }
        items.push(
            item('Undo drawing change', 'Ctrl+Z', App.drawingTools.undo),
            item('Redo drawing change', 'Ctrl+Shift+Z', App.drawingTools.redo),
            null,
            item('Fit all data', 'Home', App.chartCore.fit),
            item('Go to latest', 'End', App.chartCore.scrollToLatest),
            item('Toggle auto scale', '', App.chartControls.toggleAuto),
            item('Reset chart', '', App.chartControls.reset),
            item('Save screenshot', '', App.chartControls.screenshot)
        );
        if (App.manualDrawings.count()) {
            items.push(null, item('Remove all drawings', '', function () {
                if (window.confirm('Remove all manual drawings?')) App.manualDrawings.clear();
            }));
        }
        return items;
    }

    function build(entries) {
        entries.forEach(function (entry) {
            if (!entry) {
                $menu.append('<div class="context-sep" role="separator"></div>');
                return;
            }
            const $button = $('<button type="button" class="context-item" role="menuitem"></button>');
            $('<span></span>').text(entry.label).appendTo($button);
            $('<span class="context-hint"></span>').text(entry.hint).appendTo($button);
            $button.on('click', function () {
                close();
                entry.action();
            });
            $menu.append($button);
        });
    }

    function place(x, y) {
        const hostWidth = $host.innerWidth();
        const hostHeight = $host.innerHeight();
        const left = Math.max(EDGE_GAP, Math.min(x, hostWidth - $menu.outerWidth() - EDGE_GAP));
        const top = Math.max(EDGE_GAP, Math.min(y, hostHeight - $menu.outerHeight() - EDGE_GAP));
        $menu.css({ left: left, top: top });
    }

    function onContextMenu(event) {
        event.preventDefault();
        const rect = $host[0].getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const chartRect = App.chartCore.container().getBoundingClientRect();
        const target = App.manualDrawings.hit(event.clientX - chartRect.left, event.clientY - chartRect.top);
        if (target) App.manualDrawings.select(target);

        close();
        build(target ? drawingItems(target).concat([null], chartItems()) : chartItems());
        $menu.addClass('is-open');
        place(x, y);
        $menu.find('.context-item').first().trigger('focus');
    }

    function onDoubleClick(event) {
        const chartRect = App.chartCore.container().getBoundingClientRect();
        const x = event.clientX - chartRect.left;
        const y = event.clientY - chartRect.top;
        const inPlot = x <= App.chartCore.plotWidth() && y <= App.chartCore.plotHeight();
        if (inPlot && !App.manualDrawings.hit(x, y)) App.chartCore.scrollToLatest();
    }

    function clientY(event) {
        const native = event.originalEvent || event;
        return (native.touches && native.touches[0] ? native.touches[0] : native).clientY;
    }

    function endPricePan() {
        $(document).off('.pricepan');
    }

    function movePricePan(event) {
        const y = clientY(event);
        App.chartCore.panPrice(y - lastY);
        lastY = y;
    }

    function startPricePan(event) {
        const native = event.originalEvent || event;
        if (event.defaultPrevented || (native.touches && native.touches.length > 1)) return;
        if (native.button) return;
        if (!App.chartCore.isAutoScale()) return;

        const rect = App.chartCore.container().getBoundingClientRect();
        const x = (native.touches ? native.touches[0] : native).clientX - rect.left;
        const y = clientY(event) - rect.top;
        if (x > App.chartCore.plotWidth() || y > App.chartCore.plotHeight()) return;

        lastY = clientY(event);
        $(document)
            .on('mousemove.pricepan touchmove.pricepan', movePricePan)
            .on('mouseup.pricepan touchend.pricepan touchcancel.pricepan', endPricePan);
    }

    function onWheel(event) {
        close();
        const rect = App.chartCore.container().getBoundingClientRect();
        if (!App.chartCore.isOverPriceScale(event.clientX - rect.left, event.clientY - rect.top)) return;
        event.preventDefault();
        event.stopPropagation();
        App.chartCore.zoomPrice(event.deltaY < 0 ? PRICE_ZOOM_IN : PRICE_ZOOM_OUT);
        App.chartControls.syncButtons();
    }

    App.chartGestures = {
        init: function () {
            $menu = $('#chart-context-menu');
            $host = $menu.parent();

            const chartEl = App.chartCore.container();
            chartEl.addEventListener('contextmenu', onContextMenu, true);
            chartEl.addEventListener('dblclick', onDoubleClick);
            chartEl.addEventListener('mousedown', startPricePan, true);
            chartEl.addEventListener('touchstart', startPricePan, { capture: true, passive: true });

            $(document)
                .on('mousedown touchstart', function (event) {
                    if (!$(event.target).closest($menu).length) close();
                })
                .on('keydown', function (event) {
                    if (event.key === 'Escape') close();
                });
            $(window).on('resize blur', close);
            chartEl.addEventListener('wheel', onWheel, { capture: true, passive: false });
        }
    };
})(jQuery, window.App);
