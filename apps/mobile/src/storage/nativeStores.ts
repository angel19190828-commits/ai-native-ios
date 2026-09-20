import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { KeyValueStore } from './keyValueStore';

export const asyncTaskStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

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

