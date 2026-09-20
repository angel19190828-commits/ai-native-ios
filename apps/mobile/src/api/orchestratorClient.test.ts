import assert from 'node:assert/strict';
import test from 'node:test';

import { AiApiError } from './aiClient';
import { OrchestratorApiClient } from './orchestratorClient';

const proposal = {
  summary: '安排会面', desiredOutcome: '创建日历安排',
  triggers: [{ id: 'manual', kind: 'manual', configuration: {} }], decisions: [],
  steps: [{
    id: 'calendar', capabilityId: 'system.calendar.createEvent', title: '创建日历', risk: 'write', dependsOn: [],
    policy: { executor: 'device', confirmation: 'once_per_plan', scopes: ['calendar.write'] },
    input: { title: '会面', startDate: '2026-09-20T10:00:00Z', endDate: '2026-09-20T11:00:00Z' },
  }],
};

test('generic planner client sends goal, context, and user session', async () => {
  let request: RequestInit | undefined;
  const client = new OrchestratorApiClient({
    baseUrl: 'https://api.example.test/', getAccessToken: async () => 'jwt',
    fetch: async (_url, init) => {
      request = init;
      return new Response(JSON.stringify({ proposal, requestId: 'request-1', model: 'model', catalogVersion: '1' }), { status: 200 });
    },
  });
  const result = await client.propose({ goal: '安排会面', context: [{ kind: 'message', content: '明天十点' }], locale: 'zh-CN', timeZone: 'Asia/Shanghai' });
  assert.equal(result.proposal.steps[0].capabilityId, 'system.calendar.createEvent');
  assert.equal((request?.headers as Record<string, string>).authorization, 'Bearer jwt');
  const body = JSON.parse(String(request?.body));
  assert.equal(body.goal, '安排会面');
  assert.equal(body.context[0].kind, 'message');
});

test('generic planner client rejects unvalidated envelopes', async () => {
  const client = new OrchestratorApiClient({
    baseUrl: 'https://api.example.test',
    fetch: async () => new Response(JSON.stringify({ proposal: { ...proposal, steps: [{ id: 'unsafe' }] }, requestId: 'r', model: 'm', catalogVersion: '1' })),
  });
  await assert.rejects(
    () => client.propose({ goal: 'Do it', context: [], locale: 'en', timeZone: 'UTC' }),
    (error: unknown) => error instanceof AiApiError && error.code === 'invalid_response',
  );
});

test('generic planner client accepts a decision-only proposal', async () => {
  const client = new OrchestratorApiClient({
    baseUrl: 'https://api.example.test',
    fetch: async () => new Response(JSON.stringify({
      proposal: { summary: 'Plan travel', desiredOutcome: 'Trip planned', triggers: [], steps: [], decisions: [{ id: 'where', prompt: 'Where?', options: [], required: true }] },
      requestId: 'r', model: 'm', catalogVersion: '1',
    })),
  });
  const result = await client.propose({ goal: 'Plan travel', context: [], locale: 'en', timeZone: 'UTC' });
  assert.equal(result.proposal.decisions[0].id, 'where');
});
