import { ProposedPlan } from '../api/aiClient';
import { Task, TaskStep } from './task';

interface CreateTaskOptions {
  id: string;
  request: string;
  plan: ProposedPlan;
  now: string;
  origin?: string;
}

export function createTaskFromPlan({ id, request, plan, now, origin }: CreateTaskOptions): Task {
  const calendar: TaskStep = {
    id: 'calendar',
    capabilityId: 'system.calendar.createEvent',
    title: `创建${plan.title}日历`,
    risk: 'write',
    status: 'waiting',
    dependsOn: [],
    input: {
      title: plan.title,
      startDate: plan.startsAt,
      endDate: plan.endsAt,
      location: plan.location,
      notes: plan.preparation.join('、'),
    },
  };
  const commute: TaskStep = {
    id: 'commute',
    capabilityId: 'maps.route.estimate',
    title: '计算通勤安排',
    risk: 'read',
    status: 'waiting',
    dependsOn: ['calendar'],
    input: {
      destination: plan.location,
      origin,
      arriveBy: plan.startsAt,
      arrivalMinutesEarly: plan.arrivalMinutesEarly,
    },
  };
  const reminders: TaskStep = {
    id: 'reminders',
    capabilityId: 'system.reminder.schedule',
    title: '设置准备和出发提醒',
    risk: 'write',
    status: 'waiting',
    dependsOn: ['commute'],
    input: {
      preparation: plan.preparation,
      eventStartsAt: plan.startsAt,
      preparationMinutesBeforeDeparture: 30,
    },
  };
  const steps = plan.kind === 'appointment' ? [calendar, commute, reminders] : [calendar, reminders];
  if (plan.kind !== 'appointment') reminders.dependsOn = ['calendar'];
  const missingFields = plan.missingFields.filter((field) => field !== 'origin' || !origin);
  const needsDecision = missingFields.length > 0;

  return {
    id,
    request,
    phase: needsDecision ? 'needs_decision' : 'ready',
    revision: 1,
    stopRequested: false,
    updatedAt: now,
    facts: {
      title: plan.title,
      startsAt: plan.startsAt,
      address: plan.location,
      preparation: plan.preparation,
      origin,
    },
    steps,
    pendingDecision: needsDecision ? {
      id: 'complete-missing-plan-fields',
      prompt: `还需要确认：${missingFields.join('、')}`,
      options: [],
    } : undefined,
  };
}
