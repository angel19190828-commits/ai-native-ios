import assert from 'node:assert/strict';
import test from 'node:test';

import { ProposedPlan } from '../api/aiClient';
import { createTaskFromPlan } from './taskFactory';

const basePlan: ProposedPlan = {
  title: 'Alex 面试',
  kind: 'appointment',
  startsAt: '2026-09-28T10:30:00-07:00',
  endsAt: '2026-09-28T11:30:00-07:00',
  location: '555 Burrard Street',
  arrivalMinutesEarly: 15,
  preparation: ['携带作品集'],
  missingFields: [],
  sourceSummary: '面试邀请',
};

test('appointment plan becomes Calendar -> commute -> reminders', () => {
  const task = createTaskFromPlan({ id: 'task-1', request: '安排面试', plan: basePlan, now: '2026-09-19T20:00:00Z' });
  assert.equal(task.phase, 'ready');
  assert.deepEqual(task.steps.map((step) => step.id), ['calendar', 'commute', 'reminders']);
  assert.deepEqual(task.steps.map((step) => step.dependsOn), [[], ['calendar'], ['commute']]);
  assert.equal(task.steps[0].input.startDate, basePlan.startsAt);
  assert.equal(task.goal?.id, 'arrange-invitation');
  assert.equal(task.context?.[0].kind, 'email');
  assert.equal(task.triggers?.[0].kind, 'manual');
});

test('missing facts create a decision instead of silently inventing values', () => {
  const task = createTaskFromPlan({
    id: 'task-2',
    request: '安排面试',
    plan: { ...basePlan, missingFields: ['origin'] },
    now: '2026-09-19T20:00:00Z',
  });
  assert.equal(task.phase, 'needs_decision');
  assert.match(task.pendingDecision?.prompt ?? '', /origin/);
});

test('an explicit origin resolves only the origin decision and enters the route input', () => {
  const task = createTaskFromPlan({
    id: 'task-origin',
    request: '安排面试',
    plan: { ...basePlan, missingFields: ['origin'] },
    origin: '1285 W Pender Street',
    now: '2026-09-19T20:00:00Z',
  });
  assert.equal(task.phase, 'ready');
  assert.equal(task.facts.origin, '1285 W Pender Street');
  assert.equal(task.steps[1].input.origin, '1285 W Pender Street');
});

test('online meeting omits meaningless commute work', () => {
  const task = createTaskFromPlan({
    id: 'task-3',
    request: '安排线上会议',
    plan: { ...basePlan, kind: 'meeting', location: 'https://meet.example.com/abc' },
    now: '2026-09-19T20:00:00Z',
  });
  assert.deepEqual(task.steps.map((step) => step.id), ['calendar', 'reminders']);
  assert.deepEqual(task.steps[1].dependsOn, ['calendar']);
});
