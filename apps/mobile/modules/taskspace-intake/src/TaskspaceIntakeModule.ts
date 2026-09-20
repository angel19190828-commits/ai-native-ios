import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class TaskspaceIntakeModule extends NativeModule<{}> {
  consumeSharedTextAsync(): Promise<string | null>;
}

export default requireOptionalNativeModule<TaskspaceIntakeModule>('TaskspaceIntake');
