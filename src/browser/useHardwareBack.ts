import { useEffect } from 'react';
import { BackHandler, TextInput, ToastAndroid } from 'react-native';
import type { Browser } from './Browser';
import { t } from '../i18n';

export type BackAction = 'blur-input' | 'exit-reader' | 'page-back' | 'back-to-new-tab' | 'close-to-opener' | 'exit';

/** How long after the warning a second back press closes the app. Matches the short toast duration. */
export const EXIT_CONFIRM_MS = 2000;

/** Exit only on a second press shortly after the first; the first press shows a warning. */
export function confirmsExit(now: number, lastExitPress: number | null): boolean {
  return lastExitPress !== null && now - lastExitPress <= EXIT_CONFIRM_MS;
}

/** Decides what the Android back button does, in the order regular browsers use. */
export function backAction(browser: Browser, inputFocused: boolean): BackAction {
  if (inputFocused) return 'blur-input';
  const tab = browser.active;
  // Reader mode lies over the page: back returns to the page first.
  if (tab.reader) return 'exit-reader';
  if (tab.canGoBack) return 'page-back';
  if (tab.openedFromNewTab) return 'back-to-new-tab';
  if (tab.openerId && browser.getTab(tab.openerId)) return 'close-to-opener';
  return 'exit';
}

/**
 * Android back button and back gesture for the browser. Open panels and modals
 * handle back themselves: the assistant panel registers its own listener later
 * (React Native calls the newest one first), and modals use onRequestClose.
 */
export function useHardwareBack(browser: Browser) {
  useEffect(() => {
    let lastExitPress: number | null = null;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const focused = TextInput.State.currentlyFocusedInput();
      const tab = browser.active;
      const action = backAction(browser, !!focused);
      if (action !== 'exit') lastExitPress = null;

      switch (action) {
        case 'blur-input':
          TextInput.State.blurTextInput(focused);
          return true;
        case 'exit-reader':
          tab.closeReader();
          return true;
        case 'page-back':
          tab.webview?.goBack();
          return true;
        case 'back-to-new-tab':
          tab.showNewTab();
          return true;
        case 'close-to-opener':
          browser.closeTab(tab.id);
          return true;
        case 'exit': {
          const now = Date.now();
          if (confirmsExit(now, lastExitPress)) {
            lastExitPress = null;
            // Default handling: on Android 12+ the app moves to the background and keeps its tabs.
            return false;
          }
          lastExitPress = now;
          ToastAndroid.show(t('back.exitHint'), ToastAndroid.SHORT);
          return true;
        }
      }
    });
    return () => sub.remove();
  }, [browser]);
}
