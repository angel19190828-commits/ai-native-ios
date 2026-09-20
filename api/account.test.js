const assert = require('node:assert/strict');
const test = require('node:test');
const { createHandler } = require('./account');

function response() {
  return {
    statusCode: 200,
    payload: undefined,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { this.ended = true; return this; },
  };
}

test('account deletion requires an authenticated user session', async () => {
  const handler = createHandler({ authorize: async () => ({ ok: true, mode: 'development-token', userId: 'development-user' }) });
  const res = response();
  await handler({ method: 'DELETE' }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error.code, 'account_deletion_requires_user_session');
});

test('deletes only the user identity verified from the bearer token', async () => {
  let deleted;
  const client = { auth: { admin: { deleteUser: async (userId, soft) => { deleted = { userId, soft }; return {}; } } } };
  const handler = createHandler({
    authorize: async () => ({ ok: true, mode: 'user', userId: 'verified-user' }),
    createClientImpl: () => client,
  });
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'server-secret';
  const res = response();
  try { await handler({ method: 'DELETE', query: { userId: 'attacker-selected-user' } }, res); } finally { Object.assign(process.env, previous); }
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.deepEqual(deleted, { userId: 'verified-user', soft: false });
});

test('fails closed when the privileged account deletion client is unavailable', async () => {
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  const handler = createHandler({ authorize: async () => ({ ok: true, mode: 'user', userId: 'verified-user' }) });
  const res = response();
  try { await handler({ method: 'DELETE' }, res); } finally { Object.assign(process.env, previous); }
  assert.equal(res.statusCode, 503);
});

test('does not report success when Supabase rejects deletion', async () => {
  const client = { auth: { admin: { deleteUser: async () => ({ error: new Error('provider failure') }) } } };
  const handler = createHandler({ authorize: async () => ({ ok: true, mode: 'user', userId: 'verified-user' }), createClientImpl: () => client });
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY };
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_SECRET_KEY = 'server-secret';
  const res = response();
  try { await handler({ method: 'DELETE' }, res); } finally { Object.assign(process.env, previous); }
  assert.equal(res.statusCode, 502);
  assert.equal(res.payload.error.code, 'account_deletion_failed');
});
