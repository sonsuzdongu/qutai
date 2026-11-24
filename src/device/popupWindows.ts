import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

/** The patched react-native-webview's pop-up window requests (src/browser/popups.ts). */
interface PopupModule extends TurboModule {
  releasePopup(id: string): void;
}

const native: PopupModule | null = (() => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const module = TurboModuleRegistry.get<PopupModule>('RNCWebViewModule');
  return module && typeof module.releasePopup === 'function' ? module : null;
})();

/** The app refused a page's new window (an ad): the waiting request goes and the window never opens. */
export function releasePopup(id: string) {
  native?.releasePopup(id);
}
