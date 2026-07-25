import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// The MMKV encryption key itself lives in the Keychain/Keystore (via
// SecureStore), never in JS — MMKV only gets a reference to it at runtime.
const MMKV_ENCRYPTION_KEY_ALIAS = 'drivemate_mmkv_encryption_key';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function getOrCreateMmkvEncryptionKey(): string {
  const existing = SecureStore.getItem(MMKV_ENCRYPTION_KEY_ALIAS);
  if (existing) return existing;

  const key = bytesToHex(Crypto.getRandomBytes(32));
  SecureStore.setItem(MMKV_ENCRYPTION_KEY_ALIAS, key);
  return key;
}
