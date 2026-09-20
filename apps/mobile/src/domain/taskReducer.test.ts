import assert from 'node:assert/strict';
import test from 'node:test';

import { interviewTask } from './fixture';
import { Task, TaskEvent } from './task';
import { taskReducer } from './taskReducer';

const at = '2026-09-19T18:00:00.000Z';

const freshTask = (): Task => structuredClone(interviewTask);

const apply = (task: Task, ...events: TaskEvent[]) =>
  events.reduce((current, event) => taskReducer(current, event), task);

const confirm = (task: Task): Task =>
  taskReducer(task, {
    type: 'plan.confirmed',
    at,
    snapshot: {
      revision: task.revision,
      digest: `revision-${task.revision}`,
      confirmedAt: at,
      steps: structuredClone(task.steps),
    },
  });

const receipt = (stepId: string) => ({
  attemptId: `attempt-${stepId}`,
  idempotencyKey: `task-interview-demo:${stepId}`,
  completedAt: at,
  summary: `${stepId} completed`,
});

test('execution requires explicit confirmation of the current revision', () => {
  const task = freshTask();

  assert.throws(
    () => taskReducer(task, { type: 'execution.started', at }),
    /confirmed current revision/,
  );
  assert.throws(
    () =>
      taskReducer(task, {
        type: 'plan.confirmed',
        at,
        snapshot: { revision: 0, digest: 'stale', confirmedAt: at, steps: [] },
      }),
    /stale task revision/,
  );
});

test('enforces Calendar -> commute -> reminders and completes only after all receipts', () => {
  let task = apply(freshTask(), { type: 'plan.confirmed', at, snapshot: {
    revision: 1,
    digest: 'revision-1',
    confirmedAt: at,
    steps: structuredClone(interviewTask.steps),
  } }, { type: 'execution.started', at });

  assert.throws(
    () => taskReducer(task, { type: 'step.running', at, stepId: 'commute' }),
    /dependencies are incomplete/,
  );

  task = apply(
    task,
    { type: 'step.running', at, stepId: 'calendar' },
    { type: 'step.completed', at, stepId: 'calendar', receipt: receipt('calendar') },
    { type: 'step.running', at, stepId: 'commute' },
    { type: 'step.completed', at, stepId: 'commute', receipt: receipt('commute') },
    { type: 'step.running', at, stepId: 'reminders' },
    { type: 'step.completed', at, stepId: 'reminders', receipt: receipt('reminders') },
  );

  assert.equal(task.phase, 'completed');
  assert.deepEqual(task.steps.map((step) => step.status), ['completed', 'completed', 'completed']);
  assert.deepEqual(task.steps.map((step) => step.receipt?.idempotencyKey), [
    'task-interview-demo:calendar',
    'task-interview-demo:commute',
    'task-interview-demo:reminders',
  ]);
});

test('a later failure preserves completed receipts and becomes partially completed', () => {
  let task = apply(confirm(freshTask()), { type: 'execution.started', at });
  task = apply(
    task,
    { type: 'step.running', at, stepId: 'calendar' },
    { type: 'step.completed', at, stepId: 'calendar', receipt: receipt('calendar') },
    { type: 'step.running', at, stepId: 'commute' },
    { type: 'step.failed', at, stepId: 'commute' },
  );

  assert.equal(task.phase, 'partially_completed');
  assert.equal(task.steps[0].receipt?.attemptId, 'attempt-calendar');
  assert.equal(task.steps[1].status, 'failed');
  assert.equal(task.steps[2].status, 'waiting');
});

test('stopping requires a request and keeps already completed work', () => {
  let task = apply(confirm(freshTask()), { type: 'execution.started', at });
  task = apply(
    task,
    { type: 'step.running', at, stepId: 'calendar' },
    { type: 'step.completed', at, stepId: 'calendar', receipt: receipt('calendar') },
    { type: 'step.running', at, stepId: 'commute' },
  );

  assert.throws(() => taskReducer(task, { type: 'task.stopped', at }), /before stop is requested/);

  task = apply(task, { type: 'stop.requested', at }, { type: 'task.stopped', at });
  assert.equal(task.phase, 'stopped');
  assert.deepEqual(task.steps.map((step) => step.status), ['completed', 'stopped', 'stopped']);
});

test('step events reject unknown, duplicate, and post-stop transitions', () => {
  const executing = apply(confirm(freshTask()), { type: 'execution.started', at });

  assert.throws(
    () => taskReducer(executing, { type: 'step.running', at, stepId: 'unknown' }),
    /Unknown step/,
  );

  const running = taskReducer(executing, { type: 'step.running', at, stepId: 'calendar' });
  assert.throws(
    () => taskReducer(running, { type: 'step.running', at, stepId: 'calendar' }),
    /not waiting/,
  );

  const stopping = taskReducer(running, { type: 'stop.requested', at });
  assert.throws(
    () => taskReducer(stopping, { type: 'step.completed', at, stepId: 'calendar', receipt: receipt('calendar') }),
    /blocked after stop is requested/,
  );
});

test('decision re-planning creates a new revision and can safely request another decision', () => {
  let task = structuredClone(interviewTask);
  task = apply(task, { type: 'decision.required', at, decision: { id: 'where', prompt: 'Where?', options: [] } });
  task = apply(task, { type: 'decision.resolved', at });
  assert.equal(task.phase, 'planning');
  task = apply(task, {
    type: 'planning.ready', at, facts: task.facts, steps: task.steps,
    goal: { id: 'dinner', summary: 'Plan dinner', desiredOutcome: 'Dinner arranged' },
    context: [{ id: 'answer', kind: 'direct-input', data: { content: 'Downtown' } }],
    triggers: [{ id: 'manual', kind: 'manual', configuration: {} }],
  });
  assert.equal(task.revision, 2);
  assert.equal(task.goal?.id, 'dinner');
  task = apply(task, { type: 'decision.required', at, decision: { id: 'when', prompt: 'When?', options: [] } });
  assert.equal(task.phase, 'needs_decision');
  assert.equal(task.pendingDecision?.id, 'when');
});
