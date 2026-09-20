import assert from 'node:assert/strict';
import test from 'node:test';

import { AccountClient, AccountDeletionError } from './accountClient';

test('deletes the current account with its bearer token', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const client = new AccountClient({
    baseUrl: 'https://api.example.test/',
    getAccessToken: async () => 'user-jwt',
    fetch: async (url, init) => { request = { url: String(url), init }; return new Response(null, { status: 204 }); },
  });
  await client.deleteAccount();
  assert.equal(request?.url, 'https://api.example.test/api/account');
  assert.equal(request?.init?.method, 'DELETE');
  assert.deepEqual(request?.init?.headers, { authorization: 'Bearer user-jwt' });
});

test('account deletion requires a session and preserves backend error codes', async () => {
  const missing = new AccountClient({ baseUrl: 'https://api.example.test', getAccessToken: async () => undefined });
  await assert.rejects(() => missing.deleteAccount(), (error) => error instanceof AccountDeletionError && error.code === 'authentication_required');
  const rejected = new AccountClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'jwt',
    fetch: async () => Response.json({ error: { code: 'account_deletion_failed' } }, { status: 502 }),
  });
  await assert.rejects(() => rejected.deleteAccount(), (error) => error instanceof AccountDeletionError && error.status === 502);
});
