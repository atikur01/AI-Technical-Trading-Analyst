(function (App) {
    const LEVEL_COLORS = {
        0: '#787b86',
        0.236: '#f6465d',
        0.382: '#ff9800',
        0.5: '#4caf50',
        0.618: '#22c997',
        0.786: '#00bcd4',
        1: '#787b86'
    };

    function levelColor(ratio) {
        return LEVEL_COLORS[ratio] || (ratio > 1 ? '#ab47bc' : '#4f7cff');
    }

    class FibonacciPrimitive extends App.BasePrimitive {
        levelPrice(ratio) {
            const d = this.drawing;
            return d.to.price - (d.to.price - d.from.price) * ratio;
        }

        draw(ctx, size) {
            const d = this.drawing;
            const startX = this.x(Math.min(d.from.time, d.to.time));
            if (startX == null) return;

            const levels = d.levels.map((ratio) => ({ ratio: ratio, y: this.y(this.levelPrice(ratio)), price: this.levelPrice(ratio) }))
                .filter((level) => level.y != null);
            const left = Math.max(0, startX);

            ctx.save();
            for (let i = 0; i < levels.length - 1; i++) {
                ctx.fillStyle = this.rgba(levelColor(levels[i].ratio), 0.08);
                ctx.fillRect(left, Math.min(levels[i].y, levels[i + 1].y), size.width - left, Math.abs(levels[i + 1].y - levels[i].y));
            }
            ctx.restore();

            levels.forEach((level) => {
                const color = levelColor(level.ratio);
                ctx.save();
                ctx.strokeStyle = this.rgba(color, 0.9);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(left, level.y);
                ctx.lineTo(size.width, level.y);
                ctx.stroke();
                ctx.restore();
                this.drawText(ctx, level.ratio + ' (' + App.format.price(level.price) + ')', size.width - 130, level.y - 8, color);
            });

            const fromX = this.x(d.from.time);
            const toX = this.x(d.to.time);
            const fromY = this.y(d.from.price);
            const toY = this.y(d.to.price);
            if (fromX != null && toX != null && fromY != null && toY != null) {
                ctx.save();
                ctx.strokeStyle = this.rgba('#787b86', 0.9);
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
                ctx.restore();
            }

            if (d.label) {
                this.drawLabel(ctx, d.label, left + 4, (levels[0] ? levels[0].y : 20) - 12, '#4f7cff', 'left');
            }
        }
    }

    FibonacciPrimitive.prototype.anchors = function () {
        return [this.drawing.from, this.drawing.to].map((p) => this.point(p)).filter(Boolean);
    };

    FibonacciPrimitive.prototype.hitTest = function (x, y) {
        const d = this.drawing;
        const startX = this.x(Math.min(d.from.time, d.to.time));
        if (startX == null || x < startX - 6) return false;

        const onLevel = d.levels.some((ratio) => {
            const levelY = this.y(this.levelPrice(ratio));
            return levelY != null && Math.abs(y - levelY) <= 6;
        });
        if (onLevel) return true;

        const a = this.point(d.from);
        const b = this.point(d.to);
        return !!a && !!b && this.distanceToSegment(x, y, a.x, a.y, b.x, b.y) <= 6;
    };

    App.FibonacciPrimitive = FibonacciPrimitive;
})(window.App);
