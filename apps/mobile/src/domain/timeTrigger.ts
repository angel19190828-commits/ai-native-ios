import type { Task } from './task';

export function taskRunAt(task: Pick<Task, 'triggers'>): string | undefined {
  const trigger = task.triggers?.find((candidate) => candidate.kind === 'time');
  const runAt = trigger?.configuration.runAt;
  return typeof runAt === 'string' && !Number.isNaN(Date.parse(runAt)) ? runAt : undefined;
}

export type RecurrenceFrequency = 'minute' | 'daily' | 'weekly';

export function taskRecurrence(task: Pick<Task, 'triggers'>): { frequency: RecurrenceFrequency; interval: number } | undefined {
  const value = task.triggers?.find((candidate) => candidate.kind === 'time')?.configuration.recurrence;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const frequency = (value as Record<string, unknown>).frequency;
  const interval = (value as Record<string, unknown>).interval;
  return (frequency === 'minute' || frequency === 'daily' || frequency === 'weekly')
    && Number.isInteger(interval) && Number(interval) >= 1 && Number(interval) <= 52
    ? { frequency, interval: Number(interval) } : undefined;
}

export function nextTaskRunAt(task: Pick<Task, 'triggers' | 'triggerState'>) {
  return task.triggerState?.nextRunAt ?? taskRunAt(task);
}

export function waitsForFutureTime(task: Pick<Task, 'triggers' | 'triggerState'>, now = Date.now()) {
  const runAt = nextTaskRunAt(task);
  return runAt && Date.parse(runAt) > now ? runAt : undefined;
}

export function nextRecurrenceRun(task: Pick<Task, 'triggers' | 'triggerState'>, after = Date.now()) {
  const recurrence = taskRecurrence(task);
  const anchor = nextTaskRunAt(task);
  if (!recurrence || !anchor) return undefined;
  const unit = recurrence.frequency === 'minute' ? 60_000 : recurrence.frequency === 'daily' ? 86_400_000 : 604_800_000;
  let next = Date.parse(anchor) + recurrence.interval * unit;
  while (next <= after) next += recurrence.interval * unit;
  return new Date(next).toISOString();
}
