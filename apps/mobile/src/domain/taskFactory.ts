import { ProposedPlan } from '../api/aiClient';
import { invitationToPlanDefinition } from '../scenarios/invitation';
import { createTaskFromDefinition } from './planCompiler';
import { Task } from './task';

interface CreateTaskOptions {
  id: string;
  request: string;
  plan: ProposedPlan;
  now: string;
  origin?: string;
}

export function createTaskFromPlan({ id, request, plan, now, origin }: CreateTaskOptions): Task {
  return createTaskFromDefinition({
    id,
    request,
    now,
    plan: invitationToPlanDefinition({ request, plan, origin }),
  });
}
