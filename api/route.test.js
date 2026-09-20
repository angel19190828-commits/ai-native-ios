const assert = require('node:assert/strict');
const test = require('node:test');

const handler = require('./route');

function response() {
  return { statusCode: 200, headers: {}, body: undefined, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } };
}

test('parses Google protobuf duration', () => {
  assert.equal(handler.parseDuration('1920s'), 1920);
  assert.equal(handler.parseDuration('1.2s'), 2);
  assert.throws(() => handler.parseDuration('32 minutes'));
});

test('returns a typed transit route with derived departure', async (context) => {
  process.env.NODE_ENV = 'test';
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({ ok: true, json: async () => ({ routes: [{ duration: '1920s', distanceMeters: 5100, polyline: { encodedPolyline: 'abc' } }] }) });
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { origin: '1285 W Pender', destination: '555 Burrard', arriveBy: '2026-09-28T10:15:00-07:00' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.route.durationSeconds, 1920);
  assert.equal(res.body.route.departureAt, '2026-09-28T16:43:00.000Z');
});

test('rejects incomplete route input', async () => {
  process.env.NODE_ENV = 'test';
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { destination: '555 Burrard' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'invalid_route_input');
});

