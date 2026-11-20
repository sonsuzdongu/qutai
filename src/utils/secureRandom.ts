/**
 * Cryptographically secure random bytes, outside the app (Node for the tests, the web): the platform's
 * crypto.getRandomValues. The app uses secureRandom.native.ts (expo-crypto), which Metro picks for iOS and Android.
 * There is no Math.random fallback: without a secure source this throws.
 */
export function fillRandom(bytes: Uint8Array): Uint8Array {
  const c = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto;
  if (!c?.getRandomValues) throw new Error('No secure random source');
  c.getRandomValues(bytes);
  return bytes;
}
