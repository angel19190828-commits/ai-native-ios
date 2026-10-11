import assert from 'node:assert/strict';
import test from 'node:test';

import type { KeyValueStore } from './keyValueStore';
import { ContentArtifactStore } from './contentArtifactStore';

const memoryStore = (): KeyValueStore => {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
};

test('content artifacts persist and deduplicate by idempotency key', async () => {
  const store = new ContentArtifactStore(memoryStore(), 'test');
  const note = {
    id: 'note-1', kind: 'note' as const, title: '攀岩清单', content: '鞋、水',
    createdAt: '2026-09-20T00:00:00.000Z', taskId: 'task-1', idempotencyKey: 'same-key',
  };
  await store.saveArtifact('user-1', note);
  await store.saveArtifact('user-1', { ...note, id: 'note-2' });
  assert.deepEqual(await store.listArtifacts('user-1'), [note]);
});

test('explicit preferences replace the same key without collecting inferred behavior', async () => {
  const store = new ContentArtifactStore(memoryStore(), 'test');
  await store.savePreference('user-1', {
    key: 'food', value: '素食', updatedAt: '2026-09-20T00:00:00.000Z', taskId: 'task-1', idempotencyKey: 'one',
  });
  await store.savePreference('user-1', {
    key: 'food', value: '纯素', updatedAt: '2026-09-21T00:00:00.000Z', taskId: 'task-2', idempotencyKey: 'two',
  });
  assert.equal((await store.listPreferences('user-1'))[0].value, '纯素');
});
