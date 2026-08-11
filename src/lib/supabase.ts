import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const isWeb = Platform.OS === 'web';
const localStorageAvailable = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const memoryStorage = new Map<string, string>();

const authStorage = {
    async getItem(key: string) {
        if (isWeb && localStorageAvailable) {
            return window.localStorage.getItem(key);
        }

        try {
            return await AsyncStorage.getItem(key);
        } catch (error) {
            console.warn('[supabase] AsyncStorage getItem failed', error);
            return memoryStorage.get(key) ?? null;
        }
    },
    async setItem(key: string, value: string) {
        if (isWeb && localStorageAvailable) {
            window.localStorage.setItem(key, value);
            return;
        }

        try {
            await AsyncStorage.setItem(key, value);
        } catch (error) {
            console.warn('[supabase] AsyncStorage setItem failed', error);
            memoryStorage.set(key, value);
        }
    },
    async removeItem(key: string) {
        if (isWeb && localStorageAvailable) {
            window.localStorage.removeItem(key);
            return;
        }

        try {
            await AsyncStorage.removeItem(key);
        } catch (error) {
            console.warn('[supabase] AsyncStorage removeItem failed', error);
            memoryStorage.delete(key);
        }
    },
    async getAllKeys() {
        if (isWeb && localStorageAvailable) {
            return Object.keys(window.localStorage);
        }

        try {
            return await AsyncStorage.getAllKeys();
        } catch (error) {
            console.warn('[supabase] AsyncStorage getAllKeys failed', error);
            return Array.from(memoryStorage.keys());
        }
    },
    async clear() {
        if (isWeb && localStorageAvailable) {
            window.localStorage.clear();
            return;
        }

        try {
            await AsyncStorage.clear();
        } catch (error) {
            console.warn('[supabase] AsyncStorage clear failed', error);
            memoryStorage.clear();
        }
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Keep the Supabase session alive when the app is foregrounded
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
