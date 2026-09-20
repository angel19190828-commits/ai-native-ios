import { calendarCreateEventAdapter } from './calendarAdapter';
import { RouteApiClient } from '../api/routeClient';
import { reminderAdapter } from './reminderAdapter';
import { createRouteEstimateAdapter } from './routeAdapter';
import { CapabilityRegistry } from './registry';

export const createDeviceCapabilityRegistry = (routeClient: RouteApiClient) =>
  new CapabilityRegistry([
    calendarCreateEventAdapter,
    createRouteEstimateAdapter(routeClient),
    reminderAdapter,
  ]);

export * from './executor';
export * from './registry';
export * from './types';
