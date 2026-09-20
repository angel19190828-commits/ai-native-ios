import { CapabilityAdapter, CapabilityError } from './types';

interface NotificationRequest {
  content: { title: string; body: string; data: Record<string, string> };
  trigger: { type: 'date'; date: Date; channelId?: string };
}

export interface NotificationPort {
  getPermissionsAsync(): Promise<{ granted: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  setNotificationChannelAsync(id: string, channel: { name: string; importance: number }): Promise<unknown>;
  scheduleNotificationAsync(request: NotificationRequest): Promise<string>;
}

export const createReminderAdapter = (
  notifications: NotificationPort,
  platform: string,
  now: () => number = Date.now,
  highImportance = 4,
): CapabilityAdapter => ({
  descriptor: { id: 'system.reminder.schedule', title: 'Schedule preparation reminders', risk: 'write', executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['notifications.schedule'] },
  async execute(input, context) {
    const commuteDeparture = Object.values(context.dependencyReceipts)
      .map((receipt) => receipt.output?.departureAt)
      .find((value): value is string => typeof value === 'string');
    const fallbackStart = input.eventStartsAt;
    const departureValue = typeof commuteDeparture === 'string' ? commuteDeparture : typeof fallbackStart === 'string' ? fallbackStart : '';
    const departureAt = new Date(departureValue);
    const leadMinutes = typeof input.preparationMinutesBeforeDeparture === 'number' ? input.preparationMinutesBeforeDeparture : 30;
    const preparationAt = new Date(departureAt.getTime() - leadMinutes * 60_000);
    if (Number.isNaN(departureAt.getTime())) throw new CapabilityError('terminal', 'Reminder time is missing');
    if (preparationAt.getTime() <= now()) throw new CapabilityError('decision_required', 'The proposed reminder time is in the past');

    if (platform === 'android') await notifications.setNotificationChannelAsync('task-reminders', { name: 'Task reminders', importance: highImportance });
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted) permission = await notifications.requestPermissionsAsync();
    if (!permission.granted) throw new CapabilityError('permission_denied', 'Notification permission was not granted');
    if (context.signal.aborted) throw new CapabilityError('cancelled', 'Reminder scheduling was cancelled');

    const preparation = Array.isArray(input.preparation) ? input.preparation.filter((item): item is string => typeof item === 'string').join('、') : '';
    const channelId = platform === 'android' ? 'task-reminders' : undefined;
    const preparationId = await notifications.scheduleNotificationAsync({
      content: { title: '准备事项', body: preparation || '开始准备接下来的安排', data: { taskId: context.taskId, stepId: 'reminders' } },
      trigger: { type: 'date', date: preparationAt, ...(channelId ? { channelId } : {}) },
    });
    const departureId = await notifications.scheduleNotificationAsync({
      content: { title: '该出发了', body: '按确认的通勤安排出发', data: { taskId: context.taskId, stepId: 'reminders' } },
      trigger: { type: 'date', date: departureAt, ...(channelId ? { channelId } : {}) },
    });
    return { summary: 'Scheduled preparation and departure reminders', externalId: departureId, output: { preparationId, departureId, preparationAt: preparationAt.toISOString(), departureAt: departureAt.toISOString() } };
  },
});
