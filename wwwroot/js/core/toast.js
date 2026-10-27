(function ($, App) {
    const kinds = {
        info: { icon: 'i', color: 'bg-tv-accent' },
        success: { icon: '✓', color: 'bg-tv-up' },
        error: { icon: '!', color: 'bg-tv-down' },
        warning: { icon: '!', color: 'bg-yellow-500' }
    };
    const DISPLAY_MS = 4500;
    const FADE_MS = 200;

    App.toast = {
        show: function (message, type) {
            const kind = kinds[type] || kinds.info;
            const $icon = $('<span class="toast-icon" aria-hidden="true"></span>').addClass(kind.color).text(kind.icon);
            const $text = $('<span class="min-w-0 flex-1 break-words"></span>').text(message);
            const $toast = $('<div role="status" class="toast"></div>').append($icon, $text);

            $('#toast-container').append($toast);
            setTimeout(function () {
                $toast.fadeOut(FADE_MS, function () {
                    $toast.remove();
                });
            }, DISPLAY_MS);
        }
    };
})(jQuery, window.App);
