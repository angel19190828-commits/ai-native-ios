import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAppIntentInvocations } from './appIntentParser';

test('parses only known app intent invocations', () => {
  const parsed = parseAppIntentInvocations([
    JSON.stringify({ id: 'one', name: 'createTask', params: { request: 'Book dinner' }, createdAt: 1 }),
    JSON.stringify({ id: 'two', name: 'unsafeAction', params: {}, createdAt: 2 }),
    'not-json',
  ]);
  assert.deepEqual(parsed, [{ id: 'one', name: 'createTask', params: { request: 'Book dinner' }, createdAt: 1 }]);
});

test('normalizes missing params without inventing actions', () => {
  const parsed = parseAppIntentInvocations([JSON.stringify({ id: 'one', name: 'continueTask', createdAt: 1 })]);
  assert.deepEqual(parsed[0]?.params, {});
});
