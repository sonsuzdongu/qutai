import { useEffect } from 'react';
import { BackHandler, TextInput } from 'react-native';
import type { Browser } from './Browser';

export type BackAction = 'blur-input' | 'page-back' | 'close-to-opener' | 'exit';

/** Decides what the Android back button does, in the order regular browsers use. */
export function backAction(browser: Browser, inputFocused: boolean): BackAction {
  if (inputFocused) return 'blur-input';
  const tab = browser.active;
  if (tab.canGoBack) return 'page-back';
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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const focused = TextInput.State.currentlyFocusedInput();
      const tab = browser.active;
      switch (backAction(browser, !!focused)) {
        case 'blur-input':
          TextInput.State.blurTextInput(focused);
          return true;
        case 'page-back':
          tab.webview?.goBack();
          return true;
        case 'close-to-opener':
          browser.closeTab(tab.id);
          return true;
        case 'exit':
          // Default handling: on Android 12+ the app moves to the background and keeps its tabs.
          return false;
      }
    });
    return () => sub.remove();
  }, [browser]);
}
