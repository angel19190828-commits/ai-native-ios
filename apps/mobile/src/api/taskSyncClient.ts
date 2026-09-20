import { Task, TaskEvent } from '../domain/task';

export class TaskSyncError extends Error {
  constructor(public readonly code: string, public readonly status?: number) {
    super(`Task sync failed: ${code}`);
    this.name = 'TaskSyncError';
  }
}

interface Options {
  baseUrl: string;
  getAccessToken?: () => Promise<string | undefined>;
  fetch?: typeof fetch;
}

const isTask = (value: unknown): value is Task => {
  if (!value || typeof value !== 'object') return false;
  const task = value as Partial<Task>;
  return typeof task.id === 'string'
    && typeof task.request === 'string'
    && typeof task.phase === 'string'
    && Number.isInteger(task.revision)
    && task.facts !== undefined
    && Array.isArray(task.steps)
    && typeof task.stopRequested === 'boolean'
    && typeof task.updatedAt === 'string';
};

export class TaskSyncClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly options: Options) { this.fetchImpl = options.fetch ?? fetch; }

  private async headers() {
    const token = await this.options.getAccessToken?.();
    if (!token) throw new TaskSyncError('authentication_required');
    return { 'content-type': 'application/json', authorization: `Bearer ${token}` };
  }

  async latest(): Promise<Task | undefined> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/api/tasks`, { headers: await this.headers() });
    const payload = await response.json() as { tasks?: unknown[]; error?: { code?: string } };
    if (!response.ok) throw new TaskSyncError(payload.error?.code ?? 'task_read_failed', response.status);
    const first = payload.tasks?.[0];
    if (first === undefined) return undefined;
    if (!isTask(first)) throw new TaskSyncError('invalid_task_response', response.status);
    return first;
  }

  async sync(task: Task, event?: TaskEvent | { type: 'task.created'; at: string }): Promise<Task> {
    const response = await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, '')}/api/tasks`, {
      method: 'PUT',
      headers: await this.headers(),
      body: JSON.stringify({ task, event }),
    });
    const payload = await response.json() as { task?: unknown; error?: { code?: string } };
    if (!response.ok) throw new TaskSyncError(payload.error?.code ?? 'task_write_failed', response.status);
    if (!isTask(payload.task)) throw new TaskSyncError('invalid_task_response', response.status);
    return payload.task;
  }
}
