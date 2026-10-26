(function ($, App) {
    const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

    let tool = 'cursor';
    let pending = null;
    let measure = null;
    let drag = null;
    let container = null;

    function relative(event) {
        const rect = container.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function inPlot(p) {
        return p.x >= 0 && p.y >= 0 && p.x <= App.chartCore.plotWidth() && p.y <= App.chartCore.plotHeight();
    }

    function copy(c) {
        return { time: c.time, price: c.price };
    }

    function clearMeasure() {
        if (!measure) return false;
        App.chartCore.detachPrimitive(measure);
        measure = null;
        return true;
    }

    function cancelPending() {
        if (!pending) return false;
        if (pending.item) App.manualDrawings.remove(pending.item);
        else clearMeasure();
        pending = null;
        return true;
    }

    function setCursor() {
        container.style.cursor = tool === 'cursor' ? '' : 'crosshair';
    }

    function buildDrawing(kind, c) {
        switch (kind) {
            case 'trendline':
                return { type: 'trendline', points: [copy(c), copy(c)], color: '#2962ff', extend: 'none' };
            case 'fibonacci':
                return { type: 'fibonacci', from: copy(c), to: copy(c), levels: FIB_LEVELS.slice() };
            default:
                return { type: 'zone', kind: 'custom', bounded: true, from: copy(c), to: copy(c) };
        }
    }

    function endPoint(drawing) {
        return drawing.type === 'trendline' ? drawing.points[1] : drawing.to;
    }

    function isDegenerate(drawing) {
        const a = drawing.type === 'trendline' ? drawing.points[0] : drawing.from;
        const b = endPoint(drawing);
        return a.time === b.time && a.price === b.price;
    }

    function handleToolClick(c) {
        if (tool === 'horizontal') {
            const item = App.manualDrawings.add({ type: 'horizontal', price: c.price, color: '#f7a600', style: 'solid' });
            App.manualDrawings.commit(item);
            App.drawingTools.setTool('cursor');
            return;
        }

        if (!pending) {
            if (tool === 'measure') {
                clearMeasure();
                measure = new App.MeasurePrimitive({ from: copy(c), to: copy(c) });
                App.chartCore.attachPrimitive(measure);
                pending = { kind: 'measure', item: null };
            } else {
                pending = { kind: tool, item: App.manualDrawings.add(buildDrawing(tool, c)) };
            }
            return;
        }

        if (pending.kind === 'measure') {
            Object.assign(measure.drawing.to, copy(c));
            measure.refresh();
            pending = null;
            App.drawingTools.setTool('cursor', true);
            return;
        }

        const item = pending.item;
        Object.assign(endPoint(item.drawing), copy(c));
        pending = null;

        if (isDegenerate(item.drawing)) {
            App.manualDrawings.remove(item);
        } else {
            item.primitive.refresh();
            App.manualDrawings.commit(item);
        }
        App.drawingTools.setTool('cursor');
    }

    function updatePending(c) {
        if (pending.kind === 'measure') {
            Object.assign(measure.drawing.to, copy(c));
            measure.refresh();
            return;
        }
        Object.assign(endPoint(pending.item.drawing), copy(c));
        pending.item.primitive.refresh();
    }

    function startDrag(event, state) {
        event.stopPropagation();
        event.preventDefault();
        drag = state;
        $(document).on('mousemove.drawdrag', onDragMove).on('mouseup.drawdrag', endDrag);
    }

    function onDragMove(event) {
        const p = relative(event);
        const c = App.chartCore.pointToChart(p.x, p.y);
        if (!c || !drag) return;

        if (drag.type === 'anchor') {
            App.manualDrawings.setAnchor(drag.item, drag.index, c);
        } else {
            const deltaTime = Math.round((c.logical - drag.last.logical) * App.timeframeStep());
            App.manualDrawings.moveBy(drag.item, deltaTime, c.price - drag.last.price);
            drag.last = c;
        }
    }

    function endDrag() {
        $(document).off('.drawdrag');
        drag = null;
        App.manualDrawings.save();
    }

    function onMouseDown(event) {
        if (event.button !== 0) return;
        const p = relative(event);
        if (!inPlot(p)) return;
        const c = App.chartCore.pointToChart(p.x, p.y);
        if (!c) return;

        if (tool !== 'cursor') {
            event.stopPropagation();
            event.preventDefault();
            handleToolClick(c);
            return;
        }

        clearMeasure();
        const selected = App.manualDrawings.selected();
        if (selected) {
            const index = App.manualDrawings.anchorAt(selected, p.x, p.y);
            if (index >= 0) return startDrag(event, { type: 'anchor', item: selected, index: index });
        }

        const item = App.manualDrawings.hit(p.x, p.y);
        if (item) {
            App.manualDrawings.select(item);
            return startDrag(event, { type: 'move', item: item, last: c });
        }
        App.manualDrawings.select(null);
    }

    function onMouseMove(event) {
        if (drag) return;
        const p = relative(event);

        if (pending) {
            const c = App.chartCore.pointToChart(p.x, p.y);
            if (c) updatePending(c);
            return;
        }

        if (tool !== 'cursor' || !inPlot(p)) return;
        const selected = App.manualDrawings.selected();
        if (selected && App.manualDrawings.anchorAt(selected, p.x, p.y) >= 0) container.style.cursor = 'pointer';
        else container.style.cursor = App.manualDrawings.hit(p.x, p.y) ? 'move' : '';
    }

    App.drawingTools = {
        init: function () {
            container = App.chartCore.container();
            container.addEventListener('mousedown', onMouseDown, true);
            container.addEventListener('mousemove', onMouseMove, true);
            App.manualDrawings.load();

            $('[data-tool]').on('click', function () {
                const name = $(this).data('tool');
                App.drawingTools.setTool(name === tool ? 'cursor' : name);
            });

            $('#tool-delete').on('click', function () {
                if (!App.manualDrawings.removeSelected()) App.toast.show('Select a drawing first.', 'info');
            });

            $('#tool-clear').on('click', function () {
                if (!App.manualDrawings.count()) return App.toast.show('No manual drawings to remove.', 'info');
                if (window.confirm('Remove all manual drawings?')) App.manualDrawings.clear();
            });
        },

        setTool: function (name, keepMeasure) {
            cancelPending();
            if (!keepMeasure) clearMeasure();
            if (name !== 'cursor') App.manualDrawings.select(null);
            tool = name;
            $('[data-tool]').removeClass('is-active').filter('[data-tool="' + name + '"]').addClass('is-active');
            setCursor();
        },

        cancel: function () {
            if (cancelPending()) return true;
            if (tool !== 'cursor') {
                App.drawingTools.setTool('cursor');
                return true;
            }
            if (App.manualDrawings.selected()) {
                App.manualDrawings.select(null);
                return true;
            }
            return clearMeasure();
        },

        deleteSelected: function () {
            return App.manualDrawings.removeSelected();
        }
    };
})(jQuery, window.App);
