import assert from 'node:assert/strict';
import test from 'node:test';

import { AiApiClient, AiApiError } from './aiClient';

const plan = {
  title: 'Alex 面试',
  kind: 'appointment' as const,
  startsAt: '2026-09-28T10:30:00-07:00',
  endsAt: '2026-09-28T11:30:00-07:00',
  location: '555 Burrard Street',
  arrivalMinutesEarly: 15,
  preparation: ['携带作品集'],
  missingFields: ['origin'] as const,
  sourceSummary: '面试邀请',
};

test('client sends auth and returns a validated plan', async () => {
  let request: RequestInit | undefined;
  const client = new AiApiClient({
    baseUrl: 'https://api.example.com/',
    getAccessToken: async () => 'access-token',
    fetch: async (_url, init) => {
      request = init;
      return new Response(JSON.stringify({ plan, requestId: 'request-1', model: 'test-model' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  const result = await client.planInvitation({ sourceText: 'invite', locale: 'zh-CN', timeZone: 'America/Vancouver' });
  assert.equal(result.plan.title, 'Alex 面试');
  assert.equal((request?.headers as Record<string, string>).authorization, 'Bearer access-token');
});

test('client rejects invalid successful responses', async () => {
  const client = new AiApiClient({
    baseUrl: 'https://api.example.com',
    fetch: async () => new Response(JSON.stringify({ plan: { title: 'partial' }, requestId: 'r', model: 'm' })),
  });
  await assert.rejects(
    () => client.planInvitation({ sourceText: 'invite', locale: 'en', timeZone: 'UTC' }),
    (error: unknown) => error instanceof AiApiError && error.code === 'invalid_response',
  );
});

test('client preserves structured backend errors', async () => {
  const client = new AiApiClient({
    baseUrl: 'https://api.example.com',
    fetch: async () => new Response(JSON.stringify({ error: { code: 'ai_timeout', requestId: 'request-2' } }), { status: 504 }),
  });
  await assert.rejects(
    () => client.planInvitation({ sourceText: 'invite', locale: 'en', timeZone: 'UTC' }),
    (error: unknown) => error instanceof AiApiError && error.code === 'ai_timeout' && error.requestId === 'request-2',
  );
});

test('client supports caller cancellation', async () => {
  const abort = new AbortController();
  const client = new AiApiClient({
    baseUrl: 'https://api.example.com',
    fetch: async (_url, init) => new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
  });
  const pending = client.planInvitation({ sourceText: 'invite', locale: 'en', timeZone: 'UTC', signal: abort.signal });
  abort.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof AiApiError && error.code === 'cancelled');
});
