import { getDeviceKind, getLanguage, LANGUAGE_INFO, t, type MessageKey } from '../i18n';
import { deviceNameEn } from '../i18n/deviceWords';

/**
 * Names of things on screen, for tool results. Results are built when the tool runs, so they use the labels the user
 * sees right now (the interface language, which may differ from the language the user writes in), taken from the same
 * keys the components use. Quoted, so the model repeats them verbatim instead of translating them.
 */
export function uiLabel(key: MessageKey): string {
  return `"${t(key)}"`;
}

/** A path through the interface, e.g. "Settings" › "Assistant" › "Memory". */
export function uiPath(...keys: MessageKey[]): string {
  return keys.map(uiLabel).join(' › ');
}

/** Added to each user message: the language of the labels the user sees and of the names in tool results. */
export function interfaceLanguageNote(): string {
  return `Qutai's interface language: ${LANGUAGE_INFO[getLanguage()].englishName}. The user's device: ${deviceNameEn(getDeviceKind(), true)}.`;
}

/**
 * The user's device as tool results name it, so the assistant says "your Mac" or "this iPad" instead of "phone"
 * (LANG-25): "phone", "iPad" or "Mac". The agent profile itself says "device" (one profile for every device).
 */
export function deviceName(): string {
  return deviceNameEn(getDeviceKind());
}
