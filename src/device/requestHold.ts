import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { createRequestHold, type HoldPlatform } from './requestHoldLogic';

/**
 * Keeps an own-key AI request alive until it finishes when the user leaves Qutai (see requestHoldLogic.ts for why and
 * the rules). Native: modules/qutai-agent (`holdRequest`): Android starts the assistant's foreground service in its
 * short "finishing a reply" mode only if Qutai leaves the screen while a request runs; iOS asks for background time.
 * Builds made before the native function existed: nothing happens.
 */
type QutaiAgentHold = { holdRequest?: (inFlight: boolean) => Promise<void> };

const native =
  Platform.OS === 'android' || Platform.OS === 'ios' ? requireOptionalNativeModule<QutaiAgentHold>('QutaiAgent') : null;

const platform: HoldPlatform = Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'other';

const hold = createRequestHold((inFlight) => {
  native?.holdRequest?.(inFlight).catch(() => {});
});

/** Runs one AI request; with the user's own key it is kept alive in the background until it ends. */
export function whileRequestInFlight<T>(r: { ownKey: boolean; incognito: boolean }, work: () => Promise<T>): Promise<T> {
  return hold.around({ platform, ...r }, work);
}
