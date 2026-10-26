(function (App) {
    const ANCHOR_TOLERANCE = 9;
    const STORAGE_PREFIX = 'manualDrawings:';

    let items = [];
    let selected = null;
    let nextId = 1;

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

    function save() {
        try {
            localStorage.setItem(storageKey(), JSON.stringify(items.map(function (item) { return item.drawing; })));
        } catch (e) {
            return;
        }
    }

    function attach(drawing) {
        const primitive = createPrimitive(drawing);
        if (!primitive) return null;
        App.chartCore.attachPrimitive(primitive);
        const item = { id: nextId++, drawing: drawing, primitive: primitive };
        items.push(item);
        return item;
    }

    App.manualDrawings = {
        load: function () {
            try {
                const stored = JSON.parse(localStorage.getItem(storageKey()) || '[]');
                stored.forEach(attach);
            } catch (e) {
                return;
            }
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
            items.slice().forEach(function (item) {
                App.chartCore.detachPrimitive(item.primitive);
            });
            items = [];
            selected = null;
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
