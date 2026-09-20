import assert from 'node:assert/strict';
import test from 'node:test';

import { CapabilityRegistry } from '../capabilities/registry';
import { executeNextStep } from '../capabilities/executor';
import { CapabilityAdapter } from '../capabilities/types';
import { createTaskFromDefinition } from './planCompiler';
import { taskReducer } from './taskReducer';

const at = '2026-09-19T20:00:00.000Z';

test('a non-invitation plan compiles and executes through the same generic orchestrator', async () => {
  const task = createTaskFromDefinition({
    id: 'task-market-monitor',
    request: '监控 ACME，每天收盘后把变化写进 Notes',
    now: at,
    plan: {
      goal: { id: 'monitor-market', summary: '监控 ACME', desiredOutcome: '每日把价格变化写入 Notes' },
      context: [{ id: 'stock-page', kind: 'app-content', sourceApp: 'Stocks', data: { symbol: 'ACME' } }],
      triggers: [{ id: 'market-close', kind: 'time', configuration: { localTime: '16:05' } }],
      decisions: [],
      steps: [
        { id: 'read-market', capabilityId: 'market.quote.read', title: '读取收盘信息', risk: 'read', input: { symbol: 'ACME' } },
        { id: 'write-note', capabilityId: 'notes.append', title: '写入 Notes', risk: 'write', dependsOn: ['read-market'], input: { note: 'ACME 日报' } },
      ],
      presentation: { title: 'ACME 日报', startsAt: at, address: '', preparation: [] },
    },
  });

  assert.equal(task.goal?.id, 'monitor-market');
  assert.equal(task.context?.[0].sourceApp, 'Stocks');
  assert.equal(task.triggers?.[0].kind, 'time');
  assert.deepEqual(task.steps.map((step) => step.capabilityId), ['market.quote.read', 'notes.append']);

  const adapter = (id: string, risk: 'read' | 'write'): CapabilityAdapter => ({
    descriptor: { id, title: id, risk, executor: 'server', confirmation: 'once_per_plan', scopes: [] },
    execute: async () => ({ summary: `${id} complete` }),
  });
  const registry = new CapabilityRegistry([adapter('market.quote.read', 'read'), adapter('notes.append', 'write')]);
  const confirmed = taskReducer(task, { type: 'plan.confirmed', at, snapshot: { revision: 1, digest: 'generic', confirmedAt: at, steps: task.steps } });
  const executing = taskReducer(confirmed, { type: 'execution.started', at });
  const first = await executeNextStep(executing, registry, { userId: 'user', deviceId: 'device', now: () => at });

  assert.equal(first?.events[0].type, 'step.running');
  assert.equal(first?.events[0].type === 'step.running' ? first.events[0].stepId : '', 'read-market');
  assert.ok(first);
  const afterRead = first.events.reduce(taskReducer, executing);
  const second = await executeNextStep(afterRead, registry, { userId: 'user', deviceId: 'device', now: () => at });
  assert.equal(second?.events[0].type === 'step.running' ? second.events[0].stepId : '', 'write-note');
  assert.ok(second);
  const complete = second.events.reduce(taskReducer, afterRead);
  assert.equal(complete.phase, 'completed');
  assert.equal(complete.steps[1].receipt?.summary, 'notes.append complete');
});

test('plan compiler rejects unknown dependencies and cycles before confirmation', () => {
  const base = {
    goal: { id: 'g', summary: 'Goal', desiredOutcome: 'Outcome' },
    context: [],
    triggers: [{ id: 'manual', kind: 'manual' as const, configuration: {} }],
    decisions: [],
    presentation: { title: 'Goal', startsAt: at, address: '', preparation: [] },
  };

  assert.throws(() => createTaskFromDefinition({
    id: 'bad-dependency', request: 'Do it', now: at,
    plan: { ...base, steps: [{ id: 'one', capabilityId: 'x', title: 'One', risk: 'read', dependsOn: ['missing'], input: {} }] },
  }), /Unknown dependency/);

  assert.throws(() => createTaskFromDefinition({
    id: 'cycle', request: 'Do it', now: at,
    plan: { ...base, steps: [
      { id: 'one', capabilityId: 'x', title: 'One', risk: 'read', dependsOn: ['two'], input: {} },
      { id: 'two', capabilityId: 'y', title: 'Two', risk: 'read', dependsOn: ['one'], input: {} },
    ] },
  }), /cycle/);
});

test('a required decision can defer all capability steps without inventing work', () => {
  const task = createTaskFromDefinition({
    id: 'decision-only', request: '帮我规划旅行', now: at,
    plan: {
      goal: { id: 'plan-trip', summary: '规划旅行', desiredOutcome: '形成可确认的旅行安排' },
      context: [{ id: 'direct', kind: 'direct-input', data: {} }], triggers: [], steps: [],
      decisions: [{ id: 'destination', prompt: '你想去哪里？', options: [], required: true }],
      presentation: { title: '旅行计划', startsAt: at, address: '', preparation: [] },
    },
  });
  assert.equal(task.phase, 'needs_decision');
  assert.equal(task.steps.length, 0);
  assert.equal(task.pendingDecision?.id, 'destination');
});
