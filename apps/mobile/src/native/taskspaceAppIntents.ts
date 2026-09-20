import { NativeModule, requireOptionalNativeModule } from 'expo';
import { parseAppIntentInvocations, TaskspaceAppIntentInvocation } from './appIntentParser';

export type { TaskspaceAppIntentInvocation } from './appIntentParser';

declare class TaskspaceAppIntentsModule extends NativeModule<{}> {
  consumePendingInvocationsAsync(): Promise<string[]>;
}

const nativeModule = requireOptionalNativeModule<TaskspaceAppIntentsModule>('TaskspaceAppIntents');

export async function consumeAppIntents(): Promise<TaskspaceAppIntentInvocation[]> {
  if (!nativeModule) return [];
  const encoded = await nativeModule.consumePendingInvocationsAsync();
  return parseAppIntentInvocations(encoded);
}
