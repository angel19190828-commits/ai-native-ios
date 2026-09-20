import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseTraceSampleRate,
  safeOperationalTags,
  sanitizeErrorEvent,
  sanitizeTransactionEvent,
} from './monitoringCore';

test('error sanitizer removes task content and user identity but keeps stack data', () => {
  const event = sanitizeErrorEvent({
    user: { id: 'real-user' },
    request: { data: 'private email body' },
    contexts: { task: { address: '555 Burrard Street' } },
    extra: { draft: 'change it to 11:30' },
    message: 'private error content',
    tags: { error_code: 'ai_plan_failed', unsafe: 'email body' },
    breadcrumbs: [{ category: 'task.sync', message: 'private draft', data: { address: 'private' } }],
    exception: { values: [{ type: 'Error', value: 'private error', stacktrace: { frames: [{ filename: 'App.tsx' }] } }] },
  });

  assert.equal(event.user, undefined);
  assert.equal(event.request, undefined);
  assert.equal(event.contexts, undefined);
  assert.equal(event.extra, undefined);
  assert.equal(event.message, '[redacted]');
  assert.deepEqual(event.tags, { error_code: 'ai_plan_failed' });
  assert.deepEqual(event.breadcrumbs, [{ category: 'task.sync', timestamp: undefined, type: undefined, level: undefined }]);
  assert.equal(event.exception?.values?.[0].value, '[redacted]');
  assert.deepEqual(event.exception?.values?.[0].stacktrace, { frames: [{ filename: 'App.tsx' }] });
});

test('transaction sanitizer permits only static operation names and allowlisted tags', () => {
  const safe = sanitizeTransactionEvent({ transaction: 'task.execute', tags: { phase: 'executing', address: 'private' } });
  const unsafe = sanitizeTransactionEvent({ transaction: 'Plan for Jade at 555 Burrard Street' });
  assert.equal(safe.transaction, 'task.execute');
  assert.deepEqual(safe.tags, { phase: 'executing' });
  assert.equal(unsafe.transaction, 'taskspace.operation');
});

test('sample rate and operational tags reject invalid or freeform values', () => {
  assert.equal(parseTraceSampleRate('0.25'), 0.25);
  assert.equal(parseTraceSampleRate('4'), 0.1);
  assert.equal(parseTraceSampleRate('not-a-number'), 0.1);
  assert.deepEqual(
    safeOperationalTags({ error_code: 'sync_conflict', phase: 'executing', operation: 'contains spaces and private text', arbitrary: 'x' }),
    { error_code: 'sync_conflict', phase: 'executing' },
  );
});
