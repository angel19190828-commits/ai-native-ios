import type { CapabilityPolicySnapshot, CapabilityRisk, TaskFacts, TaskStep } from './task';

export type ContextKind = 'direct-input' | 'email' | 'message' | 'webpage' | 'app-content' | 'shared-content';

export interface UserGoal {
  id: string;
  summary: string;
  desiredOutcome: string;
}

export interface TaskContext {
  id: string;
  kind: ContextKind;
  sourceApp?: string;
  sourceUri?: string;
  title?: string;
  data: Record<string, unknown>;
}

export type TriggerKind = 'manual' | 'time' | 'event' | 'condition';

export interface TaskTrigger {
  id: string;
  kind: TriggerKind;
  configuration: Record<string, unknown>;
}

export interface PlanDecision {
  id: string;
  prompt: string;
  options: string[];
  required: boolean;
  resolvedValue?: unknown;
}

export interface PlanStepDefinition {
  id: string;
  capabilityId: string;
  title: string;
  risk: CapabilityRisk;
  policy?: CapabilityPolicySnapshot;
  dependsOn?: string[];
  input: Record<string, unknown>;
  condition?: {
    kind: 'always' | 'receipt-match' | 'user-approved';
    configuration: Record<string, unknown>;
  };
}

export interface PlanDefinition {
  goal: UserGoal;
  context: TaskContext[];
  triggers: TaskTrigger[];
  steps: PlanStepDefinition[];
  decisions: PlanDecision[];
  /** Reference-scenario view data. The orchestration kernel never interprets this. */
  presentation: TaskFacts;
}

export const compilePlanSteps = (definitions: PlanStepDefinition[]): TaskStep[] => {
  const ids = new Set<string>();
  for (const step of definitions) {
    if (!step.id.trim() || !step.capabilityId.trim()) throw new Error('Plan steps require stable IDs and capability IDs');
    if (ids.has(step.id)) throw new Error(`Duplicate plan step: ${step.id}`);
    ids.add(step.id);
  }
  for (const step of definitions) {
    for (const dependency of step.dependsOn ?? []) {
      if (!ids.has(dependency)) throw new Error(`Unknown dependency ${dependency} for ${step.id}`);
      if (dependency === step.id) throw new Error(`Plan step cannot depend on itself: ${step.id}`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(definitions.map((step) => [step.id, step]));
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`Plan dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const step of definitions) visit(step.id);

  return definitions.map((step) => ({
    ...step,
    status: 'waiting',
    dependsOn: [...(step.dependsOn ?? [])],
  }));
};
