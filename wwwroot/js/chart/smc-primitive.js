(function (App) {
    const BULL = '#089981';
    const BEAR = '#f23645';
    const BULL_BLOCK = '#1848cc';
    const BEAR_BLOCK = '#b22833';
    const SWING_FONT = '600 11px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
    const INTERNAL_FONT = '500 9px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';

    class SmcPrimitive extends App.BasePrimitive {
        constructor() {
            super(null);
            this.result = null;
        }

        setResult(result) {
            this.result = result;
            this.refresh();
        }

        timeAt(index) {
            return App.state.candles[index].time;
        }

        xAt(index) {
            return this.x(this.timeAt(index));
        }

        drawZone(ctx, zone, width, color, opacity) {
            const left = this.xAt(zone.index);
            const right = zone.end === null ? width : this.xAt(zone.end);
            const top = this.y(zone.top);
            const bottom = this.y(zone.bottom);
            if (left == null || right == null || top == null || bottom == null) return;
            ctx.fillStyle = this.rgba(color, opacity);
            ctx.fillRect(left, top, right - left, bottom - top);
        }

        drawSegment(ctx, x1, x2, y, color, dash) {
            ctx.save();
            ctx.strokeStyle = this.rgba(color, 1);
            ctx.lineWidth = 1;
            ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();
            ctx.restore();
        }

        drawCaption(ctx, text, x, y, color, font, above) {
            ctx.save();
            ctx.font = font;
            ctx.fillStyle = this.rgba(color, 1);
            ctx.textAlign = 'center';
            ctx.textBaseline = above ? 'bottom' : 'top';
            ctx.fillText(text, x, y + (above ? -2 : 2));
            ctx.restore();
        }

        drawStructure(ctx, event) {
            const x1 = this.xAt(event.from);
            const x2 = this.xAt(event.to);
            const y = this.y(event.level);
            if (x1 == null || x2 == null || y == null) return;
            const color = event.bull ? BULL : BEAR;
            this.drawSegment(ctx, x1, x2, y, color, event.internal ? [3, 3] : []);
            this.drawCaption(ctx, event.tag, (x1 + x2) / 2, y, color, event.internal ? INTERNAL_FONT : SWING_FONT, event.bull);
        }

        drawEqualLevel(ctx, equal) {
            const x1 = this.xAt(equal.from);
            const x2 = this.xAt(equal.to);
            const y = this.y(equal.level);
            if (x1 == null || x2 == null || y == null) return;
            const color = equal.isHigh ? BEAR : BULL;
            this.drawSegment(ctx, x1, x2, y, color, [2, 2]);
            this.drawCaption(ctx, equal.isHigh ? 'EQH' : 'EQL', (x1 + x2) / 2, y, color, INTERNAL_FONT, equal.isHigh);
        }

        drawExtreme(ctx, extreme, width) {
            const x = this.xAt(extreme.index);
            const y = this.y(extreme.level);
            if (x == null || y == null) return;
            const color = extreme.isHigh ? BEAR : BULL;
            this.drawSegment(ctx, x, width, y, color, []);
            const label = (extreme.strong ? 'Strong ' : 'Weak ') + (extreme.isHigh ? 'High' : 'Low');
            ctx.save();
            ctx.font = SWING_FONT;
            ctx.fillStyle = this.rgba(color, 1);
            ctx.textAlign = 'right';
            ctx.textBaseline = extreme.isHigh ? 'bottom' : 'top';
            ctx.fillText(label, width - 4, y + (extreme.isHigh ? -2 : 2));
            ctx.restore();
        }

        draw(ctx, size) {
            if (!this.result || !App.state.candles.length) return;
            const result = this.result;
            result.fairValueGaps.forEach((gap) => this.drawZone(ctx, gap, size.width, gap.bull ? BULL : BEAR, 0.2));
            result.orderBlocks.forEach((block) => this.drawZone(ctx, block, size.width, block.bull ? BULL_BLOCK : BEAR_BLOCK, 0.3));
            result.structures.forEach((event) => this.drawStructure(ctx, event));
            result.equalLevels.forEach((equal) => this.drawEqualLevel(ctx, equal));
            result.extremes.forEach((extreme) => this.drawExtreme(ctx, extreme, size.width));
        }
    }

    App.SmcPrimitive = SmcPrimitive;
})(window.App);
