import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

/** The patched react-native-webview's answers to a site's request for a user name and password (src/browser/httpAuth.ts). */
interface HttpAuthModule extends TurboModule {
  answerHttpAuth(id: string, username: string, password: string): void;
  cancelHttpAuth(id: string): void;
}

const native: HttpAuthModule | null = (() => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const module = TurboModuleRegistry.get<HttpAuthModule>('RNCWebViewModule');
  return module && typeof module.answerHttpAuth === 'function' ? module : null;
})();

/** Whether this build asks for site passwords (a development build made before the patch doesn't). */
export function hasHttpAuth(): boolean {
  return native !== null;
}

/** Sends the user's answer to the waiting load; the password is used once and kept nowhere. */
export function answerHttpAuth(id: string, username: string, password: string) {
  native?.answerHttpAuth(id, username, password);
}

/** The user cancelled: the site's own 401 page shows. */
export function cancelHttpAuth(id: string) {
  native?.cancelHttpAuth(id);
}
