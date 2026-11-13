import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

const KEY = 'incognito';

/**
 * Like Chrome, blocks system screenshots and screen recording while incognito content is
 * on screen, and hides it in the app switcher (Android shows a blank preview, iOS blurs it).
 */
export function useIncognitoProtection(active: boolean) {
  useEffect(() => {
    if (!active) return;
    ScreenCapture.preventScreenCaptureAsync(KEY).catch(() => {});
    if (Platform.OS === 'ios') ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync(KEY).catch(() => {});
      if (Platform.OS === 'ios') ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, [active]);
}
