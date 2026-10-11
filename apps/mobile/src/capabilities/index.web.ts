import type { RouteApiClient } from '../api/routeClient';
import type { CapabilityAdapter } from './types';
import { CapabilityRegistry } from './registry';
import { createContentCapabilityAdapters } from './contentAdapters';
import { createEncryptedTaskStore } from '../storage/nativeStores';
import { createFileCapabilityAdapters } from './fileAdapters';

const simulated = (adapter: CapabilityAdapter): CapabilityAdapter => adapter;

const calendarAdapter = simulated({
  descriptor: { id: 'system.calendar.createEvent', title: 'Simulate calendar event', risk: 'write', executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['calendar.write'] },
  async execute(input, context) {
    if (context.signal.aborted) throw new Error('Browser simulation cancelled');
    return { summary: '浏览器模拟：Calendar 写入已生成（仍需 iPhone 真机验证）', externalId: `browser-calendar-${context.attemptId}`, output: { simulated: true, startDate: input.startDate } };
  },
});

const routeAdapter = simulated({
  descriptor: { id: 'maps.route.estimate', title: 'Simulate route estimate', risk: 'read', executor: 'server', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['location.route'] },
  async execute(input, context) {
    if (context.signal.aborted) throw new Error('Browser simulation cancelled');
    const arrivalAt = typeof input.arriveBy === 'string' ? new Date(input.arriveBy) : new Date(Date.now() + 60 * 60_000);
    const early = typeof input.arrivalMinutesEarly === 'number' ? input.arrivalMinutesEarly : 0;
    arrivalAt.setMinutes(arrivalAt.getMinutes() - early);
    const departureAt = new Date(arrivalAt.getTime() - 32 * 60_000);
    return { summary: '浏览器模拟：32 分钟通勤路线（仍需真实 Routes 服务验证）', output: { simulated: true, durationSeconds: 1920, departureAt: departureAt.toISOString(), arrivalAt: arrivalAt.toISOString() } };
  },
});

const reminderAdapter = simulated({
  descriptor: { id: 'system.reminder.schedule', title: 'Simulate reminders', risk: 'write', executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['notifications.schedule'] },
  async execute(input, context) {
    if (context.signal.aborted) throw new Error('Browser simulation cancelled');
    const routeDeparture = Object.values(context.dependencyReceipts).map((receipt) => receipt.output?.departureAt).find((value): value is string => typeof value === 'string');
    const departureAt = new Date(routeDeparture ?? String(input.eventStartsAt));
    const preparationAt = new Date(departureAt.getTime() - 30 * 60_000);
    return { summary: '浏览器模拟：准备与出发提醒已生成（仍需 iPhone 真机验证）', externalId: `browser-reminder-${context.attemptId}`, output: { simulated: true, preparationAt: preparationAt.toISOString(), departureAt: departureAt.toISOString() } };
  },
});

export const createDeviceCapabilityRegistry = (_routeClient: RouteApiClient) =>
  new CapabilityRegistry([
    calendarAdapter, routeAdapter, reminderAdapter,
    ...createContentCapabilityAdapters(createEncryptedTaskStore('capability-artifacts')),
    ...createFileCapabilityAdapters(),
  ]);

export { openDocumentResult } from './fileAdapters';

export * from './executor';
export * from './registry';
export * from './types';
