import { CapabilityRisk, ExecutionReceipt, TaskStep } from '../domain/task';

export type CapabilityErrorCode =
  | 'cancelled'
  | 'permission_denied'
  | 'decision_required'
  | 'retryable'
  | 'terminal';

export interface CapabilityDescriptor {
  id: string;
  title: string;
  risk: CapabilityRisk;
  executor: 'device' | 'server';
  interactionMode: 'structured' | 'ui_automation';
  confirmation: 'never' | 'once_per_plan' | 'always';
  scopes: string[];
}

export interface CapabilityExecutionContext {
  userId: string;
  deviceId: string;
  taskId: string;
  revision: number;
  attemptId: string;
  idempotencyKey: string;
  dependencyReceipts: Record<string, ExecutionReceipt>;
  signal: AbortSignal;
}

export interface CapabilityResult {
  summary: string;
  externalId?: string;
  output?: Record<string, unknown>;
}

export interface CapabilityAdapter {
  descriptor: CapabilityDescriptor;
  execute(
    input: TaskStep['input'],
    context: CapabilityExecutionContext,
  ): Promise<CapabilityResult>;
}

export class CapabilityError extends Error {
  constructor(
    public readonly code: CapabilityErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CapabilityError';
  }
}
