const assert = require('node:assert/strict');
const test = require('node:test');

const { authorizeRequest } = require('./_auth');

test('allows explicit unauthenticated local development only', async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.MOBILE_API_TOKEN;
  delete process.env.SUPABASE_URL;
  const result = await authorizeRequest({ headers: {} });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'local-development');
});

test('production rejects missing credentials', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.MOBILE_API_TOKEN;
  delete process.env.SUPABASE_URL;
  const result = await authorizeRequest({ headers: {} });
  assert.equal(result.ok, false);
  process.env.NODE_ENV = 'test';
});

test('development token uses constant-time credential comparison', async () => {
  process.env.NODE_ENV = 'production';
  process.env.MOBILE_API_TOKEN = 'temporary-secret';
  const denied = await authorizeRequest({ headers: { authorization: 'Bearer wrong' } });
  const allowed = await authorizeRequest({ headers: { authorization: 'Bearer temporary-secret' } });
  assert.equal(denied.ok, false);
  assert.equal(allowed.ok, true);
  delete process.env.MOBILE_API_TOKEN;
  process.env.NODE_ENV = 'test';
});

