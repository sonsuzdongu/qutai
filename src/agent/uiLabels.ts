import { getLanguage, t, type MessageKey } from '../i18n';

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
  return `Qutai's interface language: ${getLanguage() === 'tr' ? 'Turkish' : 'English'}.`;
}
