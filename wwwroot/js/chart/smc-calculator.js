(function (App) {
    const SWING_SIZE = 50;
    const INTERNAL_SIZE = 5;
    const EQUAL_SIZE = 3;
    const EQUAL_ATR_FACTOR = 0.1;
    const ATR_PERIOD = 200;
    const HIGH_VOLATILITY_FACTOR = 2;
    const MAX_ORDER_BLOCKS = 3;
    const MAX_FAIR_VALUE_GAPS = 4;
    const MAX_SWING_EVENTS = 6;
    const MAX_INTERNAL_EVENTS = 8;
    const MAX_EQUAL_LEVELS = 4;
    const ZONE_EDGE = 0.05;
    const EQUILIBRIUM_EDGE = 0.025;

    function atr(candles) {
        const result = new Array(candles.length).fill(NaN);
        let value = 0;
        for (let i = 1; i < candles.length; i++) {
            const c = candles[i];
            const range = Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close));
            if (i < ATR_PERIOD) {
                value += range / ATR_PERIOD;
            } else {
                value = i === ATR_PERIOD ? value + range / ATR_PERIOD : (value * (ATR_PERIOD - 1) + range) / ATR_PERIOD;
                result[i] = value;
            }
        }
        return result;
    }

    function parsedBars(candles, atrValues) {
        const highs = new Array(candles.length);
        const lows = new Array(candles.length);
        candles.forEach(function (c, i) {
            const volatile = c.high - c.low >= HIGH_VOLATILITY_FACTOR * atrValues[i];
            highs[i] = volatile ? c.low : c.high;
            lows[i] = volatile ? c.high : c.low;
        });
        return { highs: highs, lows: lows };
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

    function extremeIndex(values, from, to, isMin) {
        let best = from;
        for (let j = from + 1; j < to; j++) {
            if (isMin ? values[j] < values[best] : values[j] > values[best]) best = j;
        }
        return best;
    }

    function mitigatedAt(candles, from, isBroken) {
        for (let j = from; j < candles.length; j++) {
            if (isBroken(candles[j])) return j;
        }
        return null;
    }

    function structure(candles, size, internal, parsed, swing) {
        const found = pivots(candles, size);
        const pivotsByBar = {};
        found.forEach(function (pivot) { pivotsByBar[pivot.confirmedAt] = pivot; });

        const events = [];
        const orderBlocks = [];
        const highLevels = new Array(candles.length).fill(null);
        const lowLevels = new Array(candles.length).fill(null);
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
            const anchor = bull ? extremeIndex(parsed.lows, pivot.index, i, true) : extremeIndex(parsed.highs, pivot.index, i, false);
            const top = parsed.highs[anchor];
            const bottom = parsed.lows[anchor];
            orderBlocks.push({
                index: anchor,
                top: top,
                bottom: bottom,
                bull: bull,
                internal: internal,
                end: mitigatedAt(candles, i, function (c) { return bull ? c.low < bottom : c.high > top; })
            });
        }

        for (let i = size; i < candles.length; i++) {
            const pivot = pivotsByBar[i];
            if (pivot) state[pivot.isHigh ? 'high' : 'low'] = { index: pivot.index, level: pivot.level, crossed: false };
            highLevels[i] = state.high ? state.high.level : null;
            lowLevels[i] = state.low ? state.low.level : null;

            const distinctHigh = !swing || highLevels[i] !== swing.highLevels[i];
            const distinctLow = !swing || lowLevels[i] !== swing.lowLevels[i];
            if (state.high && !state.high.crossed && candles[i].close > state.high.level && distinctHigh) cross(i, 'high');
            if (state.low && !state.low.crossed && candles[i].close < state.low.level && distinctLow) cross(i, 'low');
        }

        return { events: events, orderBlocks: orderBlocks, trend: state.trend, pivots: found, highLevels: highLevels, lowLevels: lowLevels };
    }

    function equalLevels(candles, atrValues) {
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

    function trailingRange(candles, swing) {
        const pivotsByBar = {};
        swing.pivots.forEach(function (pivot) { pivotsByBar[pivot.confirmedAt] = pivot; });
        let top = null;
        let bottom = null;
        candles.forEach(function (c, i) {
            if (top) top = { index: c.high >= top.level ? i : top.index, level: Math.max(top.level, c.high) };
            if (bottom) bottom = { index: c.low <= bottom.level ? i : bottom.index, level: Math.min(bottom.level, c.low) };
            const pivot = pivotsByBar[i];
            if (!pivot) return;
            if (pivot.isHigh) top = { index: pivot.index, level: pivot.level };
            else bottom = { index: pivot.index, level: pivot.level };
        });
        return top && bottom && top.level > bottom.level ? { top: top, bottom: bottom, trend: swing.trend } : null;
    }

    function swingExtremes(range) {
        if (!range) return [];
        return [
            { index: range.top.index, level: range.top.level, isHigh: true, strong: range.trend === -1 },
            { index: range.bottom.index, level: range.bottom.level, isHigh: false, strong: range.trend === 1 }
        ];
    }

    function premiumDiscountZones(range) {
        if (!range) return [];
        const top = range.top.level;
        const bottom = range.bottom.level;
        const span = top - bottom;
        const mid = (top + bottom) / 2;
        const from = Math.min(range.top.index, range.bottom.index);
        return [
            { kind: 'premium', index: from, end: null, top: top, bottom: top - span * ZONE_EDGE },
            { kind: 'equilibrium', index: from, end: null, top: mid + span * EQUILIBRIUM_EDGE, bottom: mid - span * EQUILIBRIUM_EDGE },
            { kind: 'discount', index: from, end: null, top: bottom + span * ZONE_EDGE, bottom: bottom }
        ];
    }

    App.smc = {
        compute: function (candles) {
            if (candles.length <= SWING_SIZE + 1) {
                return { structures: [], orderBlocks: [], equalLevels: [], fairValueGaps: [], extremes: [], zones: [] };
            }

            const atrValues = atr(candles);
            const parsed = parsedBars(candles, atrValues);
            const swing = structure(candles, SWING_SIZE, false, parsed, null);
            const internal = structure(candles, INTERNAL_SIZE, true, parsed, swing);
            const range = trailingRange(candles, swing);

            return {
                structures: swing.events.slice(-MAX_SWING_EVENTS).concat(internal.events.slice(-MAX_INTERNAL_EVENTS)),
                orderBlocks: activeBlocks(internal.orderBlocks).concat(activeBlocks(swing.orderBlocks)),
                equalLevels: equalLevels(candles, atrValues).slice(-MAX_EQUAL_LEVELS),
                fairValueGaps: fairValueGaps(candles),
                extremes: swingExtremes(range),
                zones: premiumDiscountZones(range)
            };
        }
    };
})(window.App);
