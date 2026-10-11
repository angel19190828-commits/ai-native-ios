import assert from 'node:assert/strict';
import test from 'node:test';

import { CapabilityError } from './types';
import { createFileCapabilityAdapters } from './fileAdapters.web';

const context = {
  userId: 'user-1', deviceId: 'browser-1', taskId: 'task-1', revision: 1,
  attemptId: 'attempt-1', idempotencyKey: 'file-key', dependencyReceipts: {},
  signal: new AbortController().signal,
};

test('browser file read uses selected file bytes and never substitutes fixture content', async () => {
  let acceptedTypes: string[] = [];
  const adapters = createFileCapabilityAdapters({
    chooseTextFile: async (types) => {
      acceptedTypes = types;
      return {
        name: 'real-input.txt', type: 'text/plain', size: 19, lastModified: 42,
        text: async () => 'selected file bytes',
      };
    },
    requestDownload: () => assert.fail('read must not request a download'),
  });
  const read = adapters.find((adapter) => adapter.descriptor.id === 'files.document.read');
  assert.ok(read);
  const result = await read.execute({ acceptedTypes: ['text/plain'], maxBytes: 100 }, context);
  assert.deepEqual(acceptedTypes, ['text/plain']);
  assert.equal(result.output?.fileName, 'real-input.txt');
  assert.equal(result.output?.content, 'selected file bytes');
  assert.equal(result.output?.simulated, false);
});

test('browser file create requests a real download and returns result-first metadata', async () => {
  let requested: Record<string, unknown> | undefined;
  const adapters = createFileCapabilityAdapters({
    chooseTextFile: async () => assert.fail('create must not open the file picker'),
    requestDownload: (output) => { requested = output; },
  });
  const create = adapters.find((adapter) => adapter.descriptor.id === 'files.document.create');
  assert.ok(create);
  const result = await create.execute({ fileName: 'result.md', content: '# Real file', mimeType: 'text/markdown' }, context);
  assert.equal(requested?.fileName, 'result.md');
  assert.equal(requested?.content, '# Real file');
  assert.equal(result.output?.downloadRequested, true);
  assert.equal(result.output?.simulated, false);
  assert.match(result.summary, /可下载/);
});

test('browser file read preserves typed cancellation and rejects oversized input', async () => {
  const cancelled = createFileCapabilityAdapters({
    chooseTextFile: async () => { throw new CapabilityError('cancelled', 'cancelled'); },
    requestDownload: () => undefined,
  }).find((adapter) => adapter.descriptor.id === 'files.document.read');
  assert.ok(cancelled);
  await assert.rejects(() => cancelled.execute({}, context), (error: unknown) => error instanceof CapabilityError && error.code === 'cancelled');

  const oversized = createFileCapabilityAdapters({
    chooseTextFile: async () => ({ name: 'large.txt', type: 'text/plain', size: 101, lastModified: 1, text: async () => 'x'.repeat(101) }),
    requestDownload: () => undefined,
  }).find((adapter) => adapter.descriptor.id === 'files.document.read');
  assert.ok(oversized);
  await assert.rejects(() => oversized.execute({ maxBytes: 100 }, context), (error: unknown) => error instanceof CapabilityError && error.code === 'decision_required');
});

test('browser file adapters reject unsupported input types and unsafe output names', async () => {
  const adapters = createFileCapabilityAdapters({
    chooseTextFile: async () => ({ name: 'payload.exe', type: 'application/octet-stream', size: 10, lastModified: 1, text: async () => 'not text' }),
    requestDownload: () => assert.fail('unsafe output must not download'),
  });
  const read = adapters.find((adapter) => adapter.descriptor.id === 'files.document.read');
  const create = adapters.find((adapter) => adapter.descriptor.id === 'files.document.create');
  assert.ok(read); assert.ok(create);
  await assert.rejects(() => read.execute({}, context), (error: unknown) => error instanceof CapabilityError && error.code === 'decision_required');
  await assert.rejects(() => create.execute({ fileName: '../unsafe.md', content: 'content' }, context), (error: unknown) => error instanceof CapabilityError && error.code === 'decision_required');
});
