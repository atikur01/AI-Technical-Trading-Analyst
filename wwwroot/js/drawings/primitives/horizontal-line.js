(function (App) {
    const HIT_TOLERANCE = 6;

    class HorizontalLinePrimitive extends App.BasePrimitive {
        draw(ctx, size) {
            const d = this.drawing;
            const y = this.y(d.price);
            if (y == null) return;

            ctx.save();
            ctx.strokeStyle = this.rgba(d.color, 0.9);
            ctx.lineWidth = 1;
            ctx.setLineDash(d.style === 'dashed' ? [6, 4] : []);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size.width, y);
            ctx.stroke();
            ctx.restore();

            const text = (d.label ? d.label + ' ' : '') + App.format.price(d.price);
            this.drawLabel(ctx, text, size.width - 6, y - 11, d.color, 'right');
        }

        anchors() {
            const y = this.y(this.drawing.price);
            return y == null ? [] : [{ x: 24, y: y }];
        }

        hitTest(x, y) {
            const lineY = this.y(this.drawing.price);
            return lineY != null && Math.abs(y - lineY) <= HIT_TOLERANCE;
        }
    }

    App.HorizontalLinePrimitive = HorizontalLinePrimitive;
})(window.App);
