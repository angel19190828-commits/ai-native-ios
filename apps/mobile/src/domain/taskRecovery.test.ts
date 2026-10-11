import assert from 'node:assert/strict';
import test from 'node:test';

import type { TaskStep } from './task';
import { mergeRecoverySteps } from './taskRecovery';

test('recovery keeps completed receipts and does not propose the same side effect twice', () => {
  const completed: TaskStep = {
    id: 'saved-note', capabilityId: 'taskspace.notes.create', title: 'Save note', risk: 'write', status: 'completed', dependsOn: [],
    input: { content: 'done', title: 'audit' },
    receipt: { attemptId: 'a1', idempotencyKey: 'k1', completedAt: '2026-09-21T18:00:00Z', summary: 'saved' },
  };
  const duplicate = { ...completed, id: 'save-note-again', status: 'waiting' as const, receipt: undefined };
  const next: TaskStep = {
    id: 'create-file', capabilityId: 'files.document.create', title: 'Create file', risk: 'write', status: 'waiting',
    dependsOn: ['save-note-again'], input: { fileName: 'result.md', content: 'done' },
  };
  const merged = mergeRecoverySteps([completed], [duplicate, next]);
  assert.deepEqual(merged.map((step) => step.id), ['saved-note', 'create-file']);
  assert.equal(merged[0].receipt?.summary, 'saved');
  assert.deepEqual(merged[1].dependsOn, ['saved-note']);
});
