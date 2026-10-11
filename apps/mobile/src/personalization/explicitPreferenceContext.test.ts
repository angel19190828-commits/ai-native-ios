import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExplicitPreferenceContext, explicitPreferenceSummary } from './explicitPreferenceContext';

test('personal context contains only bounded explicit preference fields', () => {
  const preferences = Array.from({ length: 15 }, (_, index) => ({
    key: `key-${index}`, value: `value-${index}`, category: 'files', updatedAt: '2026-09-20T00:00:00.000Z',
    taskId: `private-task-${index}`, idempotencyKey: `private-attempt-${index}`,
  }));
  const context = buildExplicitPreferenceContext(preferences);
  assert.ok(context);
  assert.equal(context.kind, 'app-content');
  const parsed = JSON.parse(context.content) as { preferences: Array<Record<string, unknown>> };
  assert.equal(parsed.preferences.length, 12);
  assert.deepEqual(parsed.preferences[0], { key: 'key-3', value: 'value-3', category: 'files' });
  assert.equal(context.content.includes('private-task'), false);
  assert.equal(context.content.includes('private-attempt'), false);
});

test('presentation summary reads only the explicit preference context snapshot', () => {
  const input = buildExplicitPreferenceContext([{
    key: '文件格式', value: 'Markdown', category: 'files', updatedAt: '2026-09-20T00:00:00.000Z',
    taskId: 'task-1', idempotencyKey: 'attempt-1',
  }]);
  assert.ok(input);
  assert.equal(explicitPreferenceSummary([{ id: input.id ?? 'preferences', kind: input.kind, sourceApp: input.sourceApp, title: input.title, data: { content: input.content } }]), '文件格式：Markdown');
});
