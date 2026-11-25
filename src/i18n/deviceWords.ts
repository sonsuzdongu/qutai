/**
 * Device-aware wording (LANG-25 in docs/design/26-languages.md): the same iOS build runs on iPhones, iPads
 * and Apple Silicon Macs, and texts written for phones say "this phone", "telefonunuzda", "auf diesem Telefon"…
 *
 * A dictionary marks such a phrase as `{@this phone}`: on a phone (and on every Android device) the braces simply go
 * and the text reads exactly as before; on an iPad or a Mac the phrase is looked up in that language's table
 * (src/i18n/device/<code>.ts) and replaced by its iPad or Mac form. A phrase carries the words around "phone" that
 * agree with it (article, possessive, preposition, case ending, particle), so each form is grammatical on its own:
 * Turkish `{@telefonunuzda}` → "iPad'inizde" / "Mac'inizde", German `{@auf Ihrem Telefon}` → "auf Ihrem iPad" / "auf
 * Ihrem Mac". When the same phone text needs different forms in two places, a tag after `#` tells them apart
 * (`{@Ihr Telefon#acc}`); the tag never shows. A phrase missing from a table falls back to the phone text, and
 * scripts/i18n-tests/deviceWords.test.ts keeps every table complete.
 *
 * Pure: no React Native, so it is tested with node:test.
 */

/** What the wording follows: Android is always a phone (Qutai doesn't tell Android tablets apart). */
export type DeviceKind = 'phone' | 'tablet' | 'mac';

/** One language's table: the phrase as written inside `{@…}` (with its `#tag`, if any) → its iPad and Mac forms. */
export type DeviceWords = Readonly<Record<string, { readonly tablet: string; readonly mac: string }>>;

/** A device phrase in a dictionary string. `@` is not a word character, so format()'s `{name}` placeholders never match it. */
export const DEVICE_PHRASE = /\{@([^{}]+)\}/g;

/** The phone text of a phrase: what it reads as on a phone, without its `#tag`. */
export function phoneForm(phrase: string): string {
  const hash = phrase.indexOf('#');
  return hash < 0 ? phrase : phrase.slice(0, hash);
}

/** Fills a dictionary string's device phrases for the device it runs on. */
export function fillDeviceWords(template: string, words: DeviceWords | undefined, device: DeviceKind): string {
  if (!template.includes('{@')) return template;
  return template.replace(DEVICE_PHRASE, (_match, phrase: string) => {
    if (device === 'phone') return phoneForm(phrase);
    return words?.[phrase]?.[device] || phoneForm(phrase);
  });
}

/** The wording's device from the kind of device the app detected (src/device/macDevice.ts). */
export function deviceKindOf(device: 'mac' | 'tablet' | 'android' | 'phone'): DeviceKind {
  return device === 'mac' ? 'mac' : device === 'tablet' ? 'tablet' : 'phone';
}
