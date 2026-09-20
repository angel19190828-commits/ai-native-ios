import type { OrchestrationContextInput, OrchestrationProposal } from '../api/orchestratorClient';
import type { PlanDefinition, TaskContext } from '../domain/orchestration';

export interface GenericPlanOptions {
  request: string;
  proposal: OrchestrationProposal;
  context: OrchestrationContextInput[];
  now: string;
  origin?: string;
}

export function genericProposalToPlanDefinition({ request, proposal, context, now, origin }: GenericPlanOptions): PlanDefinition {
  const calendarInput = proposal.steps.find((step) => step.capabilityId === 'system.calendar.createEvent')?.input;
  const routeInput = proposal.steps.find((step) => step.capabilityId === 'maps.route.estimate')?.input;
  const reminderInput = proposal.steps.find((step) => step.capabilityId === 'system.reminder.schedule')?.input;
  const startsAt = typeof calendarInput?.startDate === 'string'
    ? calendarInput.startDate
    : typeof reminderInput?.eventStartsAt === 'string' ? reminderInput.eventStartsAt : now;
  const preparation = Array.isArray(reminderInput?.preparation)
    ? reminderInput.preparation.filter((item): item is string => typeof item === 'string') : [];
  const taskContext: TaskContext[] = context.map((item, index) => ({
    id: item.id?.trim() || `context-${index + 1}`,
    kind: item.kind,
    sourceApp: item.sourceApp,
    title: item.title,
    data: { content: item.content },
  }));

  return {
    goal: { id: 'general-intent', summary: proposal.summary || request, desiredOutcome: proposal.desiredOutcome },
    context: taskContext,
    triggers: proposal.triggers,
    decisions: proposal.decisions,
    steps: proposal.steps,
    presentation: {
      title: proposal.summary || request,
      startsAt,
      address: typeof calendarInput?.location === 'string'
        ? calendarInput.location
        : typeof routeInput?.destination === 'string' ? routeInput.destination : '',
      preparation,
      origin,
    },
  };
}
