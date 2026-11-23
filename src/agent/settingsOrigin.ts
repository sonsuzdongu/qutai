import { foldText } from './personalData';
import { settingClass } from './settingsClass';

/**
 * Whether a settings change comes from what the user wrote (docs/design/04-untrusted-content.md, UNTR-25). The settings
 * tool may change only an allowlist of preferences (UNTR-4), and the prompt says to change them only when the user
 * asks (UNTR-9); this is the app's check behind the prompt. The injection measurement found that a model which obeys a
 * page or an attached PDF changed the search engine, the theme and the text size.
 *
 * A change is the user's when their own messages in this conversation name the setting or its new value: a word of
 * the setting's on-screen name (as a phrase) or its new value (in the interface language and in English, given by the
 * caller), or one of
 * the words below (English and Turkish, the languages most users here write in), matched on their first 5 letters
 * after folding case, Turkish letters and accents; Japanese and Korean words as they are. Otherwise Qutai asks in its
 * own dialog. Turning a protection on (ad blocking, HTTPS-only…) or search suggestions off is never asked: a page can
 * only make Qutai safer that way.
 *
 * Limits: a request in other words ("make it easier on my eyes") or in another language than those may be asked about
 * (one tap); a page that names a setting the user already named in this conversation is not caught.
 */
const WORDS: Record<string, string[]> = {
  theme: ['dark', 'light', 'night', 'theme', 'koyu', 'karanlık', 'açık', 'aydınlık', 'gece', 'tema', 'görünüm', 'dunkel', 'sombre', 'oscuro', 'escuro', 'тёмн', 'gelap', 'ダーク', '다크'],
  address_bar_position: ['address bar', 'adres çubu', 'top', 'bottom', 'üste', 'alta', 'yukarı', 'aşağı'],
  text_size: ['text size', 'font size', 'bigger', 'smaller', 'larger', 'zoom', 'yazı boyut', 'yazılar', 'büyüt', 'küçült', 'büyük yaz', 'küçük yaz', 'punto'],
  search_engine: ['search engine', 'arama motor', 'google', 'duckduckgo', 'bing', 'yandex'],
  haptics: ['haptic', 'vibration', 'vibrate', 'titreşim'],
  force_zoom: ['zoom', 'pinch', 'yakınlaştır'],
  show_assistant_button: ['button', 'düğme', 'buton'],
  reader_theme: ['reader', 'sepia', 'colour', 'color', 'okuma', 'okuyucu', 'renk'],
  reader_font: ['reader', 'font', 'serif', 'sans', 'typeface', 'okuma', 'yazı tipi', 'okuyucu'],
  reader_easy_reading: ['reader', 'easy', 'easier', 'okuma', 'kolay', 'okuyucu'],
  background_playback: ['background', 'playback', 'arka plan'],
  picture_in_picture: ['picture', 'pip', 'resim içinde', 'küçük pencere'],
};

const CJK = /[぀-ヿ㐀-鿿가-힯]/;

/** `names`: the setting's on-screen name and the new value's name, in the interface language and in English. */
export function settingFromUser(key: string, value: unknown, names: string[], userTexts: string[]): boolean {
  if (settingClass(key) !== 'preference') return true;
  const said = userTexts.join('\n');
  const saidFolded = ` ${foldText(said)} `;
  const saidWords = saidFolded.trim().split(' ').filter((w) => w.length >= 3);
  const candidates = [...(WORDS[key] ?? []), ...names, typeof value === 'string' ? value : ''];
  for (const raw of candidates) {
    if (!raw) continue;
    if (CJK.test(raw)) {
      if (said.includes(raw)) return true;
      continue;
    }
    const folded = foldText(raw);
    // A phrase ("text size", "adres çubu") must appear as written, its last word possibly longer ("adres çubuğunu").
    if (folded.includes(' ')) {
      if (saidFolded.includes(` ${folded}`)) return true;
      continue;
    }
    for (const word of [folded]) {
      if (word.length < 3 || /^\d+$/.test(word)) continue;
      // Short words whole ("bar", "alt", "üst", "koyu"); longer ones by their first 5 letters ("büyüt" ~ "büyük").
      if (word.length <= 4 ? saidFolded.includes(` ${word} `) : saidWords.some((w) => w.slice(0, 5) === word.slice(0, 5))) return true;
    }
  }
  return false;
}
