import { Task, TaskEvent } from '../domain/task';
import { taskReducer } from '../domain/taskReducer';
import { KeyValueStore } from './keyValueStore';

const VERSION = 1;

interface PersistedTask {
  version: typeof VERSION;
  base: Task;
  events: TaskEvent[];
}

export class TaskCacheCorruptedError extends Error {
  constructor(public readonly key: string, cause?: unknown) {
    super(`Task cache is corrupted: ${key}`, { cause });
    this.name = 'TaskCacheCorruptedError';
  }
}

const parse = <T>(key: string, raw: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new TaskCacheCorruptedError(key, error);
  }
};

export class TaskCache {
  constructor(
    private readonly store: KeyValueStore,
    private readonly compactAfter = 50,
    private readonly namespace = 'local',
  ) {}

  private get indexKey() { return `taskspace:${this.namespace}:tasks:v1`; }
  private taskKey(taskId: string) { return `taskspace:${this.namespace}:task:v1:${taskId}`; }
  private draftKey(taskId: string) { return `taskspace:${this.namespace}:draft:v1:${taskId}`; }

  async save(task: Task) {
    const record: PersistedTask = { version: VERSION, base: task, events: [] };
    await this.store.setItem(this.taskKey(task.id), JSON.stringify(record));
    const ids = await this.listIds();
    if (!ids.includes(task.id)) {
      await this.store.setItem(this.indexKey, JSON.stringify([...ids, task.id]));
    }
  }

  async append(taskId: string, event: TaskEvent) {
    const key = this.taskKey(taskId);
    const record = await this.readRecord(key);
    if (!record) throw new Error(`Cannot append to missing task: ${taskId}`);
    const current = this.replay(record);
    const next = taskReducer(current, event);
    const nextRecord: PersistedTask = record.events.length + 1 >= this.compactAfter
      ? { version: VERSION, base: next, events: [] }
      : { ...record, events: [...record.events, event] };
    await this.store.setItem(key, JSON.stringify(nextRecord));
    return next;
  }

  async load(taskId: string) {
    const record = await this.readRecord(this.taskKey(taskId));
    return record ? this.replay(record) : undefined;
  }

  async list() {
    const tasks = await Promise.all((await this.listIds()).map((taskId) => this.load(taskId)));
    return tasks.filter((task): task is Task => task !== undefined);
  }

  async remove(taskId: string) {
    await this.store.removeItem(this.taskKey(taskId));
    await this.store.removeItem(this.draftKey(taskId));
    const ids = (await this.listIds()).filter((id) => id !== taskId);
    await this.store.setItem(this.indexKey, JSON.stringify(ids));
  }

  async saveDraft(taskId: string, draft: string) {
    await this.store.setItem(this.draftKey(taskId), draft);
  }

  async loadDraft(taskId: string) {
    return (await this.store.getItem(this.draftKey(taskId))) ?? '';
  }

  private replay(record: PersistedTask) {
    if (record.version !== VERSION || !record.base || !Array.isArray(record.events)) {
      throw new TaskCacheCorruptedError(this.taskKey(record.base?.id ?? 'unknown'));
    }
    return record.events.reduce(taskReducer, record.base);
  }

  private async readRecord(key: string) {
    const raw = await this.store.getItem(key);
    return raw ? parse<PersistedTask>(key, raw) : undefined;
  }

  private async listIds() {
    const raw = await this.store.getItem(this.indexKey);
    if (!raw) return [];
    const ids = parse<unknown>(this.indexKey, raw);
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      throw new TaskCacheCorruptedError(this.indexKey);
    }
    return ids as string[];
  }
}
