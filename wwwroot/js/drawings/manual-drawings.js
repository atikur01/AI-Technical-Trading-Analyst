(function (App) {
    const ANCHOR_TOLERANCE = 9;
    const STORAGE_PREFIX = 'manualDrawings:';

    const HISTORY_LIMIT = 50;
    const PASTE_OFFSET_BARS = 3;
    const PASTE_OFFSET_PRICE = 0.002;

    let items = [];
    let selected = null;
    let nextId = 1;
    let history = [];
    let future = [];
    let clipboard = null;

    function storageKey() {
        return STORAGE_PREFIX + App.state.symbol;
    }

    function createPrimitive(drawing) {
        switch (drawing.type) {
            case 'trendline': return new App.TrendlinePrimitive(drawing);
            case 'horizontal': return new App.HorizontalLinePrimitive(drawing);
            case 'fibonacci': return new App.FibonacciPrimitive(drawing);
            case 'zone': return new App.ZonePrimitive(drawing);
            default: return null;
        }
    }

    function pointRefs(drawing) {
        switch (drawing.type) {
            case 'trendline': return drawing.points;
            case 'fibonacci':
            case 'zone': return [drawing.from, drawing.to];
            default: return [drawing];
        }
    }

    function snapshot() {
        return JSON.stringify(items.map(function (item) { return item.drawing; }));
    }

    function persist(serialized) {
        try {
            localStorage.setItem(storageKey(), serialized);
        } catch (e) {
            return;
        }
    }

    function record() {
        const serialized = snapshot();
        if (history[history.length - 1] === serialized) return serialized;
        history.push(serialized);
        if (history.length > HISTORY_LIMIT) history.shift();
        future = [];
        return serialized;
    }

    function save() {
        persist(record());
    }

    function attach(drawing) {
        const primitive = createPrimitive(drawing);
        if (!primitive) return null;
        App.chartCore.attachPrimitive(primitive);
        const item = { id: nextId++, drawing: drawing, primitive: primitive };
        items.push(item);
        return item;
    }

    function detachAll() {
        items.forEach(function (item) { App.chartCore.detachPrimitive(item.primitive); });
        items = [];
        selected = null;
    }

    function restore(serialized) {
        detachAll();
        JSON.parse(serialized).forEach(attach);
        persist(serialized);
    }

    App.manualDrawings = {
        load: function () {
            detachAll();
            try {
                JSON.parse(localStorage.getItem(storageKey()) || '[]').forEach(attach);
            } catch (e) {
                detachAll();
            }
            history = [snapshot()];
            future = [];
        },

        undo: function () {
            if (history.length < 2) return false;
            future.push(history.pop());
            restore(history[history.length - 1]);
            return true;
        },

        redo: function () {
            if (!future.length) return false;
            history.push(future.pop());
            restore(history[history.length - 1]);
            return true;
        },

        copy: function (item) {
            if (!item) return false;
            clipboard = JSON.stringify(item.drawing);
            return true;
        },

        hasClipboard: function () {
            return clipboard !== null;
        },

        paste: function () {
            if (clipboard === null) return null;
            const item = attach(JSON.parse(clipboard));
            if (!item) return null;
            const first = pointRefs(item.drawing)[0];
            App.manualDrawings.moveBy(item, App.timeframeStep() * PASTE_OFFSET_BARS, first.price * PASTE_OFFSET_PRICE);
            clipboard = JSON.stringify(item.drawing);
            App.manualDrawings.commit(item);
            return item;
        },

        add: function (drawing) {
            const item = attach(drawing);
            return item;
        },

        commit: function (item) {
            App.manualDrawings.select(item);
            save();
        },

        remove: function (item) {
            if (!item) return;
            App.chartCore.detachPrimitive(item.primitive);
            items = items.filter(function (i) { return i !== item; });
            if (selected === item) selected = null;
            save();
        },

        removeSelected: function () {
            if (!selected) return false;
            App.manualDrawings.remove(selected);
            return true;
        },

        clear: function () {
            detachAll();
            save();
        },

        count: function () {
            return items.length;
        },

        selected: function () {
            return selected;
        },

        select: function (item) {
            if (selected && selected !== item) {
                selected.primitive.selected = false;
                selected.primitive.refresh();
            }
            selected = item || null;
            if (selected) {
                selected.primitive.selected = true;
                selected.primitive.refresh();
            }
        },

        hit: function (x, y) {
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].primitive.hitTest(x, y)) return items[i];
            }
            return null;
        },

        anchorAt: function (item, x, y) {
            if (item.drawing.type === 'horizontal') return -1;
            return item.primitive.anchors().findIndex(function (anchor) {
                return Math.hypot(anchor.x - x, anchor.y - y) <= ANCHOR_TOLERANCE;
            });
        },

        setAnchor: function (item, index, point) {
            const ref = pointRefs(item.drawing)[index];
            ref.time = point.time;
            ref.price = point.price;
            item.primitive.refresh();
        },

        moveBy: function (item, deltaTime, deltaPrice) {
            pointRefs(item.drawing).forEach(function (ref) {
                ref.price += deltaPrice;
                if (ref.time !== undefined) ref.time += deltaTime;
            });
            item.primitive.refresh();
        },

        save: save
    };
})(window.App);
