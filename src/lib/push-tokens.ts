import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const PUSH_TOKEN_KEY = 'universal-chat:expo-push-token';
const INSTALLATION_ID_KEY = 'universal-chat:installation-id';

export async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = `install-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

export async function savePushToken(token: string) {
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

export async function unregisterStoredPushToken() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) return;
  const { error } = await supabase.from('push_tokens').delete().eq('token', token);
  if (error) throw error;
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}
