// src/hooks/use-permissions.ts
// ─────────────────────────────────────────────────────────────────────────────
// A centralized hook for requesting all app permissions.
// Import and use individual request functions wherever needed.
// ─────────────────────────────────────────────────────────────────────────────

import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

async function loadContacts() {
  if (isWeb) return null;
  if (!requireOptionalNativeModule('ExpoContactsNext')) return null;
  try {
    return await import('expo-contacts');
  } catch {
    return null;
  }
}

async function loadMediaLibrary() {
  if (isWeb) return null;
  try {
    return await import('expo-media-library');
  } catch {
    return null;
  }
}

async function loadCamera() {
  if (isWeb) return null;
  try {
    return await import('expo-camera');
  } catch {
    return null;
  }
}

async function loadAudio() {
  if (isWeb) return null;
  try {
    return await import('expo-av');
  } catch {
    return null;
  }
}

function normalizeModule(module: any) {
  if (!module) return null;
  const resolved = module.default ?? module;
  if (resolved == null) return null;
  if (typeof resolved === 'function') return resolved;
  if (resolved.requestPermissionsAsync || resolved.getPermissionsAsync || resolved.getCameraPermissionsAsync || resolved.requestCameraPermissionsAsync) {
    return resolved;
  }
  if (resolved.Contacts) return normalizeModule(resolved.Contacts);
  if (resolved.Camera) return normalizeModule(resolved.Camera);
  if (resolved.Audio) return normalizeModule(resolved.Audio);
  if (resolved.MediaLibrary) return normalizeModule(resolved.MediaLibrary);
  return null;
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

// ── Contacts ──────────────────────────────────────────────────────────────────
export async function requestContactsPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadContacts();
  const Contacts = normalizeModule(loaded);
  if (!Contacts || typeof Contacts.requestPermissionsAsync !== 'function') return 'denied';
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'denied';
  }
}

export async function getContactsPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadContacts();
  const Contacts = normalizeModule(loaded);
  if (!Contacts || typeof Contacts.getPermissionsAsync !== 'function') return 'denied';
  try {
    const { status } = await Contacts.getPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'denied';
  }
}

// ── Camera ────────────────────────────────────────────────────────────────────
export async function requestCameraPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadCamera();
  const Camera = normalizeModule(loaded);
  if (!Camera || typeof Camera.requestCameraPermissionsAsync !== 'function') return 'granted';
  try {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'granted';
  }
}

export async function getCameraPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadCamera();
  const Camera = normalizeModule(loaded);
  if (!Camera || typeof Camera.getCameraPermissionsAsync !== 'function') return 'granted';
  try {
    const { status } = await Camera.getCameraPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'granted';
  }
}

// ── Microphone ────────────────────────────────────────────────────────────────
export async function requestMicrophonePermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadAudio();
  const Audio = normalizeModule(loaded);
  if (!Audio || typeof Audio.requestPermissionsAsync !== 'function') return 'granted';
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'granted';
  }
}

export async function getMicrophonePermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadAudio();
  const Audio = normalizeModule(loaded);
  if (!Audio || typeof Audio.getPermissionsAsync !== 'function') return 'granted';
  try {
    const { status } = await Audio.getPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'granted';
  }
}

// ── Media Library / Storage ───────────────────────────────────────────────────
export async function requestMediaLibraryPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadMediaLibrary();
  const MediaLibrary = normalizeModule(loaded);
  if (!MediaLibrary || typeof MediaLibrary.requestPermissionsAsync !== 'function') return 'granted';
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'granted';
  }
}

export async function getMediaLibraryPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'granted';
  const loaded = await loadMediaLibrary();
  const MediaLibrary = normalizeModule(loaded);
  if (!MediaLibrary || typeof MediaLibrary.getPermissionsAsync !== 'function') return 'granted';
  try {
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'granted';
  }
}

// ── Request All At Once ───────────────────────────────────────────────────────
export interface AllPermissionsStatus {
  contacts: PermissionStatus;
  camera: PermissionStatus;
  microphone: PermissionStatus;
  mediaLibrary: PermissionStatus;
}

export async function requestAllPermissions(): Promise<AllPermissionsStatus> {
  const [contacts, camera, microphone, mediaLibrary] = await Promise.all([
    requestContactsPermission(),
    requestCameraPermission(),
    requestMicrophonePermission(),
    requestMediaLibraryPermission(),
  ]);

  return { contacts, camera, microphone, mediaLibrary };
}
