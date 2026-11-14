/**
 * Build-time switches, read from EXPO_PUBLIC_ environment variables (see .env.example).
 * Expo inlines them into the bundle, so they are visible in the app: never put secrets here.
 *
 * PRO_MODE turns on the parts that talk to Qutai's own servers (accounts, sync, Qutai credits).
 * It is off unless set, so builds from this repository use only the user's own AI key and keep
 * everything on the device. The official store builds set it in their EAS build profile.
 */
const flag = (value: string | undefined) => /^(on|true|1|yes)$/i.test(value?.trim() ?? '');

export const features = {
  pro: flag(process.env.EXPO_PUBLIC_PRO_MODE),
  /** Base URL of Qutai's API, used only in pro mode. An address, not a secret. */
  apiUrl: process.env.EXPO_PUBLIC_QUTAI_API_URL?.trim() || null,
} as const;
