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
    case 'execution.started':
      if (!task.confirmedPlan || task.confirmedPlan.revision !== task.revision) {
        throw new Error('Execution requires a confirmed current revision');
      }
      return { ...task, phase: 'executing', stopRequested: false, updatedAt: event.at };
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
