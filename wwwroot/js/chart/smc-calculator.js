(function (App) {
    const SWING_SIZE = 50;
    const INTERNAL_SIZE = 5;
    const EQUAL_SIZE = 3;
    const EQUAL_ATR_FACTOR = 0.1;
    const ATR_PERIOD = 200;
    const MAX_ORDER_BLOCKS = 3;
    const MAX_FAIR_VALUE_GAPS = 4;
    const MAX_SWING_EVENTS = 6;
    const MAX_INTERNAL_EVENTS = 8;
    const MAX_EQUAL_LEVELS = 4;

    function atr(candles) {
        const result = new Array(candles.length).fill(0);
        let value = 0;
        for (let i = 0; i < candles.length; i++) {
            const c = candles[i];
            const range = i === 0
                ? c.high - c.low
                : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close));
            value = i < ATR_PERIOD ? (value * i + range) / (i + 1) : (value * (ATR_PERIOD - 1) + range) / ATR_PERIOD;
            result[i] = value;
        }
        return result;
    }

    function pivots(candles, size) {
        const found = [];
        let leg = 0;
        for (let i = size; i < candles.length; i++) {
            const p = i - size;
            let highest = -Infinity;
            let lowest = Infinity;
            for (let j = p + 1; j <= i; j++) {
                highest = Math.max(highest, candles[j].high);
                lowest = Math.min(lowest, candles[j].low);
            }
            const next = candles[p].high > highest ? 0 : candles[p].low < lowest ? 1 : leg;
            if (next !== leg) {
                const isLow = next === 1;
                found.push({ index: p, confirmedAt: i, isHigh: !isLow, level: isLow ? candles[p].low : candles[p].high });
            }
            leg = next;
        }
        return found;
    }

    function extremeIndex(candles, from, to, isHigh) {
        let best = from;
        for (let j = from; j < to; j++) {
            if (isHigh ? candles[j].high >= candles[best].high : candles[j].low <= candles[best].low) best = j;
        }
        return best;
    }

    function mitigatedAt(candles, from, isBroken) {
        for (let j = from; j < candles.length; j++) {
            if (isBroken(candles[j])) return j;
        }
        return null;
    }

    function structure(candles, size, internal) {
        const pivotsByBar = {};
        pivots(candles, size).forEach(function (pivot) { pivotsByBar[pivot.confirmedAt] = pivot; });

        const events = [];
        const orderBlocks = [];
        const state = { high: null, low: null, trend: 0 };

        function cross(i, side) {
            const pivot = state[side];
            const bull = side === 'high';
            pivot.crossed = true;
            events.push({
                from: pivot.index,
                to: i,
                level: pivot.level,
                bull: bull,
                tag: state.trend === (bull ? -1 : 1) ? 'CHoCH' : 'BOS',
                internal: internal
            });
            state.trend = bull ? 1 : -1;
            const anchor = extremeIndex(candles, pivot.index, i, !bull);
            const block = candles[anchor];
            orderBlocks.push({
                index: anchor,
                top: block.high,
                bottom: block.low,
                bull: bull,
                internal: internal,
                end: mitigatedAt(candles, i + 1, function (c) { return bull ? c.close < block.low : c.close > block.high; })
            });
        }

        for (let i = size; i < candles.length; i++) {
            const pivot = pivotsByBar[i];
            if (pivot) state[pivot.isHigh ? 'high' : 'low'] = { index: pivot.index, level: pivot.level, crossed: false };
            if (state.high && !state.high.crossed && candles[i].close > state.high.level) cross(i, 'high');
            if (state.low && !state.low.crossed && candles[i].close < state.low.level) cross(i, 'low');
        }

        return { events: events, orderBlocks: orderBlocks, trend: state.trend, high: state.high, low: state.low };
    }

    function equalLevels(candles) {
        const atrValues = atr(candles);
        const last = { high: null, low: null };
        const equals = [];
        pivots(candles, EQUAL_SIZE).forEach(function (pivot) {
            const side = pivot.isHigh ? 'high' : 'low';
            const previous = last[side];
            if (previous && Math.abs(previous.level - pivot.level) < EQUAL_ATR_FACTOR * atrValues[pivot.confirmedAt]) {
                equals.push({ from: previous.index, to: pivot.index, level: (previous.level + pivot.level) / 2, isHigh: pivot.isHigh });
            }
            last[side] = pivot;
        });
        return equals;
    }

    function fairValueGaps(candles) {
        const gaps = [];
        let deltaSum = 0;
        for (let i = 2; i < candles.length; i++) {
            const middle = candles[i - 1];
            const delta = Math.abs(middle.close - middle.open) / middle.open * 100;
            deltaSum += delta;
            const threshold = (deltaSum / (i - 1)) * 2;
            if (delta <= threshold) continue;

            const first = candles[i - 2];
            const current = candles[i];
            if (current.low > first.high && middle.close > first.high) {
                const bottom = first.high;
                gaps.push({ index: i - 1, top: current.low, bottom: bottom, bull: true, end: mitigatedAt(candles, i + 1, function (c) { return c.low < bottom; }) });
            } else if (current.high < first.low && middle.close < first.low) {
                const top = first.low;
                gaps.push({ index: i - 1, top: top, bottom: current.high, bull: false, end: mitigatedAt(candles, i + 1, function (c) { return c.high > top; }) });
            }
        }
        return gaps.filter(function (gap) { return gap.end === null; }).slice(-MAX_FAIR_VALUE_GAPS);
    }

    function activeBlocks(blocks) {
        return blocks.filter(function (block) { return block.end === null; }).slice(-MAX_ORDER_BLOCKS);
    }

    function swingExtremes(swing) {
        const extremes = [];
        if (swing.high) extremes.push({ index: swing.high.index, level: swing.high.level, isHigh: true, strong: swing.trend === -1 });
        if (swing.low) extremes.push({ index: swing.low.index, level: swing.low.level, isHigh: false, strong: swing.trend === 1 });
        return extremes;
    }

    App.smc = {
        compute: function (candles, show) {
            const empty = { structures: [], orderBlocks: [], equalLevels: [], fairValueGaps: [], extremes: [] };
            if (candles.length <= SWING_SIZE + 1) return empty;
            const swing = show.swing ? structure(candles, SWING_SIZE, false) : null;
            const internal = show.internal || show.zones ? structure(candles, INTERNAL_SIZE, true) : null;
            return {
                structures: (swing ? swing.events.slice(-MAX_SWING_EVENTS) : [])
                    .concat(show.internal ? internal.events.slice(-MAX_INTERNAL_EVENTS) : []),
                orderBlocks: show.zones ? activeBlocks(internal.orderBlocks) : empty.orderBlocks,
                equalLevels: show.equal ? equalLevels(candles).slice(-MAX_EQUAL_LEVELS) : empty.equalLevels,
                fairValueGaps: show.zones ? fairValueGaps(candles) : empty.fairValueGaps,
                extremes: swing ? swingExtremes(swing) : empty.extremes
            };
        }
    };
})(window.App);
