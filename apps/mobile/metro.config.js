const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const http = require('node:http');

const config = getSentryExpoConfig(__dirname, {
  includeWebReplay: false,
});

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const nextMiddleware = enhanceMiddleware(middleware, metroServer);
  return (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return nextMiddleware(req, res, next);
    const traceId = `metro-${Date.now().toString(36)}`;
    console.log(`[browser-api] ${traceId} received ${req.method} ${req.url}`);
    const proxy = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:3000' },
    }, (proxyResponse) => {
      let responseBytes = 0;
      proxyResponse.on('data', (chunk) => { responseBytes += chunk.length; });
      proxyResponse.on('end', () => console.log(`[browser-api] ${traceId} upstream ${proxyResponse.statusCode} ${responseBytes}b`));
      res.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(res);
    });
    proxy.on('error', (error) => {
      console.error(`[browser-api] ${traceId} proxy_error ${error.code ?? error.name}`);
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'local_api_unavailable' } }));
    });
    req.pipe(proxy);
  };
};

module.exports = config;
