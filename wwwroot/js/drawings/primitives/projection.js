(function (App) {
    const DEFAULT_COLOR = '#2962ff';
    const BODY_RATIO = 0.5;

    class ProjectionPrimitive extends App.BasePrimitive {
        draw(ctx) {
            const d = this.drawing;
            const candles = App.state.candles;
            if (!candles.length) return;

            const step = App.timeframeStep();
            const lastCandleTime = candles[candles.length - 1].time;
            const isForming = lastCandleTime + step > Date.now() / 1000;
            const lastTime = isForming ? lastCandleTime - step : lastCandleTime;
            const color = d.color || DEFAULT_COLOR;
            const slots = d.candles.map((c, index) => ({
                x: this.x(lastTime + (index + 1) * step),
                open: this.y(c.open),
                high: this.y(c.high),
                low: this.y(c.low),
                close: this.y(c.close)
            })).filter((s) => s.x != null && s.open != null && s.high != null && s.low != null && s.close != null);
            if (!slots.length) return;

            const spacing = slots.length > 1 ? slots[1].x - slots[0].x : 10;
            const halfBody = Math.max(1, (spacing * BODY_RATIO) / 2);

            ctx.save();
            ctx.strokeStyle = this.rgba(color, 1);
            ctx.fillStyle = this.rgba(color, 0.9);
            ctx.lineWidth = 1.5;
            slots.forEach(function (s) {
                ctx.beginPath();
                ctx.moveTo(s.x, s.high);
                ctx.lineTo(s.x, s.low);
                ctx.stroke();
                const top = Math.min(s.open, s.close);
                ctx.fillRect(s.x - halfBody, top, halfBody * 2, Math.max(1, Math.abs(s.open - s.close)));
            });
            ctx.restore();

            if (d.label) this.drawText(ctx, d.label, slots[0].x, Math.min.apply(null, slots.map((s) => s.high)) - 12, color);
        }
    }

    App.ProjectionPrimitive = ProjectionPrimitive;
})(window.App);
