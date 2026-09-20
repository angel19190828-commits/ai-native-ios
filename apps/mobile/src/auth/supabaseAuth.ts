import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

const storage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | undefined;
let appStateSubscription: { remove(): void } | undefined;

export const isAuthConfigured = () => Boolean(url && publishableKey);

export function getSupabaseClient() {
  if (!url || !publishableKey) throw new Error('Supabase mobile environment is not configured');
  client ??= createClient(url, publishableKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return client;
}

export function startAuthAutoRefresh() {
  if (!isAuthConfigured() || appStateSubscription) return () => undefined;
  const supabase = getSupabaseClient();
  if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
  appStateSubscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
  });
  return () => {
    appStateSubscription?.remove();
    appStateSubscription = undefined;
    supabase.auth.stopAutoRefresh();
  };
}

export async function currentSession(): Promise<Session | undefined> {
  if (!isAuthConfigured()) return undefined;
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error) throw error;
  return data.session ?? undefined;
}

export async function requestEmailCode(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('请输入有效邮箱。');
  const { error } = await getSupabaseClient().auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: true } });
  if (error) throw error;
  return normalized;
}

export async function verifyEmailCode(email: string, token: string) {
  if (!/^\d{6}$/.test(token.trim())) throw new Error('验证码应为 6 位数字。');
  const { data, error } = await getSupabaseClient().auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('登录会话没有创建。');
  return data.session;
}

export async function signOut() {
  if (!isAuthConfigured()) return;
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

export async function clearLocalAuthSession() {
  if (!isAuthConfigured()) return;
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function getAccessToken() {
  return (await currentSession())?.access_token;
}
