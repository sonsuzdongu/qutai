import { Platform, TurboModuleRegistry, type TurboModule } from 'react-native';

/**
 * Network blocking in the WebView, through the patched react-native-webview (RNCWebViewModule):
 * - Android: RNCWebViewContentBlocker.java reads the domain file (filterLists.ts › androidBlockerFile) on a
 *   background thread and swaps it in atomically; RNCWebViewClient.shouldInterceptRequest consults it for every
 *   request of a WebView whose contentBlocking prop is on.
 * - iOS: WebKit content rule lists, compiled from JSON files into WKContentRuleListStore under an identifier and
 *   attached to the WebViews named in their contentRuleLists prop.
 * Each platform's methods do nothing (or resolve with nothing) on the other one.
 */
interface ContentBlockerModule extends TurboModule {
  loadContentBlocker(path: string): Promise<number>;
  compileContentRuleList(identifier: string, path: string): Promise<void>;
  hasContentRuleList(identifier: string): Promise<boolean>;
  removeContentRuleLists(prefix: string, keep: string): Promise<void>;
}

const native: ContentBlockerModule | null = (() => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  const module = TurboModuleRegistry.get<ContentBlockerModule>('RNCWebViewModule');
  // Without the patch (an old development build) the methods are missing: there is no network blocking.
  return module && typeof module.loadContentBlocker === 'function' ? module : null;
})();

/** Whether this build has native network blocking (a development build made after the patch). */
export function hasNativeBlocking(): boolean {
  return native !== null;
}

/** A file:// URI as the plain path native code opens. */
function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

/** Android: the domain file to block with ("" turns blocking off); resolves with the number of entries. */
export async function loadAndroidBlocker(uri: string): Promise<number> {
  if (!native || Platform.OS !== 'android') return 0;
  return native.loadContentBlocker(uri ? toPath(uri) : '');
}

/** iOS: compiles a WebKit content rule list from a JSON file (slow for big lists; WebKit works off the main thread). */
export async function compileIosRuleList(identifier: string, uri: string): Promise<void> {
  if (!native || Platform.OS !== 'ios') return;
  await native.compileContentRuleList(identifier, toPath(uri));
}

export async function hasIosRuleList(identifier: string): Promise<boolean> {
  if (!native || Platform.OS !== 'ios') return false;
  return native.hasContentRuleList(identifier);
}

/** iOS: removes the compiled lists whose identifier starts with prefix, except those in keep. */
export async function removeIosRuleLists(prefix: string, keep: string[]): Promise<void> {
  if (!native || Platform.OS !== 'ios') return;
  await native.removeContentRuleLists(prefix, keep.join('\n'));
}
