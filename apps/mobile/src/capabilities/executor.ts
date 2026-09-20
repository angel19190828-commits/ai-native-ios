import { Task, TaskEvent } from '../domain/task';
import { CapabilityRegistry } from './registry';
import { CapabilityError } from './types';

export interface ExecuteNextOptions {
  userId: string;
  deviceId: string;
  signal?: AbortSignal;
  now?: () => string;
  createAttemptId?: () => string;
  onEvent?: (event: TaskEvent) => Promise<void>;
}

export interface StepExecutionOutcome {
  events: TaskEvent[];
  error?: CapabilityError;
}

export const createIdempotencyKey = (userId: string, task: Task, stepId: string) =>
  `${userId}:${task.id}:${task.revision}:${stepId}`;

const asCapabilityError = (error: unknown) => {
  if (error instanceof CapabilityError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new CapabilityError('cancelled', 'Capability execution was cancelled', error);
  }
  return new CapabilityError(
    'terminal',
    error instanceof Error ? error.message : 'Unknown capability error',
    error,
  );
};

export async function executeNextStep(
  task: Task,
  registry: CapabilityRegistry,
  options: ExecuteNextOptions,
): Promise<StepExecutionOutcome | undefined> {
  if (task.phase !== 'executing') throw new Error('Task must be executing');
  if (task.stopRequested) return undefined;

  const step = task.steps.find(
    (candidate) =>
      candidate.status === 'waiting' &&
      candidate.dependsOn.every(
        (dependencyId) => task.steps.find((dependency) => dependency.id === dependencyId)?.status === 'completed',
      ),
  );
  if (!step) return undefined;

  const adapter = registry.require(step.capabilityId);
  if (adapter.descriptor.risk !== step.risk) {
    throw new Error(`Capability risk mismatch: ${step.capabilityId}`);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();

  const now = options.now ?? (() => new Date().toISOString());
  const attemptId = options.createAttemptId?.() ?? `${task.id}:${step.id}:${Date.now()}`;
  const dependencyReceipts = Object.fromEntries(
    step.dependsOn.flatMap((dependencyId) => {
      const receipt = task.steps.find((candidate) => candidate.id === dependencyId)?.receipt;
      return receipt ? [[dependencyId, receipt]] : [];
    }),
  );
  const running: TaskEvent = { type: 'step.running', stepId: step.id, at: now() };

  try {
    await options.onEvent?.(running);
    let result;
    try {
      result = await adapter.execute(step.input, {
        userId: options.userId,
        deviceId: options.deviceId,
        taskId: task.id,
        revision: task.revision,
        attemptId,
        idempotencyKey: createIdempotencyKey(options.userId, task, step.id),
        dependencyReceipts,
        signal: controller.signal,
      });
    } catch (error) {
      const capabilityError = asCapabilityError(error);
      const failed: TaskEvent = { type: 'step.failed', stepId: step.id, at: now() };
      await options.onEvent?.(failed);
      return { events: [running, failed], error: capabilityError };
    }
    const completed: TaskEvent = {
      type: 'step.completed',
      stepId: step.id,
      at: now(),
      receipt: {
        attemptId,
        idempotencyKey: createIdempotencyKey(options.userId, task, step.id),
        completedAt: now(),
        summary: result.summary,
        externalId: result.externalId,
        output: result.output,
      },
    };
    await options.onEvent?.(completed);
    return { events: [running, completed] };
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
}
