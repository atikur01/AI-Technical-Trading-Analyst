(function (App) {
    const HIT_TOLERANCE = 6;

    class TrendlinePrimitive extends App.BasePrimitive {
        segment(width) {
            const d = this.drawing;
            const a = this.point(d.points[0]);
            const b = this.point(d.points[1]);
            if (!a || !b) return null;

            let endX = b.x;
            let endY = b.y;
            if (d.extend === 'right' && a.x !== b.x) {
                endX = Math.max(width, b.x);
                endY = b.y + ((b.y - a.y) / (b.x - a.x)) * (endX - b.x);
            }
            return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, endX: endX, endY: endY };
        }

        draw(ctx, size) {
            const d = this.drawing;
            const s = this.segment(size.width);
            if (!s) return;

            ctx.save();
            ctx.strokeStyle = this.rgba(d.color, 1);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.endX, s.endY);
            ctx.stroke();
            ctx.restore();

            if (d.label) {
                this.drawLabel(ctx, d.label, Math.min(s.x2, size.width - 4), s.y2 - 14, d.color, 'right');
            }
        }

        anchors() {
            return this.drawing.points.map((p) => this.point(p)).filter(Boolean);
        }

        hitTest(x, y) {
            const s = this.segment(App.chartCore.plotWidth());
            return !!s && this.distanceToSegment(x, y, s.x1, s.y1, s.endX, s.endY) <= HIT_TOLERANCE;
        }
    }

    App.TrendlinePrimitive = TrendlinePrimitive;
})(window.App);
