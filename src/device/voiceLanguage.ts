import { detectWritingLanguage } from '../chat/messageLanguage';
import type { Conversation } from '../chat/Conversation';
import { getLanguage, t } from '../i18n';

/**
 * Which language voice input listens in. In this order, the first the phone's recogniser offers wins
 * (voiceInput.ts skips the others and says so):
 * 1. a language picked by hand for this conversation (the panel's language tag, or a long press on its microphone);
 * 2. the "Listening language" setting, when it isn't Automatic;
 * 3. the language the user has been writing in this conversation (their own messages, never the assistant's), from
 *    messageLanguage.ts: a guess made on the phone, which keeps its previous answer unless the messages clearly differ;
 * 4. the language voice input was last used in;
 * 5. the app's language.
 */

/** The setting's value for "follow the conversation". */
export const AUTO_LANGUAGE = 'auto';

/** "tr" from "tr-TR", "tr_TR" or "tr". */
export const languageOf = (tag: string) => tag.replace(/_/g, '-').toLowerCase().split('-')[0];

/** The short tag shown while listening: "TR", "EN". */
export const languageLabel = (tag: string) => languageOf(tag).toUpperCase();

/** A language's name in the app's language: "Turkish", "English (United Kingdom)", or the tag itself. */
export function languageName(tag: string): string {
  const language = languageOf(tag);
  const own = language === 'tr' ? t('voice.language.tr') : language === 'en' ? t('voice.language.en') : null;
  const regional = tag.includes('-') || tag.includes('_');
  if (own && !regional) return own;
  try {
    const names = new Intl.DisplayNames([getLanguage()], { type: 'language' });
    const name = names.of(tag.replace(/_/g, '-'));
    if (name && name.toLowerCase() !== tag.toLowerCase()) return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  } catch {}
  return own ? `${own} (${tag})` : tag;
}

/**
 * What the user wrote in this conversation, oldest first: their messages (not the options of a question they tapped,
 * which the assistant wrote) and the message being typed.
 */
export function userTexts(chat: Conversation): string[] {
  const options = new Set(chat.items.flatMap((item) => (item.kind === 'choices' ? (item.options ?? []) : [])));
  const texts = chat.items.filter((item) => item.kind === 'user' && !options.has(item.text)).map((item) => item.text);
  return chat.draft.trim() ? [...texts, chat.draft] : texts;
}

/** The language the user writes in this conversation (updates the conversation's memory of it), or null. */
export function writingLanguage(chat: Conversation): string | null {
  const { language } = detectWritingLanguage(userTexts(chat), chat.heardLanguage);
  chat.heardLanguage = language;
  return language;
}

/** The languages to try, best first, one per language (see the order above). */
export function listeningOrder(
  chat: Conversation,
  settings: { voiceLanguage: string; voiceLastLanguage: string },
): string[] {
  const order = [
    chat.voiceLanguage,
    settings.voiceLanguage !== AUTO_LANGUAGE ? settings.voiceLanguage : null,
    writingLanguage(chat),
    settings.voiceLastLanguage || null,
    getLanguage(),
  ].filter((x): x is string => !!x);
  const seen = new Set<string>();
  return order.filter((tag) => {
    const language = languageOf(tag);
    if (seen.has(language)) return false;
    seen.add(language);
    return true;
  });
}

/** What "Automatic" would listen in now for this conversation (without a pick made in it), for the picker. */
export function automaticLanguage(
  chat: Conversation,
  settings: { voiceLanguage: string; voiceLastLanguage: string },
): string {
  if (settings.voiceLanguage !== AUTO_LANGUAGE) return settings.voiceLanguage;
  return (
    detectWritingLanguage(userTexts(chat), chat.heardLanguage).language || settings.voiceLastLanguage || getLanguage()
  );
}
