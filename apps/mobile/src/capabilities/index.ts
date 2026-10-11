import { calendarCreateEventAdapter } from './calendarAdapter';
import { RouteApiClient } from '../api/routeClient';
import { reminderAdapter } from './reminderAdapter';
import { createRouteEstimateAdapter } from './routeAdapter';
import { CapabilityRegistry } from './registry';
import { createContentCapabilityAdapters } from './contentAdapters';
import { createEncryptedTaskStore } from '../storage/nativeStores';
import { createFileCapabilityAdapters } from './fileAdapters';

export const createDeviceCapabilityRegistry = (routeClient: RouteApiClient) =>
  new CapabilityRegistry([
    calendarCreateEventAdapter,
    createRouteEstimateAdapter(routeClient),
    reminderAdapter,
    ...createContentCapabilityAdapters(createEncryptedTaskStore('capability-artifacts')),
    ...createFileCapabilityAdapters(),
  ]);

export { openDocumentResult } from './fileAdapters';

export * from './executor';
export * from './registry';
export * from './types';
