/**
 * Build-time switches, read from EXPO_PUBLIC_ environment variables (see .env.example).
 * Expo inlines them into the bundle, so they are visible in the app: never put secrets here.
 *
 * PRO_MODE turns on the parts that talk to Qutai's own servers (accounts, sync, Qutai credits).
 * It is off unless set, so builds from this repository use only the user's own AI key and keep
 * everything on the device. The official store builds set it in their EAS build profile.
 */
const flag = (value: string | undefined) => /^(on|true|1|yes)$/i.test(value?.trim() ?? '');
const text = (value: string | undefined) => value?.trim() || null;

export const features = {
  pro: flag(process.env.EXPO_PUBLIC_PRO_MODE),
  /** Base URL of Qutai's API, used only in pro mode. An address, not a secret. */
  apiUrl: text(process.env.EXPO_PUBLIC_QUTAI_API_URL),
  /**
   * Google OAuth client ids for "Sign in with Google" (pro mode). Not secrets, but kept out of the repository:
   * the web ("server") client id is what Android asks Google for; the iOS client id is used on iOS.
   */
  googleWebClientId: text(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  googleIosClientId: text(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
} as const;

/** Accounts (sign-in, Settings › Account) exist only in pro mode with a server address. */
export const accountsEnabled = features.pro && !!features.apiUrl;
