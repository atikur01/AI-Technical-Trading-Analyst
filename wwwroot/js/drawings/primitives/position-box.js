(function (App) {
    const BOX_BARS = 30;
    const UP = '#22c997';
    const DOWN = '#f6465d';

    class PositionBoxPrimitive extends App.BasePrimitive {
        draw(ctx) {
            const d = this.drawing;
            const x1 = this.x(d.time);
            const x2 = this.x(d.time + BOX_BARS * App.timeframeStep());
            const entryY = this.y(d.entry);
            const stopY = this.y(d.stopLoss);
            const targetY = this.y(d.takeProfit);
            if (x1 == null || x2 == null || entryY == null || stopY == null || targetY == null) return;

            const width = x2 - x1;
            const risk = Math.abs(d.entry - d.stopLoss);
            const reward = Math.abs(d.takeProfit - d.entry);
            const rr = risk > 0 ? (reward / risk).toFixed(2) : '--';

            ctx.save();
            ctx.fillStyle = this.rgba(UP, 0.22);
            ctx.fillRect(x1, Math.min(entryY, targetY), width, Math.abs(targetY - entryY));
            ctx.fillStyle = this.rgba(DOWN, 0.22);
            ctx.fillRect(x1, Math.min(entryY, stopY), width, Math.abs(stopY - entryY));
            ctx.strokeStyle = this.rgba('#d1d4dc', 0.9);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1, entryY);
            ctx.lineTo(x2, entryY);
            ctx.stroke();
            ctx.restore();

            this.drawLabel(ctx, 'TP ' + App.format.price(d.takeProfit), x1 + 4, targetY + (targetY < entryY ? 11 : -11), UP, 'left');
            this.drawLabel(ctx, 'SL ' + App.format.price(d.stopLoss), x1 + 4, stopY + (stopY < entryY ? 11 : -11), DOWN, 'left');
            this.drawLabel(ctx, 'Entry ' + App.format.price(d.entry) + '  RR ' + rr, x1 + 4, entryY, '#4f7cff', 'left');
        }
    }

    App.PositionBoxPrimitive = PositionBoxPrimitive;
})(window.App);
