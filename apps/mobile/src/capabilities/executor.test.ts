import assert from 'node:assert/strict';
import test from 'node:test';

import { interviewTask } from '../domain/fixture';
import { Task, TaskEvent } from '../domain/task';
import { taskReducer } from '../domain/taskReducer';
import { executeNextStep } from './executor';
import { CapabilityRegistry } from './registry';
import { CapabilityAdapter, CapabilityError } from './types';

const at = '2026-09-19T19:00:00.000Z';
const reduce = (task: Task, events: TaskEvent[]) => events.reduce(taskReducer, task);

const executingTask = () => {
  const task = structuredClone(interviewTask);
  const confirmed = taskReducer(task, {
    type: 'plan.confirmed',
    at,
    snapshot: { revision: 1, digest: 'r1', confirmedAt: at, steps: structuredClone(task.steps) },
  });
  return taskReducer(confirmed, { type: 'execution.started', at });
};

const adapter = (id: string, risk: CapabilityAdapter['descriptor']['risk']): CapabilityAdapter => ({
  descriptor: { id, title: id, risk, executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: [] },
  execute: async (_input, context) => ({ summary: `${id} ok`, externalId: context.idempotencyKey }),
});

const registry = () =>
  new CapabilityRegistry([
    adapter('system.calendar.createEvent', 'write'),
    adapter('maps.route.estimate', 'read'),
    adapter('system.reminder.schedule', 'write'),
  ]);

test('executor selects the first eligible step and creates a durable receipt', async () => {
  const task = executingTask();
  const outcome = await executeNextStep(task, registry(), {
    userId: 'user-1',
    deviceId: 'device-1',
    now: () => at,
    createAttemptId: () => 'attempt-1',
  });

  assert.ok(outcome);
  assert.deepEqual(outcome.events.map((event) => event.type), ['step.running', 'step.completed']);
  const next = reduce(task, outcome.events);
  assert.equal(next.steps[0].status, 'completed');
  assert.equal(next.steps[0].receipt?.idempotencyKey, 'user-1:task-interview-demo:1:calendar');
});

test('resuming after a receipt advances to commute, never reminders', async () => {
  const task = executingTask();
  const first = await executeNextStep(task, registry(), { userId: 'user-1', deviceId: 'device-1' });
  assert.ok(first);
  const resumed = reduce(task, first.events);
  const second = await executeNextStep(resumed, registry(), { userId: 'user-1', deviceId: 'device-1' });

  assert.ok(second);
  assert.equal(second.events[0].type, 'step.running');
  assert.equal('stepId' in second.events[0] ? second.events[0].stepId : undefined, 'commute');
});

test('adapter errors become typed failures instead of false completion', async () => {
  const denied: CapabilityAdapter = {
    descriptor: {
      id: 'system.calendar.createEvent',
      title: 'Calendar',
      risk: 'write',
      executor: 'device',
      interactionMode: 'structured',
      confirmation: 'once_per_plan',
      scopes: [],
    },
    execute: async () => {
      throw new CapabilityError('permission_denied', 'Calendar permission denied');
    },
  };
  const outcome = await executeNextStep(executingTask(), new CapabilityRegistry([denied]), {
    userId: 'user-1',
    deviceId: 'device-1',
  });

  assert.ok(outcome);
  assert.equal(outcome.error?.code, 'permission_denied');
  assert.deepEqual(outcome.events.map((event) => event.type), ['step.running', 'step.failed']);
});

test('stop state prevents dispatching any new capability', async () => {
  const stopping = taskReducer(executingTask(), { type: 'stop.requested', at });
  const outcome = await executeNextStep(stopping, registry(), {
    userId: 'user-1',
    deviceId: 'device-1',
  });
  assert.equal(outcome, undefined);
});

test('persists running before the side effect and completion after it', async () => {
  const order: string[] = [];
  const observed = adapter('system.calendar.createEvent', 'write');
  observed.execute = async () => { order.push('adapter'); return { summary: 'done' }; };
  await executeNextStep(executingTask(), new CapabilityRegistry([observed]), {
    userId: 'user-1',
    deviceId: 'device-1',
    onEvent: async (event) => { order.push(event.type); },
  });
  assert.deepEqual(order, ['step.running', 'adapter', 'step.completed']);
});

test('registry rejects duplicate IDs and descriptor risk drift', async () => {
  const duplicate = registry();
  assert.throws(() => duplicate.register(adapter('maps.route.estimate', 'read')), /already registered/);

  const wrongRisk = new CapabilityRegistry([adapter('system.calendar.createEvent', 'read')]);
  await assert.rejects(
    () => executeNextStep(executingTask(), wrongRisk, { userId: 'user-1', deviceId: 'device-1' }),
    /risk mismatch/,
  );
});

test('executor rejects capability policy drift from the confirmed plan', async () => {
  const task = executingTask();
  task.steps[0].policy = { executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['calendar.write'] };
  const drifted = adapter('system.calendar.createEvent', 'write');
  drifted.descriptor.scopes = ['calendar.read'];
  await assert.rejects(
    () => executeNextStep(task, new CapabilityRegistry([drifted]), { userId: 'user-1', deviceId: 'device-1' }),
    /policy mismatch/,
  );
});

test('executor fails closed when a capability requires unimplemented per-attempt confirmation', async () => {
  const task = executingTask();
  const highFriction = adapter('system.calendar.createEvent', 'write');
  highFriction.descriptor.confirmation = 'always';
  await assert.rejects(
    () => executeNextStep(task, new CapabilityRegistry([highFriction]), { userId: 'user-1', deviceId: 'device-1' }),
    /per-attempt confirmation/,
  );
});

test('executor keeps the UI automation extension point fail-closed', async () => {
  const task = executingTask();
  task.steps[0].policy = { executor: 'device', interactionMode: 'ui_automation', confirmation: 'always', scopes: ['screen.interact'] };
  const fallback = adapter('system.calendar.createEvent', 'write');
  fallback.descriptor.interactionMode = 'ui_automation';
  fallback.descriptor.confirmation = 'always';
  fallback.descriptor.scopes = ['screen.interact'];
  await assert.rejects(
    () => executeNextStep(task, new CapabilityRegistry([fallback]), { userId: 'user-1', deviceId: 'device-1' }),
    /UI automation capability execution is not enabled/,
  );
});

test('executor resolves confirmed inputs from dependency receipts', async () => {
  const task = executingTask();
  task.steps[0].status = 'completed';
  task.steps[0].receipt = {
    attemptId: 'calendar-attempt', idempotencyKey: 'calendar-key', completedAt: at,
    summary: 'calendar created', output: { destination: 'Miku Vancouver' },
  };
  task.steps[1].bindings = [{ targetKey: 'destination', fromStepId: 'calendar', outputKey: 'destination', required: true }];
  delete task.steps[1].input.destination;
  let observed: Record<string, unknown> | undefined;
  const route = adapter('maps.route.estimate', 'read');
  route.execute = async (input) => { observed = input; return { summary: 'route ready' }; };

  const outcome = await executeNextStep(task, new CapabilityRegistry([route]), { userId: 'user-1', deviceId: 'device-1' });
  assert.ok(outcome);
  assert.equal(observed?.destination, 'Miku Vancouver');
});

test('executor fails closed when a required receipt output is absent', async () => {
  const task = executingTask();
  task.steps[0].status = 'completed';
  task.steps[0].receipt = { attemptId: 'a', idempotencyKey: 'k', completedAt: at, summary: 'done', output: {} };
  task.steps[1].bindings = [{ targetKey: 'destination', fromStepId: 'calendar', outputKey: 'destination', required: true }];
  const outcome = await executeNextStep(task, new CapabilityRegistry([adapter('maps.route.estimate', 'read')]), {
    userId: 'user-1', deviceId: 'device-1', now: () => at,
  });
  assert.equal(outcome?.error?.code, 'terminal');
  assert.match(outcome?.error?.message ?? '', /Required capability output is missing/);
  assert.deepEqual(outcome?.events.map((event) => event.type), ['step.running', 'step.failed']);
});
