(function ($, App) {
    function describeError(xhr) {
        const problem = xhr.responseJSON;
        if (problem && (problem.title || problem.detail)) {
            return problem.detail || problem.title;
        }
        if (xhr.status === 0) {
            return 'Network error. Please check your connection.';
        }
        return 'Request failed (' + xhr.status + ').';
    }

    function request(options) {
        const deferred = $.Deferred();
        $.ajax(options)
            .done(function (data) {
                deferred.resolve(data);
            })
            .fail(function (xhr) {
                deferred.reject(new Error(describeError(xhr)));
            });
        return deferred.promise();
    }

    App.api = {
        get: function (url, params) {
            return request({ url: url, method: 'GET', data: params, dataType: 'json' });
        },
        post: function (url, body) {
            return request({
                url: url,
                method: 'POST',
                data: JSON.stringify(body),
                contentType: 'application/json',
                dataType: 'json'
            });
        }
    };
})(jQuery, window.App);
