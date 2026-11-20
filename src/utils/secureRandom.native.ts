import { getRandomValues } from 'expo-crypto';

/**
 * Cryptographically secure random bytes in the app: expo-crypto's getRandomValues (SecRandomCopyBytes on iOS,
 * SecureRandom on Android), synchronous. Metro picks this file over secureRandom.ts on iOS and Android.
 */
export function fillRandom(bytes: Uint8Array): Uint8Array {
  getRandomValues(bytes);
  return bytes;
}
