(function (App) {
    const DIMMED_ALPHA = 0.2;
    const FOCUS_BARS_BEFORE = 90;
    const FOCUS_BARS_AFTER = 40;

    let items = [];
    let markers = [];
    let hidden = false;

    function createPrimitive(drawing) {
        switch (drawing.type) {
            case 'trendline': return new App.TrendlinePrimitive(drawing);
            case 'horizontal': return new App.HorizontalLinePrimitive(drawing);
            case 'fibonacci': return new App.FibonacciPrimitive(drawing);
            case 'zone': return new App.ZonePrimitive(drawing);
            case 'projection': return new App.ProjectionPrimitive(drawing);
            case 'position': return new App.PositionBoxPrimitive(drawing);
            default: return null;
        }
    }

    function toMarker(drawing) {
        const isUp = drawing.shape === 'arrowUp';
        const isDown = drawing.shape === 'arrowDown';
        return {
            time: drawing.time,
            position: drawing.position === 'below' ? 'belowBar' : 'aboveBar',
            shape: drawing.shape,
            color: isUp ? '#26a69a' : isDown ? '#ef5350' : '#f7a600',
            text: drawing.text || ''
        };
    }

    function applyVisibility() {
        items.forEach(function (item) {
            item.primitive.setState({ visible: !hidden });
        });
        App.chartCore.setMarkers('ai', hidden ? [] : markers);
    }

    App.drawingRenderer = {
        render: function (drawings) {
            App.drawingRenderer.clear();
            hidden = false;

            drawings.forEach(function (drawing) {
                if (drawing.type === 'marker') {
                    markers.push(toMarker(drawing));
                    return;
                }
                const primitive = createPrimitive(drawing);
                if (!primitive) return;
                App.chartCore.attachPrimitive(primitive);
                items.push({ drawing: drawing, primitive: primitive });
            });

            applyVisibility();

            const projection = drawings.find(function (drawing) { return drawing.type === 'projection'; });
            if (projection) App.chartCore.showFutureBars(projection.candles.length);
        },

        clear: function () {
            items.forEach(function (item) {
                App.chartCore.detachPrimitive(item.primitive);
            });
            items = [];
            markers = [];
            App.chartCore.clearMarkers('ai');
            $(document).trigger('drawings:changed');
        },

        hasDrawings: function () {
            return items.length > 0 || markers.length > 0;
        },

        isHidden: function () {
            return hidden;
        },

        toggle: function () {
            hidden = !hidden;
            applyVisibility();
            return hidden;
        },

        highlight: function (setupId) {
            items.forEach(function (item) {
                const belongsElsewhere = setupId && item.drawing.setupId && item.drawing.setupId !== setupId;
                item.primitive.setState({ alpha: belongsElsewhere ? DIMMED_ALPHA : 1 });
            });

            if (!setupId) return;
            const position = items.find(function (item) {
                return item.drawing.type === 'position' && item.drawing.setupId === setupId;
            });
            if (position) {
                App.chartCore.focusTime(position.drawing.time, FOCUS_BARS_BEFORE, FOCUS_BARS_AFTER);
            }
        }
    };
})(window.App);
