import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { createSingleFlightKeyProvider, EncryptedKeyValueStore, EncryptionKeyProvider } from './encryptedStore';
import { KeyValueStore } from './keyValueStore';

export const asyncTaskStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

const taskStorageKeys = new Map<string, EncryptionKeyProvider>();

function encryptionKeyName(namespace: string) {
  return `taskspace.encryption.v1.${namespace.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export function createEncryptedTaskStore(namespace: string): KeyValueStore {
  let provider = taskStorageKeys.get(namespace);
  if (!provider) {
    const keyName = encryptionKeyName(namespace);
    provider = createSingleFlightKeyProvider(async () => {
      const existing = await SecureStore.getItemAsync(keyName);
      if (existing) {
        if (!/^[0-9a-f]{64}$/i.test(existing)) throw new Error('Invalid stored encryption key');
        return Uint8Array.from(existing.match(/.{2}/g)?.map((value) => Number.parseInt(value, 16)) ?? []);
      }
      const created = await Crypto.getRandomBytesAsync(32);
      const encoded = Array.from(created, (byte) => byte.toString(16).padStart(2, '0')).join('');
      await SecureStore.setItemAsync(keyName, encoded, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return created;
    });
    taskStorageKeys.set(namespace, provider);
  }
  return new EncryptedKeyValueStore(asyncTaskStore, provider, Crypto.getRandomBytesAsync);
}

export async function deleteTaskEncryptionKey(namespace: string): Promise<void> {
  taskStorageKeys.delete(namespace);
  await SecureStore.deleteItemAsync(encryptionKeyName(namespace));
}

const SESSION_KEY = 'taskspace:session:v1';

export interface SessionCredentials {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export const sessionStore = {
  async save(session: SessionCredentials) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async load(): Promise<SessionCredentials | undefined> {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? JSON.parse(raw) as SessionCredentials : undefined;
  },
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
};
