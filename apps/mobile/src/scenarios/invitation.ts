import type { ProposedPlan } from '../api/aiClient';
import type { PlanDefinition, PlanDecision, PlanStepDefinition } from '../domain/orchestration';

export interface InvitationPlanOptions {
  request: string;
  plan: ProposedPlan;
  origin?: string;
}

/**
 * Reference-scenario adapter. It translates invitation semantics into a generic
 * capability plan; neither the reducer nor executor knows what an interview is.
 */
export function invitationToPlanDefinition({ request, plan, origin }: InvitationPlanOptions): PlanDefinition {
  const calendar: PlanStepDefinition = {
    id: 'calendar',
    capabilityId: 'system.calendar.createEvent',
    title: `创建${plan.title}日历`,
    risk: 'write',
    policy: { executor: 'device', confirmation: 'once_per_plan', scopes: ['calendar.write'] },
    input: {
      title: plan.title,
      startDate: plan.startsAt,
      endDate: plan.endsAt,
      location: plan.location,
      notes: plan.preparation.join('、'),
    },
  };
  const commute: PlanStepDefinition = {
    id: 'commute',
    capabilityId: 'maps.route.estimate',
    title: '计算通勤安排',
    risk: 'read',
    policy: { executor: 'server', confirmation: 'once_per_plan', scopes: ['location.route'] },
    dependsOn: ['calendar'],
    input: {
      destination: plan.location,
      origin,
      arriveBy: plan.startsAt,
      arrivalMinutesEarly: plan.arrivalMinutesEarly,
    },
  };
  const reminders: PlanStepDefinition = {
    id: 'reminders',
    capabilityId: 'system.reminder.schedule',
    title: '设置准备和出发提醒',
    risk: 'write',
    policy: { executor: 'device', confirmation: 'once_per_plan', scopes: ['notifications.schedule'] },
    dependsOn: plan.kind === 'appointment' ? ['commute'] : ['calendar'],
    input: {
      preparation: plan.preparation,
      eventStartsAt: plan.startsAt,
      preparationMinutesBeforeDeparture: 30,
    },
  };

  const missingFields = plan.missingFields.filter((field) => field !== 'origin' || !origin);
  const decisions: PlanDecision[] = missingFields.length ? [{
    id: 'complete-missing-plan-fields',
    prompt: `还需要确认：${missingFields.join('、')}`,
    options: [],
    required: true,
  }] : [];

  return {
    goal: {
      id: 'arrange-invitation',
      summary: request,
      desiredOutcome: `完成${plan.title}的日程、准备与必要提醒`,
    },
    context: [{
      id: 'invitation-source',
      kind: 'email',
      title: plan.sourceSummary,
      data: { sourceText: request, extractedKind: plan.kind },
    }],
    triggers: [{ id: 'user-confirmation', kind: 'manual', configuration: {} }],
    steps: plan.kind === 'appointment' ? [calendar, commute, reminders] : [calendar, reminders],
    decisions,
    presentation: {
      title: plan.title,
      startsAt: plan.startsAt,
      address: plan.location,
      preparation: plan.preparation,
      origin,
    },
  };
}
