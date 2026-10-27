(function (App) {
    const KINDS = {
        supply: { color: '#f6465d', name: 'Supply' },
        demand: { color: '#22c997', name: 'Demand' },
        fvg: { color: '#7e57c2', name: 'FVG' },
        orderblock: { color: '#ff9800', name: 'Order Block' },
        custom: { color: '#4f7cff', name: '' }
    };

    class ZonePrimitive extends App.BasePrimitive {
        bounds(width) {
            const d = this.drawing;
            const a = this.point(d.from);
            const b = this.point(d.to);
            if (!a || !b) return null;

            const left = Math.max(0, Math.min(a.x, b.x));
            const right = d.bounded ? Math.max(a.x, b.x) : Math.max(width, a.x, b.x);
            return { left: left, right: right, top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) };
        }

        draw(ctx, size) {
            const d = this.drawing;
            const kind = KINDS[d.kind] || KINDS.demand;
            const box = this.bounds(size.width);
            if (!box) return;

            ctx.save();
            ctx.fillStyle = this.rgba(kind.color, 0.16);
            ctx.fillRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
            ctx.strokeStyle = this.rgba(kind.color, 0.8);
            ctx.lineWidth = 1;
            ctx.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);
            ctx.restore();

            const text = d.label || kind.name;
            if (text) this.drawText(ctx, text, box.left + 6, box.top + 11, kind.color);
        }

        anchors() {
            return [this.drawing.from, this.drawing.to].map((p) => this.point(p)).filter(Boolean);
        }

        hitTest(x, y) {
            const box = this.bounds(App.chartCore.plotWidth());
            return !!box && x >= box.left - 4 && x <= box.right + 4 && y >= box.top - 4 && y <= box.bottom + 4;
        }
    }

    App.ZonePrimitive = ZonePrimitive;
})(window.App);
