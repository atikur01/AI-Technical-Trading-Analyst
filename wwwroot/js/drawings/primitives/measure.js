(function (App) {
    class MeasurePrimitive extends App.BasePrimitive {
        draw(ctx) {
            const d = this.drawing;
            const a = this.point(d.from);
            const b = this.point(d.to);
            if (!a || !b) return;

            const up = d.to.price >= d.from.price;
            const color = up ? '#26a69a' : '#ef5350';
            const diff = d.to.price - d.from.price;
            const percent = d.from.price ? (diff / d.from.price) * 100 : 0;
            const step = App.timeframeStep();
            const bars = Math.round((d.to.time - d.from.time) / step);
            const seconds = Math.abs(d.to.time - d.from.time);
            const text = App.format.signed(diff, 2) + ' (' + App.format.signed(percent, 2) + '%)  ' + bars + ' bars  ' + this.duration(seconds);

            const left = Math.min(a.x, b.x);
            const top = Math.min(a.y, b.y);

            ctx.save();
            ctx.fillStyle = this.rgba(color, 0.15);
            ctx.fillRect(left, top, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
            ctx.strokeStyle = this.rgba(color, 0.9);
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(left, top, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.restore();

            this.drawLabel(ctx, text, (a.x + b.x) / 2 - 80, up ? top - 14 : top + Math.abs(b.y - a.y) + 14, color, 'left');
        }

        duration(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return (days ? days + 'd ' : '') + (hours ? hours + 'h ' : '') + (minutes || (!days && !hours) ? minutes + 'm' : '');
        }
    }

    App.MeasurePrimitive = MeasurePrimitive;
})(window.App);
