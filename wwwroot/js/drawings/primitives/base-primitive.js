(function (App) {
    const FONT = '12px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';

    class BasePrimitive {
        constructor(drawing) {
            this.drawing = drawing;
            this.visible = true;
            this.alpha = 1;
            this.selected = false;
            this._requestUpdate = null;
            const self = this;
            this._paneView = {
                zOrder: function () { return 'normal'; },
                renderer: function () {
                    return {
                        draw: function (target) {
                            target.useMediaCoordinateSpace(function (scope) {
                                if (!self.visible) return;
                                self.draw(scope.context, scope.mediaSize);
                                if (self.selected) self.drawAnchors(scope.context);
                            });
                        }
                    };
                }
            };
        }

        attached(params) {
            this._requestUpdate = params.requestUpdate;
        }

        detached() {
            this._requestUpdate = null;
        }

        updateAllViews() {}

        paneViews() {
            return [this._paneView];
        }

        setState(state) {
            if (state.visible !== undefined) this.visible = state.visible;
            if (state.alpha !== undefined) this.alpha = state.alpha;
            this.refresh();
        }

        refresh() {
            if (this._requestUpdate) this._requestUpdate();
        }

        x(time) {
            return App.chartCore.timeToX(time);
        }

        y(price) {
            return App.chartCore.priceToY(price);
        }

        rgba(hex, opacity) {
            const value = hex.replace('#', '');
            const r = parseInt(value.substring(0, 2), 16);
            const g = parseInt(value.substring(2, 4), 16);
            const b = parseInt(value.substring(4, 6), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + (opacity * this.alpha).toFixed(3) + ')';
        }

        drawLabel(ctx, text, x, y, color, align) {
            ctx.save();
            ctx.font = FONT;
            const width = ctx.measureText(text).width + 8;
            const left = align === 'right' ? x - width : x;
            ctx.fillStyle = this.rgba(color, 0.9);
            ctx.fillRect(left, y - 9, width, 18);
            ctx.fillStyle = 'rgba(255,255,255,' + this.alpha.toFixed(3) + ')';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, left + 4, y);
            ctx.restore();
        }

        drawText(ctx, text, x, y, color, align) {
            ctx.save();
            ctx.font = FONT;
            ctx.textAlign = align || 'left';
            ctx.fillStyle = this.rgba(color, 1);
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x, y);
            ctx.restore();
        }

        draw() {}

        anchors() {
            return [];
        }

        hitTest() {
            return false;
        }

        drawAnchors(ctx) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#4f7cff';
            ctx.lineWidth = 2;
            this.anchors().forEach(function (anchor) {
                ctx.beginPath();
                ctx.arc(anchor.x, anchor.y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
            ctx.restore();
        }

        point(p) {
            const x = this.x(p.time);
            const y = this.y(p.price);
            return x == null || y == null ? null : { x: x, y: y };
        }

        distanceToSegment(px, py, x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const lengthSquared = dx * dx + dy * dy;
            const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
            return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
        }
    }

    App.BasePrimitive = BasePrimitive;
})(window.App);
