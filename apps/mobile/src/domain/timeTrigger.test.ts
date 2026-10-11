import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRecurrenceRun, taskRecurrence, taskRunAt, waitsForFutureTime } from './timeTrigger';

test('time trigger waits only for a valid future instant', () => {
  const task = { triggers: [{ id: 'later', kind: 'time' as const, configuration: { runAt: '2026-09-21T12:00:00.000Z' } }] };
  assert.equal(taskRunAt(task), '2026-09-21T12:00:00.000Z');
  assert.equal(waitsForFutureTime(task, Date.parse('2026-09-21T11:59:00.000Z')), '2026-09-21T12:00:00.000Z');
  assert.equal(waitsForFutureTime(task, Date.parse('2026-09-21T12:00:00.000Z')), undefined);
  assert.equal(taskRunAt({ triggers: [{ id: 'bad', kind: 'time', configuration: { runAt: 'later' } }] }), undefined);
});

test('recurrence calculates the next future occurrence without duplicating missed runs', () => {
  const task = { triggers: [{ id: 'daily', kind: 'time' as const, configuration: {
    runAt: '2026-09-21T12:00:00.000Z', recurrence: { frequency: 'daily', interval: 1 },
  } }] };
  assert.deepEqual(taskRecurrence(task), { frequency: 'daily', interval: 1 });
  assert.equal(nextRecurrenceRun(task, Date.parse('2026-09-23T13:00:00.000Z')), '2026-09-24T12:00:00.000Z');
});
