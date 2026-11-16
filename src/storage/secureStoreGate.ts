/**
 * Every secure-storage read waits for this: on the first launch after a reinstall on iOS, the Keychain items left by
 * the earlier installation are cleared first (storage/installCheck.ts, started from i18n/startup.ts).
 */
let gate: Promise<void> = Promise.resolve();

export function setSecureStoreGate(p: Promise<void>): void {
  gate = p.catch(() => {});
}

export function secureStoreReady(): Promise<void> {
  return gate;
}
