import { compilePlanSteps } from './orchestration';
import type { PlanDefinition } from './orchestration';
import type { Task } from './task';

export interface CreateTaskFromDefinitionOptions {
  id: string;
  request: string;
  plan: PlanDefinition;
  now: string;
}

export function createTaskFromDefinition({ id, request, plan, now }: CreateTaskFromDefinitionOptions): Task {
  if (!id.trim() || !request.trim()) throw new Error('A task requires an ID and user intent');
  if (!plan.goal.summary.trim() || !plan.goal.desiredOutcome.trim()) throw new Error('A plan requires a meaningful goal');
  const hasUnresolvedDecision = plan.decisions.some((decision) => decision.required && decision.resolvedValue === undefined);
  if (plan.steps.length === 0 && !hasUnresolvedDecision) throw new Error('A plan requires at least one capability step or unresolved decision');

  const steps = compilePlanSteps(plan.steps);
  const unresolved = plan.decisions.find((decision) => decision.required && decision.resolvedValue === undefined);

  return {
    id,
    request,
    goal: plan.goal,
    context: plan.context,
    triggers: plan.triggers,
    phase: unresolved ? 'needs_decision' : 'ready',
    revision: 1,
    stopRequested: false,
    updatedAt: now,
    facts: plan.presentation,
    steps,
    pendingDecision: unresolved ? {
      id: unresolved.id,
      prompt: unresolved.prompt,
      options: unresolved.options,
    } : undefined,
  };
}
