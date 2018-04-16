const url = require('url');

module.exports = (logger, metrics, timers, buckets = [], whitelist = null) => {
    const [start = 5, width = 5, number = 5] = buckets;

    function logRequest(uri, method) {
        logger.info('http.request', { uri });
    }

    function logResponse(uri, method, duration, res, requestId, sessionId) {
        const { statusCode } = res;

        metrics.counter({
            name: 'response_count',
            help: 'Total response count by HTTP status',
            labels: {
                statusCode,
            },
        });

        if (isInWhitelist(uri) && res.statusCode !== 404) {
            metrics.histogram({
                name: 'response_time_milliseconds',
                help: 'Response time duration distribution',
                value: duration,
                labels: {
                    uri,
                    method,
                },
                buckets: metrics.linearBuckets(start, width, number),
            });
        }

        logger.info('http.response', {
            uri, duration, statusCode, sessionId, requestId,
        });
    }

    function isInWhitelist(uri) {
        return whitelist === null || whitelist.includes(uri);
    }

    return (req, res, next) => {
        const startTimeToken = timers.start();
        const { method } = req;

        logRequest(req.url, method);

        res.on('finish', () => {
            const duration = timers.stop(startTimeToken);
            const route = req.route ? req.route.path : url.parse(req.url).pathname;
            logResponse(route, method, duration, res, req.uuid, req.sessionID);
        });

        next();
    };
};
