import type { TaskStep } from './task';

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

/** Keeps durable results while applying only the unfinished part of a recovery plan. */
export function mergeRecoverySteps(previous: TaskStep[], proposed: TaskStep[]) {
  const completed = previous.filter((step) => step.status === 'completed');
  const replacements = new Map<string, string>();
  const remaining = proposed.filter((step) => {
    const match = completed.find((done) => done.capabilityId === step.capabilityId
      && canonical(done.input) === canonical(step.input));
    if (!match) return true;
    replacements.set(step.id, match.id);
    return false;
  }).map((step) => ({
    ...step,
    dependsOn: step.dependsOn.map((id) => replacements.get(id) ?? id),
    bindings: step.bindings?.map((binding) => ({ ...binding, fromStepId: replacements.get(binding.fromStepId) ?? binding.fromStepId })),
  }));
  return [...completed, ...remaining];
}
