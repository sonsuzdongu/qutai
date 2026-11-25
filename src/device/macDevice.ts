import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import type { StripDevice } from '../ui/tabStrip';

/**
 * Whether this iOS build runs on an Apple Silicon Mac as "Designed for iPhone/iPad" (ProcessInfo.isiOSAppOnMac, in
 * modules/qutai-entry). False on Android, on iPhone and iPad, and on a binary built before the method existed (an
 * over-the-air update on an older build), so those keep today's behaviour. Read once: it never changes while the app runs.
 */
type MacProbe = { isiOSAppOnMac?: () => boolean };

function probe(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const native = requireOptionalNativeModule<MacProbe>('QutaiEntry');
    return typeof native?.isiOSAppOnMac === 'function' && native.isiOSAppOnMac() === true;
  } catch {
    return false;
  }
}

export const isIosAppOnMac = probe();

/** What kind of device decides whether the desktop-style tab strip may show (UI-74, src/ui/tabStrip.ts). */
export const stripDevice: StripDevice = isIosAppOnMac
  ? 'mac'
  : Platform.OS === 'ios' && (Platform as { isPad?: boolean }).isPad === true
    ? 'tablet'
    : Platform.OS === 'android'
      ? 'android'
      : 'phone';
