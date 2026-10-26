(function ($, App) {
    const styles = {
        info: 'border-tv-accent',
        success: 'border-tv-up',
        error: 'border-tv-down',
        warning: 'border-yellow-500'
    };

    App.toast = {
        show: function (message, type) {
            const kind = styles[type] ? type : 'info';
            const $toast = $('<div role="status"></div>')
                .addClass('pointer-events-auto rounded-lg border-l-4 bg-tv-panel px-3 py-2 text-sm text-tv-text shadow-lg')
                .addClass(styles[kind])
                .text(message);

            $('#toast-container').append($toast);
            setTimeout(function () {
                $toast.fadeOut(200, function () {
                    $toast.remove();
                });
            }, 4500);
        }
    };
})(jQuery, window.App);
