import assert from 'node:assert/strict';
import test from 'node:test';

import { RouteApiClient } from '../api/routeClient';
import { createRouteEstimateAdapter } from './routeAdapter';
import { CapabilityError } from './types';

const context = {
  userId: 'u', deviceId: 'd', taskId: 't', revision: 1, attemptId: 'a', idempotencyKey: 'k', dependencyReceipts: {}, signal: new AbortController().signal,
};

test('route adapter subtracts arrival buffer and returns structured output', async () => {
  let requestedArrival = '';
  const client = new RouteApiClient({ baseUrl: 'https://api.example.com', fetch: async (_url, init) => {
    requestedArrival = JSON.parse(String(init?.body)).arriveBy;
    return new Response(JSON.stringify({ route: { departureAt: '2026-09-28T16:43:00Z', arrivalAt: '2026-09-28T17:15:00Z', durationSeconds: 1920, distanceMeters: 5100, transportMode: 'transit' } }));
  } });
  const result = await createRouteEstimateAdapter(client).execute({ origin: 'Home', destination: 'Office', arriveBy: '2026-09-28T10:30:00-07:00', arrivalMinutesEarly: 15 }, context);
  assert.equal(requestedArrival, '2026-09-28T17:15:00.000Z');
  assert.equal(result.output?.durationSeconds, 1920);
});

test('route adapter requires an explicit origin', async () => {
  const adapter = createRouteEstimateAdapter(new RouteApiClient({ baseUrl: 'https://api.example.com' }));
  await assert.rejects(() => adapter.execute({ destination: 'Office', arriveBy: '2026-09-28T10:30:00-07:00' }, context), (error: unknown) => error instanceof CapabilityError && error.code === 'decision_required');
});

