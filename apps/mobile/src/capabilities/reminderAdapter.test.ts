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
