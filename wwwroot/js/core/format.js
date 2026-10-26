(function ($, App) {
    function decimalsFor(value) {
        const abs = Math.abs(value);
        if (abs >= 1000) return 2;
        if (abs >= 1) return 4;
        return 6;
    }

    App.format = {
        esc: function (text) {
            return $('<div></div>').text(text == null ? '' : String(text)).html();
        },
        price: function (value) {
            if (value == null || isNaN(value)) return '--';
            const decimals = decimalsFor(value);
            return Number(value).toLocaleString('en-US', {
                minimumFractionDigits: Math.min(2, decimals),
                maximumFractionDigits: decimals
            });
        },
        number: function (value, decimals) {
            if (value == null || isNaN(value)) return '--';
            return Number(value).toLocaleString('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },
        signed: function (value, decimals) {
            if (value == null || isNaN(value)) return '--';
            return (value > 0 ? '+' : '') + App.format.number(value, decimals);
        },
        dateTime: function (seconds) {
            return new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ');
        },
        signClass: function (value) {
            if (value > 0) return 'text-tv-up';
            if (value < 0) return 'text-tv-down';
            return 'text-tv-text';
        }
    };
})(jQuery, window.App);
