import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';

import { KeyValueStore } from './keyValueStore';

const ENVELOPE_VERSION = 1;
const PREFIX = 'taskspace-encrypted:';

type Envelope = {
  v: typeof ENVELOPE_VERSION;
  nonce: string;
  ciphertext: string;
};

export interface EncryptionKeyProvider {
  getOrCreateKey(): Promise<Uint8Array>;
}

export function createSingleFlightKeyProvider(loadOrCreate: () => Promise<Uint8Array>): EncryptionKeyProvider {
  let keyPromise: Promise<Uint8Array> | undefined;
  return {
    getOrCreateKey() {
      keyPromise ??= loadOrCreate().catch((error) => {
        keyPromise = undefined;
        throw error;
      });
      return keyPromise;
    },
  };
}

export class EncryptedStoreError extends Error {
  constructor(public readonly key: string, cause?: unknown) {
    super(`Encrypted task storage could not be opened: ${key}`, { cause });
    this.name = 'EncryptedStoreError';
  }
}

export class EncryptedKeyValueStore implements KeyValueStore {
  constructor(
    private readonly storage: KeyValueStore,
    private readonly keyProvider: EncryptionKeyProvider,
    private readonly randomBytes: (length: number) => Promise<Uint8Array>,
  ) {}

  async getItem(key: string): Promise<string | null> {
    const raw = await this.storage.getItem(key);
    if (raw === null) return null;
    if (!raw.startsWith(PREFIX)) {
      await this.setItem(key, raw);
      return raw;
    }

    try {
      const envelope = JSON.parse(raw.slice(PREFIX.length)) as Envelope;
      if (envelope.v !== ENVELOPE_VERSION || typeof envelope.nonce !== 'string' || typeof envelope.ciphertext !== 'string') {
        throw new Error('Invalid encrypted envelope');
      }
      const masterKey = await this.keyProvider.getOrCreateKey();
      const plaintext = xchacha20poly1305(masterKey, hexToBytes(envelope.nonce), encode(key))
        .decrypt(hexToBytes(envelope.ciphertext));
      return decode(plaintext);
    } catch (error) {
      throw new EncryptedStoreError(key, error);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const [masterKey, nonce] = await Promise.all([
        this.keyProvider.getOrCreateKey(),
        this.randomBytes(24),
      ]);
      if (masterKey.length !== 32 || nonce.length !== 24) throw new Error('Invalid key or nonce length');
      const ciphertext = xchacha20poly1305(masterKey, nonce, encode(key)).encrypt(encode(value));
      const envelope: Envelope = {
        v: ENVELOPE_VERSION,
        nonce: bytesToHex(nonce),
        ciphertext: bytesToHex(ciphertext),
      };
      await this.storage.setItem(key, `${PREFIX}${JSON.stringify(envelope)}`);
    } catch (error) {
      throw new EncryptedStoreError(key, error);
    }
  }

  removeItem(key: string): Promise<void> {
    return this.storage.removeItem(key);
  }
}

const encode = (value: string) => utf8ToBytes(value);
const decode = (value: Uint8Array) => bytesToUtf8(value);
