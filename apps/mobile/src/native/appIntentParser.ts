export interface TaskspaceAppIntentInvocation {
  id: string;
  name: 'createTask' | 'showPendingDecision' | 'continueTask' | 'requestStopTask';
  params: Record<string, string>;
  createdAt: number;
}

export function parseAppIntentInvocations(encoded: string[]): TaskspaceAppIntentInvocation[] {
  return encoded.flatMap((value) => {
    try {
      const invocation = JSON.parse(value) as Partial<TaskspaceAppIntentInvocation>;
      if (typeof invocation.id !== 'string' || typeof invocation.name !== 'string' || typeof invocation.createdAt !== 'number') return [];
      if (!['createTask', 'showPendingDecision', 'continueTask', 'requestStopTask'].includes(invocation.name)) return [];
      return [{ ...invocation, params: invocation.params ?? {} } as TaskspaceAppIntentInvocation];
    } catch { return []; }
  });
}
