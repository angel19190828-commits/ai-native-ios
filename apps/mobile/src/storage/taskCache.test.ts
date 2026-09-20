import assert from 'node:assert/strict';
import test from 'node:test';

import { interviewTask } from '../domain/fixture';
import { KeyValueStore } from './keyValueStore';
import { TaskCache, TaskCacheCorruptedError } from './taskCache';

class MemoryStore implements KeyValueStore {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

const at = '2026-09-19T20:00:00.000Z';

test('task and composer draft survive repository recreation', async () => {
  const store = new MemoryStore();
  const first = new TaskCache(store);
  await first.save(structuredClone(interviewTask));
  await first.saveDraft(interviewTask.id, '改成十一点半');

  const afterRestart = new TaskCache(store);
  assert.deepEqual(await afterRestart.load(interviewTask.id), interviewTask);
  assert.equal(await afterRestart.loadDraft(interviewTask.id), '改成十一点半');
  assert.deepEqual((await afterRestart.list()).map((task) => task.id), [interviewTask.id]);
});

test('append persists replayable task events across restart', async () => {
  const store = new MemoryStore();
  const cache = new TaskCache(store);
  await cache.save(structuredClone(interviewTask));
  await cache.append(interviewTask.id, {
    type: 'plan.confirmed',
    at,
    snapshot: {
      revision: 1,
      digest: 'revision-1',
      confirmedAt: at,
      steps: structuredClone(interviewTask.steps),
    },
  });
  await cache.append(interviewTask.id, { type: 'execution.started', at });

  const restored = await new TaskCache(store).load(interviewTask.id);
  assert.equal(restored?.phase, 'executing');
  assert.equal(restored?.confirmedPlan?.digest, 'revision-1');
});

test('compaction preserves the current state and bounds the event log', async () => {
  const store = new MemoryStore();
  const cache = new TaskCache(store, 2);
  await cache.save(structuredClone(interviewTask));
  await cache.append(interviewTask.id, { type: 'planning.started', at });
  await cache.append(interviewTask.id, {
    type: 'planning.ready',
    at,
    facts: structuredClone(interviewTask.facts),
    steps: structuredClone(interviewTask.steps),
  });

  const restored = await cache.load(interviewTask.id);
  assert.equal(restored?.phase, 'ready');
  assert.equal(restored?.revision, 2);
  const raw = [...store.values.entries()].find(([key]) => key.includes(':task:v1:'))?.[1];
  assert.equal(raw ? JSON.parse(raw).events.length : -1, 0);
});

test('remove deletes task, draft, and index entry', async () => {
  const store = new MemoryStore();
  const cache = new TaskCache(store);
  await cache.save(structuredClone(interviewTask));
  await cache.saveDraft(interviewTask.id, 'draft');
  await cache.remove(interviewTask.id);

  assert.equal(await cache.load(interviewTask.id), undefined);
  assert.equal(await cache.loadDraft(interviewTask.id), '');
  assert.deepEqual(await cache.list(), []);
});

test('corrupted storage fails explicitly instead of silently resetting user work', async () => {
  const store = new MemoryStore();
  store.values.set('taskspace:local:tasks:v1', '{not-json');
  await assert.rejects(() => new TaskCache(store).list(), TaskCacheCorruptedError);
});

test('account namespaces cannot read each other tasks or drafts', async () => {
  const store = new MemoryStore();
  const alice = new TaskCache(store, 50, 'alice');
  const bob = new TaskCache(store, 50, 'bob');
  await alice.save(structuredClone(interviewTask));
  await alice.saveDraft(interviewTask.id, 'Alice draft');
  assert.equal(await bob.load(interviewTask.id), undefined);
  assert.equal(await bob.loadDraft(interviewTask.id), '');
  assert.deepEqual(await bob.list(), []);
});

test('clearAll removes every task, draft, and account index', async () => {
  const store = new MemoryStore();
  const cache = new TaskCache(store, 50, 'alice');
  const second = { ...structuredClone(interviewTask), id: 'task-2' };
  await cache.save(structuredClone(interviewTask));
  await cache.save(second);
  await cache.saveDraft(interviewTask.id, 'private draft');
  await cache.clearAll();
  assert.deepEqual(await cache.list(), []);
  assert.equal(await cache.load(interviewTask.id), undefined);
  assert.equal(await cache.loadDraft(interviewTask.id), '');
});
