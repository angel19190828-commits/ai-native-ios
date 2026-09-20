const assert = require('node:assert/strict');
const test = require('node:test');
const { createHandler } = require('./tasks');

function response() {
  return { statusCode: 200, payload: undefined, ended: false, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; }, end() { this.ended = true; return this; } };
}

const task = {
  id: '8d5d61a0-5891-4ed4-a45a-a684fd11c608', request: 'Interview invitation', phase: 'ready',
  revision: 1, facts: { title: 'Interview' }, steps: [], stopRequested: false, updatedAt: '2026-09-19T12:00:00.000Z',
};

test('rejects unauthenticated task access', async () => {
  const handler = createHandler({ authorize: async () => ({ ok: false, status: 401, code: 'unauthorized' }) });
  const res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 401);
});

test('syncs a task through the user-scoped RPC', async () => {
  let rpcArgs;
  const row = { id: task.id, sync_version: 1, request: task.request, phase: task.phase, revision: 1, facts: task.facts, steps: [], stop_requested: false, updated_at: task.updatedAt };
  const client = { rpc(_name, args) { rpcArgs = args; return { single: async () => ({ data: row }) }; } };
  const handler = createHandler({ authorize: async () => ({ ok: true, token: 'jwt' }), createClientImpl: () => client });
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable';
  const res = response();
  try { await handler({ method: 'PUT', body: { task, event: { type: 'task.created' } } }, res); } finally { Object.assign(process.env, previous); }
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.task.syncVersion, 1);
  assert.equal(rpcArgs.p_expected_sync_version, 0);
  assert.equal(rpcArgs.p_event.type, 'task.created');
});

test('returns a version conflict without overwriting', async () => {
  const client = { rpc() { return { single: async () => ({ error: { code: '40001', message: 'task_version_conflict' } }) }; } };
  const handler = createHandler({ authorize: async () => ({ ok: true, token: 'jwt' }), createClientImpl: () => client });
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable';
  const res = response();
  try { await handler({ method: 'PUT', body: { task: { ...task, syncVersion: 2 } } }, res); } finally { Object.assign(process.env, previous); }
  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.error.code, 'task_version_conflict');
});

test('deletes only the authenticated users task selected by id', async () => {
  let deletedId;
  const client = { from() { return { delete() { return { async eq(_column, id) { deletedId = id; return { count: 1 }; } }; } }; } };
  const handler = createHandler({ authorize: async () => ({ ok: true, mode: 'user', token: 'jwt' }), createClientImpl: () => client });
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable';
  const res = response();
  try { await handler({ method: 'DELETE', query: { id: task.id } }, res); } finally { Object.assign(process.env, previous); }
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.equal(deletedId, task.id);
});

test('task deletion rejects invalid identifiers before touching storage', async () => {
  let touched = false;
  const handler = createHandler({ authorize: async () => ({ ok: true, token: 'jwt' }), createClientImpl: () => ({ from() { touched = true; return {}; } }) });
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable';
  const res = response();
  try { await handler({ method: 'DELETE', query: { id: '../another-user' } }, res); } finally { Object.assign(process.env, previous); }
  assert.equal(res.statusCode, 400);
  assert.equal(touched, false);
});
