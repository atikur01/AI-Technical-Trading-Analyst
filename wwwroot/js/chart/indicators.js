(function (App) {
    function toSeries(candles, values) {
        const series = [];
        for (let i = 0; i < candles.length; i++) {
            if (values[i] != null && !isNaN(values[i])) {
                series.push({ time: candles[i].time, value: values[i] });
            }
        }
        return series;
    }

    function sma(values, period) {
        const result = new Array(values.length).fill(null);
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            sum += values[i];
            if (i >= period) sum -= values[i - period];
            if (i >= period - 1) result[i] = sum / period;
        }
        return result;
    }

    function ema(values, period) {
        const result = new Array(values.length).fill(null);
        const multiplier = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < values.length; i++) {
            if (i < period) {
                sum += values[i];
                if (i === period - 1) result[i] = sum / period;
            } else {
                result[i] = (values[i] - result[i - 1]) * multiplier + result[i - 1];
            }
        }
        return result;
    }

    function emaSparse(values, period) {
        const start = values.findIndex(function (v) { return v != null; });
        const result = new Array(values.length).fill(null);
        if (start < 0) return result;
        const dense = ema(values.slice(start), period);
        for (let i = 0; i < dense.length; i++) result[start + i] = dense[i];
        return result;
    }

    function rsi(closes, period) {
        const result = new Array(closes.length).fill(null);
        if (closes.length <= period) return result;
        let gain = 0;
        let loss = 0;
        for (let i = 1; i <= period; i++) {
            const change = closes[i] - closes[i - 1];
            gain += Math.max(change, 0);
            loss += Math.max(-change, 0);
        }
        gain /= period;
        loss /= period;
        const value = function () { return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss); };
        result[period] = value();
        for (let i = period + 1; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            gain = (gain * (period - 1) + Math.max(change, 0)) / period;
            loss = (loss * (period - 1) + Math.max(-change, 0)) / period;
            result[i] = value();
        }
        return result;
    }

    App.indicators = {
        ema: function (candles, period) {
            return toSeries(candles, ema(candles.map(function (c) { return c.close; }), period));
        },
        bollinger: function (candles, period, deviations) {
            const closes = candles.map(function (c) { return c.close; });
            const middle = sma(closes, period);
            const upper = new Array(closes.length).fill(null);
            const lower = new Array(closes.length).fill(null);
            for (let i = period - 1; i < closes.length; i++) {
                let variance = 0;
                for (let j = i - period + 1; j <= i; j++) variance += Math.pow(closes[j] - middle[i], 2);
                const deviation = Math.sqrt(variance / period) * deviations;
                upper[i] = middle[i] + deviation;
                lower[i] = middle[i] - deviation;
            }
            return { upper: toSeries(candles, upper), middle: toSeries(candles, middle), lower: toSeries(candles, lower) };
        },
        vwap: function (candles) {
            const values = [];
            let priceVolume = 0;
            let volume = 0;
            let day = null;
            candles.forEach(function (c) {
                const currentDay = Math.floor(c.time / 86400);
                if (currentDay !== day) {
                    day = currentDay;
                    priceVolume = 0;
                    volume = 0;
                }
                const typical = (c.high + c.low + c.close) / 3;
                priceVolume += typical * c.volume;
                volume += c.volume;
                values.push(volume > 0 ? priceVolume / volume : typical);
            });
            return toSeries(candles, values);
        },
        rsi: function (candles, period) {
            return toSeries(candles, rsi(candles.map(function (c) { return c.close; }), period));
        },
        macd: function (candles, fast, slow, signalPeriod) {
            const closes = candles.map(function (c) { return c.close; });
            const fastEma = ema(closes, fast);
            const slowEma = ema(closes, slow);
            const line = closes.map(function (_, i) {
                return fastEma[i] != null && slowEma[i] != null ? fastEma[i] - slowEma[i] : null;
            });
            const signal = emaSparse(line, signalPeriod);
            const histogram = line.map(function (v, i) {
                return v != null && signal[i] != null ? v - signal[i] : null;
            });
            return {
                line: toSeries(candles, line),
                signal: toSeries(candles, signal),
                histogram: toSeries(candles, histogram).map(function (point) {
                    return { time: point.time, value: point.value, color: point.value >= 0 ? '#26a69a' : '#ef5350' };
                })
            };
        }
    };
})(window.App);
