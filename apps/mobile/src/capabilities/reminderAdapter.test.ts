import assert from 'node:assert/strict';
import test from 'node:test';

import { createReminderAdapter } from './reminderCore';

test('reminder consumes commute receipt and schedules preparation before departure', async () => {
  const dates: Date[] = [];
  const fake = {
    getPermissionsAsync: async () => ({ granted: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
    setNotificationChannelAsync: async () => undefined,
    scheduleNotificationAsync: async (request: { trigger: { date: Date } }) => { dates.push(request.trigger.date); return `notification-${dates.length}`; },
  };
  const adapter = createReminderAdapter(fake as never, 'ios', () => Date.parse('2026-09-28T15:00:00Z'));
  const result = await adapter.execute({ preparation: ['携带作品集'], preparationMinutesBeforeDeparture: 30 }, {
    userId: 'u', deviceId: 'd', taskId: 't', revision: 1, attemptId: 'a', idempotencyKey: 'k', signal: new AbortController().signal,
    dependencyReceipts: { commute: { attemptId: 'route', idempotencyKey: 'route-key', completedAt: '2026-09-28T16:00:00Z', summary: 'route', output: { departureAt: '2026-09-28T16:43:00Z' } } },
  });
  assert.deepEqual(dates.map((date) => date.toISOString()), ['2026-09-28T16:13:00.000Z', '2026-09-28T16:43:00.000Z']);
  assert.equal(result.output?.departureId, 'notification-2');
});

test('reminder discovers route output by receipt shape instead of a scenario step ID', async () => {
  const dates: Date[] = [];
  const adapter = createReminderAdapter({
    getPermissionsAsync: async () => ({ granted: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
    setNotificationChannelAsync: async () => undefined,
    scheduleNotificationAsync: async (request: { trigger: { date: Date } }) => { dates.push(request.trigger.date); return `notification-${dates.length}`; },
  }, 'ios', () => Date.parse('2026-09-20T08:00:00Z'));
  await adapter.execute({ eventStartsAt: '2026-09-20T18:00:00Z', preparation: [], preparationMinutesBeforeDeparture: 30 }, {
    userId: 'user', deviceId: 'device', taskId: 'task', revision: 1, attemptId: 'attempt', idempotencyKey: 'key',
    dependencyReceipts: { 'route-to-venue': { attemptId: 'route-attempt', idempotencyKey: 'route-key', completedAt: '2026-09-20T08:00:00Z', summary: 'route', output: { departureAt: '2026-09-20T17:00:00Z' } } },
    signal: new AbortController().signal,
  });
  assert.equal(dates[0].toISOString(), '2026-09-20T16:30:00.000Z');
  assert.equal(dates[1].toISOString(), '2026-09-20T17:00:00.000Z');
});
