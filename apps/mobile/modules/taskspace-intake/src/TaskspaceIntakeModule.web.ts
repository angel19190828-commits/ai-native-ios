import { registerWebModule, NativeModule } from 'expo';

// TaskspaceIntakeModule is not available on the web platform.
class TaskspaceIntakeModule extends NativeModule<{}> {}

export default registerWebModule(TaskspaceIntakeModule, 'TaskspaceIntakeModule');
