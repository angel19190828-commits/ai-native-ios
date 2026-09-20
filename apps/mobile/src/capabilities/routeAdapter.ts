import { RouteApiClient } from '../api/routeClient';
import { CapabilityAdapter, CapabilityError } from './types';

export const createRouteEstimateAdapter = (client: RouteApiClient): CapabilityAdapter => ({
  descriptor: { id: 'maps.route.estimate', title: 'Estimate transit route', risk: 'read', executor: 'server', confirmation: 'once_per_plan' },
  async execute(input, context) {
    const origin = typeof input.origin === 'string' ? input.origin.trim() : '';
    const destination = typeof input.destination === 'string' ? input.destination.trim() : '';
    const arriveBy = typeof input.arriveBy === 'string' ? input.arriveBy : '';
    const early = typeof input.arrivalMinutesEarly === 'number' ? input.arrivalMinutesEarly : 0;
    if (!origin) throw new CapabilityError('decision_required', 'An origin is required to calculate a route');
    if (!destination || Number.isNaN(Date.parse(arriveBy))) throw new CapabilityError('terminal', 'Route destination and arrival time are required');
    const targetArrival = new Date(Date.parse(arriveBy) - early * 60_000).toISOString();
    try {
      const route = await client.estimate({ origin, destination, arriveBy: targetArrival, locale: 'zh-CN', signal: context.signal });
      return {
        summary: `${Math.ceil(route.durationSeconds / 60)} min transit route`,
        output: { ...route },
      };
    } catch (error) {
      if (context.signal.aborted) throw new CapabilityError('cancelled', 'Route calculation was cancelled', error);
      if (error instanceof CapabilityError) throw error;
      throw new CapabilityError('retryable', 'Route service is unavailable', error);
    }
  },
});
