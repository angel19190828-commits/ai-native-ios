import assert from 'node:assert/strict';
import test from 'node:test';

import type { KeyValueStore } from '../storage/keyValueStore';
import { ContentArtifactStore } from '../storage/contentArtifactStore';
import { createContentCapabilityAdapters } from './contentAdapters';

const values = new Map<string, string>();
const store: KeyValueStore = {
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => { values.set(key, value); },
  removeItem: async (key) => { values.delete(key); },
};
const context = {
  userId: 'user-1', deviceId: 'device-1', taskId: 'task-1', revision: 1, attemptId: 'attempt-1',
  idempotencyKey: 'user-1:task-1:1:note', dependencyReceipts: {}, signal: new AbortController().signal,
};

test('note capability persists a real local artifact and reports it as non-simulated', async () => {
  values.clear();
  const note = createContentCapabilityAdapters(store).find((adapter) => adapter.descriptor.id === 'taskspace.notes.create');
  assert.ok(note);
  const result = await note.execute({ title: '旅行清单', content: '护照、充电器', tags: ['旅行'] }, context);
  assert.equal(result.output?.persisted, true);
  assert.equal(result.output?.simulated, false);
  assert.equal((await new ContentArtifactStore(store, 'capability-artifacts').listArtifacts('user-1'))[0].title, '旅行清单');
});

test('message capability creates a draft but never reports sending', async () => {
  values.clear();
  const draft = createContentCapabilityAdapters(store).find((adapter) => adapter.descriptor.id === 'taskspace.messaging.createDraft');
  assert.ok(draft);
  const result = await draft.execute({ recipient: 'Alex', body: '我会晚到十分钟' }, { ...context, idempotencyKey: 'draft-key' });
  assert.equal(result.output?.sent, false);
  assert.match(result.summary, /未发送/);
});

test('approval demo is high-impact but records only a simulated non-send receipt', async () => {
  const demo = createContentCapabilityAdapters(store).find((adapter) => adapter.descriptor.id === 'taskspace.messaging.approvalDemo');
  assert.ok(demo);
  assert.equal(demo.descriptor.confirmation, 'always');
  const result = await demo.execute({ recipient: 'alex@example.com', body: '项目已经完成' }, { ...context, idempotencyKey: 'approval-demo' });
  assert.equal(result.output?.sent, false);
  assert.equal(result.output?.referenceOnly, true);
  assert.match(result.summary, /没有发送/);
});

test('preference capability saves only explicit input', async () => {
  values.clear();
  const preference = createContentCapabilityAdapters(store).find((adapter) => adapter.descriptor.id === 'taskspace.preferences.set');
  assert.ok(preference);
  await preference.execute({ key: 'transport', value: '优先公交' }, { ...context, idempotencyKey: 'preference-key' });
  const saved = await new ContentArtifactStore(store, 'capability-artifacts').listPreferences('user-1');
  assert.deepEqual(saved.map(({ key, value }) => ({ key, value })), [{ key: 'transport', value: '优先公交' }]);
});
