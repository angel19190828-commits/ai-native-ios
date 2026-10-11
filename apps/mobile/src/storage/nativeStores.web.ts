import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStore } from './keyValueStore';

export const asyncTaskStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

// Browser QA persistence deliberately uses local storage. It validates task
// recovery semantics, not SecureStore encryption or native keychain behavior.
export const createEncryptedTaskStore = (_namespace: string): KeyValueStore => asyncTaskStore;
export const deleteTaskEncryptionKey = async (_namespace: string) => undefined;

const SESSION_KEY = 'taskspace:session:v1';

export interface SessionCredentials {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

export const sessionStore = {
  save: (session: SessionCredentials) => AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)),
  async load(): Promise<SessionCredentials | undefined> {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as SessionCredentials : undefined;
  },
  clear: () => AsyncStorage.removeItem(SESSION_KEY),
};
