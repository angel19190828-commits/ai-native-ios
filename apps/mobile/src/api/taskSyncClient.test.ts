import assert from 'node:assert/strict';
import test from 'node:test';
import { Task } from '../domain/task';
import { TaskSyncClient, TaskSyncError } from './taskSyncClient';

const task: Task = {
  id: '8d5d61a0-5891-4ed4-a45a-a684fd11c608', syncVersion: 1, request: 'Invite', phase: 'ready', revision: 1,
  facts: { title: 'Interview', startsAt: '2026-09-20T10:00:00-07:00', address: 'Office', preparation: [] },
  steps: [], stopRequested: false, updatedAt: '2026-09-19T12:00:00.000Z',
};

test('sync sends the account token and current version', async () => {
  let init: RequestInit | undefined;
  const client = new TaskSyncClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'jwt', fetch: async (_url, request) => {
    init = request;
    return new Response(JSON.stringify({ task: { ...task, syncVersion: 2 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const result = await client.sync(task, { type: 'execution.started', at: task.updatedAt });
  assert.equal(result.syncVersion, 2);
  assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer jwt');
  assert.equal(JSON.parse(String(init?.body)).task.syncVersion, 1);
});

test('latest validates server task data', async () => {
  const client = new TaskSyncClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'jwt', fetch: async () => new Response(JSON.stringify({ tasks: [{}] }), { status: 200 }) });
  await assert.rejects(() => client.latest(), (error: unknown) => error instanceof TaskSyncError && error.code === 'invalid_task_response');
});

test('conflict is surfaced for recovery instead of overwritten', async () => {
  const client = new TaskSyncClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'jwt', fetch: async () => new Response(JSON.stringify({ error: { code: 'task_version_conflict' } }), { status: 409 }) });
  await assert.rejects(() => client.sync(task), (error: unknown) => error instanceof TaskSyncError && error.status === 409);
});

test('deletes a task by encoded id using the account bearer token', async () => {
  let request: { url: string; init?: RequestInit } | undefined;
  const client = new TaskSyncClient({
    baseUrl: 'https://api.example.test/',
    getAccessToken: async () => 'jwt',
    fetch: async (url, init) => { request = { url: String(url), init }; return new Response(null, { status: 204 }); },
  });
  await client.delete('8d5d61a0-5891-4ed4-a45a-a684fd11c608');
  assert.equal(request?.url, 'https://api.example.test/api/tasks?id=8d5d61a0-5891-4ed4-a45a-a684fd11c608');
  assert.equal(request?.init?.method, 'DELETE');
  assert.deepEqual(request?.init?.headers, { 'content-type': 'application/json', authorization: 'Bearer jwt' });
});
