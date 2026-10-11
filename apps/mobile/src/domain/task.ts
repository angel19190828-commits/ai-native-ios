import type { StepInputBinding, TaskContext, TaskTrigger, UserGoal } from './orchestration';

export type TaskPhase =
  | 'draft'
  | 'planning'
  | 'needs_decision'
  | 'ready'
  | 'waiting'
  | 'executing'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'stopped';

export type StepStatus =
  | 'waiting'
  | 'running'
  | 'needs_decision'
  | 'completed'
  | 'failed'
  | 'stopped';

export type CapabilityRisk = 'read' | 'write' | 'external-action' | 'destructive';

export interface CapabilityPolicySnapshot {
  executor: 'device' | 'server';
  interactionMode: 'structured' | 'ui_automation';
  confirmation: 'never' | 'once_per_plan' | 'always';
  scopes: string[];
}

export interface TaskFacts {
  title: string;
  startsAt: string;
  address: string;
  preparation: string[];
  origin?: string;
  departureAt?: string;
  arrivalAt?: string;
  transportMode?: 'walk' | 'bike' | 'transit' | 'drive';
}

export interface TaskStep {
  id: string;
  capabilityId: string;
  title: string;
  risk: CapabilityRisk;
  policy?: CapabilityPolicySnapshot;
  status: StepStatus;
  dependsOn: string[];
  input: Record<string, unknown>;
  bindings?: StepInputBinding[];
  condition?: {
    kind: 'always' | 'receipt-match' | 'user-approved';
    configuration: Record<string, unknown>;
  };
  receipt?: ExecutionReceipt;
  approval?: {
    revision: number;
    capabilityId: string;
    input: Record<string, unknown>;
    approvedAt: string;
  };
}

export interface ExecutionReceipt {
  attemptId: string;
  idempotencyKey: string;
  completedAt: string;
  summary: string;
  externalId?: string;
  output?: Record<string, unknown>;
}

export interface TaskOccurrence {
  sequence: number;
  scheduledFor: string;
  completedAt: string;
  status: 'completed' | 'failed';
  failedStepIds: string[];
  receipts: Array<{ stepId: string; receipt: ExecutionReceipt }>;
}

export interface ConfirmedPlan {
  revision: number;
  digest: string;
  confirmedAt: string;
  steps: TaskStep[];
}

export interface Task {
  id: string;
  syncVersion?: number;
  request: string;
  /** Generic orchestration model. Optional only while restoring pre-pivot caches. */
  goal?: UserGoal;
  context?: TaskContext[];
  triggers?: TaskTrigger[];
  phase: TaskPhase;
  revision: number;
  facts: TaskFacts;
  steps: TaskStep[];
  pendingDecision?: {
    id: string;
    prompt: string;
    options: string[];
  };
  confirmedPlan?: ConfirmedPlan;
  triggerState?: { nextRunAt: string; occurrence: number };
  occurrences?: TaskOccurrence[];
  stopRequested: boolean;
  updatedAt: string;
}

export type TaskEvent =
  | { type: 'planning.started'; at: string }
  | { type: 'planning.ready'; at: string; facts: TaskFacts; steps: TaskStep[]; goal?: UserGoal; context?: TaskContext[]; triggers?: TaskTrigger[] }
  | { type: 'decision.required'; at: string; decision: NonNullable<Task['pendingDecision']> }
  | { type: 'decision.resolved'; at: string }
  | { type: 'plan.confirmed'; at: string; snapshot: ConfirmedPlan }
  | { type: 'trigger.waiting'; at: string; runAt: string }
  | { type: 'trigger.fired'; at: string }
  | { type: 'recurrence.scheduled'; at: string; nextRunAt: string }
  | { type: 'execution.started'; at: string }
  | { type: 'step.approved'; at: string; stepId: string; revision: number; capabilityId: string; input: Record<string, unknown> }
  | { type: 'step.approval_declined'; at: string; stepId: string }
  | { type: 'step.running'; at: string; stepId: string }
  | { type: 'step.completed'; at: string; stepId: string; receipt: ExecutionReceipt }
  | { type: 'step.failed'; at: string; stepId: string }
  | { type: 'stop.requested'; at: string }
  | { type: 'task.stopped'; at: string };
