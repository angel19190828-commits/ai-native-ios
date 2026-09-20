const assert = require('node:assert/strict');
const test = require('node:test');

const handler = require('./plan');

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

const validPlan = {
  title: 'Alex 面试',
  kind: 'appointment',
  startsAt: '2026-09-28T10:30:00-07:00',
  endsAt: '2026-09-28T11:30:00-07:00',
  location: '555 Burrard Street',
  arrivalMinutesEarly: 15,
  preparation: ['携带作品集'],
  missingFields: ['origin'],
  sourceSummary: 'Alex 邀请用户参加面试。',
};

test('rejects missing source before calling the model', async () => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'test-key';
  const res = response();
  await handler({ method: 'POST', headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'invalid_source');
});

test('returns only a validated structured plan', async (context) => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'test-key';
  const originalFetch = global.fetch;
  context.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(validPlan) }] } }] }),
  });
  const res = response();
  await handler({
    method: 'POST',
    headers: {},
    body: { sourceText: 'Interview invitation', timeZone: 'America/Vancouver', locale: 'zh-CN' },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.plan, validPlan);
  assert.equal(typeof res.body.requestId, 'string');
});

test('rejects semantically invalid model output', () => {
  assert.throws(
    () => handler.validatePlan({ ...validPlan, endsAt: validPlan.startsAt }),
    /endsAt must follow startsAt/,
  );
});

test('production requires a bearer token when configured', async () => {
  process.env.NODE_ENV = 'production';
  process.env.MOBILE_API_TOKEN = 'secret';
  process.env.GEMINI_API_KEY = 'test-key';
  const res = response();
  await handler({ method: 'POST', headers: {}, body: { sourceText: 'Interview' } }, res);
  assert.equal(res.statusCode, 401);
  delete process.env.MOBILE_API_TOKEN;
  process.env.NODE_ENV = 'test';
});

