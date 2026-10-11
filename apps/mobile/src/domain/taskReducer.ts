import { Task, TaskEvent, TaskStep } from './task';

const updateStep = (steps: TaskStep[], stepId: string, update: (step: TaskStep) => TaskStep) =>
  steps.map((step) => (step.id === stepId ? update(step) : step));

const requireStep = (task: Task, stepId: string) => {
  const step = task.steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Unknown step: ${stepId}`);
  return step;
};

const requireExecuting = (task: Task) => {
  if (task.phase !== 'executing') throw new Error('Step transitions require an executing task');
  if (task.stopRequested) throw new Error('New step transitions are blocked after stop is requested');
};

export function taskReducer(task: Task, event: TaskEvent): Task {
  switch (event.type) {
    case 'planning.started':
      return { ...task, phase: 'planning', updatedAt: event.at };
    case 'planning.ready':
      return {
        ...task,
        phase: 'ready',
        revision: task.revision + 1,
        goal: event.goal ?? task.goal,
        context: event.context ?? task.context,
        triggers: event.triggers ?? task.triggers,
        facts: event.facts,
        steps: event.steps,
        pendingDecision: undefined,
        confirmedPlan: undefined,
        updatedAt: event.at,
      };
    case 'decision.required':
      return { ...task, phase: 'needs_decision', pendingDecision: event.decision, updatedAt: event.at };
    case 'decision.resolved':
      return { ...task, phase: 'planning', pendingDecision: undefined, updatedAt: event.at };
    case 'plan.confirmed':
      if (event.snapshot.revision !== task.revision) throw new Error('Cannot confirm a stale task revision');
      return { ...task, phase: 'ready', confirmedPlan: event.snapshot, updatedAt: event.at };
    case 'trigger.waiting':
      if (!task.confirmedPlan || task.confirmedPlan.revision !== task.revision) {
        throw new Error('Waiting requires a confirmed current revision');
      }
      if (Number.isNaN(Date.parse(event.runAt))) throw new Error('Waiting requires a valid run time');
      return { ...task, phase: 'waiting', triggerState: { nextRunAt: event.runAt, occurrence: task.triggerState?.occurrence ?? 1 }, updatedAt: event.at };
    case 'trigger.fired':
      if (task.phase !== 'waiting' || !task.confirmedPlan || task.confirmedPlan.revision !== task.revision) {
        throw new Error('Only a confirmed waiting task can fire');
      }
      return { ...task, phase: 'executing', updatedAt: event.at };
    case 'recurrence.scheduled': {
      if (!['completed', 'failed', 'partially_completed'].includes(task.phase) || Number.isNaN(Date.parse(event.nextRunAt))) {
        throw new Error('Only a finished occurrence can schedule another occurrence');
      }
      const sequence = task.triggerState?.occurrence ?? 1;
      const occurrence = {
        sequence,
        scheduledFor: task.triggerState?.nextRunAt ?? event.at,
        completedAt: event.at,
        status: task.phase === 'completed' ? 'completed' as const : 'failed' as const,
        failedStepIds: task.steps.filter((step) => step.status === 'failed').map((step) => step.id),
        receipts: task.steps.flatMap((step) => step.receipt ? [{ stepId: step.id, receipt: step.receipt }] : []),
      };
      const steps = task.steps.map((step) => ({ ...step, status: 'waiting' as const, receipt: undefined, approval: undefined }));
      return {
        ...task,
        phase: 'waiting',
        steps,
        triggerState: { nextRunAt: event.nextRunAt, occurrence: sequence + 1 },
        occurrences: [...(task.occurrences ?? []), occurrence].slice(-20),
        updatedAt: event.at,
      };
    }
    case 'execution.started':
      if (!task.confirmedPlan || task.confirmedPlan.revision !== task.revision) {
        throw new Error('Execution requires a confirmed current revision');
      }
      return { ...task, phase: task.steps.length > 0 && task.steps.every((step) => step.status === 'completed') ? 'completed' : 'executing', stopRequested: false, updatedAt: event.at };
    case 'step.approved': {
      requireExecuting(task);
      const step = requireStep(task, event.stepId);
      if (step.status !== 'waiting' || event.revision !== task.revision || event.capabilityId !== step.capabilityId) {
        throw new Error('Approval does not match the current action');
      }
      return {
        ...task,
        steps: updateStep(task.steps, event.stepId, (candidate) => ({
          ...candidate,
          approval: {
            revision: event.revision,
            capabilityId: event.capabilityId,
            input: JSON.parse(JSON.stringify(event.input)) as Record<string, unknown>,
            approvedAt: event.at,
          },
        })),
        updatedAt: event.at,
      };
    }
    case 'step.approval_declined': {
      requireExecuting(task);
      const step = requireStep(task, event.stepId);
      if (step.status !== 'waiting') throw new Error(`Step is not waiting: ${event.stepId}`);
      return { ...task, phase: 'ready', confirmedPlan: undefined, updatedAt: event.at };
    }
    case 'step.running': {
      requireExecuting(task);
      const step = requireStep(task, event.stepId);
      if (step.status !== 'waiting') throw new Error(`Step is not waiting: ${event.stepId}`);
      const incompleteDependency = step.dependsOn.some(
        (dependencyId) => task.steps.find((candidate) => candidate.id === dependencyId)?.status !== 'completed',
      );
      if (incompleteDependency) throw new Error(`Step dependencies are incomplete: ${event.stepId}`);
      return {
        ...task,
        steps: updateStep(task.steps, event.stepId, (candidate) => ({ ...candidate, status: 'running' })),
        updatedAt: event.at,
      };
    }
    case 'step.completed': {
      requireExecuting(task);
      const step = requireStep(task, event.stepId);
      if (step.status !== 'running') throw new Error(`Step is not running: ${event.stepId}`);
      const steps = updateStep(task.steps, event.stepId, (candidate) => ({
        ...candidate,
        status: 'completed',
        receipt: event.receipt,
      }));
      const complete = steps.every((step) => step.status === 'completed');
      return { ...task, steps, phase: complete ? 'completed' : task.phase, updatedAt: event.at };
    }
    case 'step.failed': {
      requireExecuting(task);
      const step = requireStep(task, event.stepId);
      if (step.status !== 'running') throw new Error(`Step is not running: ${event.stepId}`);
      const steps = updateStep(task.steps, event.stepId, (candidate) => ({ ...candidate, status: 'failed' }));
      const hasCompleted = steps.some((step) => step.status === 'completed');
      return { ...task, steps, phase: hasCompleted ? 'partially_completed' : 'failed', updatedAt: event.at };
    }
    case 'stop.requested':
      return { ...task, stopRequested: true, updatedAt: event.at };
    case 'task.stopped':
      if (!task.stopRequested) throw new Error('Task cannot stop before stop is requested');
      return {
        ...task,
        phase: 'stopped',
        steps: task.steps.map((step) =>
          step.status === 'waiting' || step.status === 'running' || step.status === 'needs_decision'
            ? { ...step, status: 'stopped' }
            : step,
        ),
        updatedAt: event.at,
      };
  }
}
