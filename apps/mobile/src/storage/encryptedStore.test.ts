import assert from 'node:assert/strict';
import test from 'node:test';

import { createSingleFlightKeyProvider, EncryptedKeyValueStore, EncryptedStoreError } from './encryptedStore';
import { KeyValueStore } from './keyValueStore';

class MemoryStore implements KeyValueStore {
  readonly values = new Map<string, string>();
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
  async removeItem(key: string) { this.values.delete(key); }
}

const masterKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
let nonceCounter = 0;
const randomBytes = async (length: number) => {
  nonceCounter += 1;
  return new Uint8Array(length).fill(nonceCounter);
};

test('encrypts values at rest and decrypts them after restart', async () => {
  const storage = new MemoryStore();
  const first = new EncryptedKeyValueStore(storage, { getOrCreateKey: async () => masterKey }, randomBytes);
  await first.setItem('task:one', 'private invitation at 555 Burrard Street');
  const atRest = storage.values.get('task:one') ?? '';
  assert.equal(atRest.includes('555 Burrard Street'), false);
  assert.equal(atRest.startsWith('taskspace-encrypted:'), true);

  const afterRestart = new EncryptedKeyValueStore(storage, { getOrCreateKey: async () => masterKey }, randomBytes);
  assert.equal(await afterRestart.getItem('task:one'), 'private invitation at 555 Burrard Street');
});

test('uses a fresh nonce for every write', async () => {
  const storage = new MemoryStore();
  const encrypted = new EncryptedKeyValueStore(storage, { getOrCreateKey: async () => masterKey }, randomBytes);
  await encrypted.setItem('task:one', 'same value');
  const first = storage.values.get('task:one');
  await encrypted.setItem('task:one', 'same value');
  assert.notEqual(storage.values.get('task:one'), first);
});

test('rejects tampering and ciphertext swapping', async () => {
  const storage = new MemoryStore();
  const encrypted = new EncryptedKeyValueStore(storage, { getOrCreateKey: async () => masterKey }, randomBytes);
  await encrypted.setItem('task:one', 'secret');
  storage.values.set('task:two', storage.values.get('task:one') ?? '');
  await assert.rejects(() => encrypted.getItem('task:two'), EncryptedStoreError);
});

test('migrates a legacy plaintext value on first read', async () => {
  const storage = new MemoryStore();
  storage.values.set('legacy', 'old plaintext');
  const encrypted = new EncryptedKeyValueStore(storage, { getOrCreateKey: async () => masterKey }, randomBytes);
  assert.equal(await encrypted.getItem('legacy'), 'old plaintext');
  assert.equal(storage.values.get('legacy')?.startsWith('taskspace-encrypted:'), true);
});

test('serializes concurrent first-use key creation and retries after failure', async () => {
  let calls = 0;
  const provider = createSingleFlightKeyProvider(async () => {
    calls += 1;
    await Promise.resolve();
    return masterKey;
  });
  const [first, second] = await Promise.all([provider.getOrCreateKey(), provider.getOrCreateKey()]);
  assert.equal(calls, 1);
  assert.equal(first, second);

  let attempts = 0;
  const retrying = createSingleFlightKeyProvider(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary secure store failure');
    return masterKey;
  });
  await assert.rejects(() => retrying.getOrCreateKey());
  assert.equal(await retrying.getOrCreateKey(), masterKey);
  assert.equal(attempts, 2);
});
