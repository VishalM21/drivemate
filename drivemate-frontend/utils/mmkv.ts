import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import { getOrCreateMmkvEncryptionKey } from './secureKey';

export const storage = createMMKV({
  id: 'drivemate-storage',
  encryptionKey: getOrCreateMmkvEncryptionKey(),
});

export function getItem<T>(key: string): T | null {
  const value = storage.getString(key);
  if (value === undefined) return null;
  return JSON.parse(value) as T;
}

export function setItem<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  storage.remove(key);
}

export function clearStorage(): void {
  storage.clearAll();
}

export const zustandMmkvStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => {
    storage.set(name, value);
  },
  removeItem: (name) => {
    storage.remove(name);
  },
};
