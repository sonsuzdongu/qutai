/**
 * Every setting the assistant's settings tool (agent/settingsTool.ts) can write, and which way it may move it
 * (decided 19 Nov 2026, docs/design/15-tools-and-phone-actions.md). Pure, so the classification is tested on its own.
 *
 * - 'preference': appearance and browsing preferences, visible and easily changed back: both ways.
 * - 'protectionOn': a protection: the tool may only turn it on; turning it off is the user's, in Settings.
 * - 'protectionOff': on, it sends something about the user out (search suggestions send what they type to the
 *   search engine): the tool may only turn it off.
 *
 * Everything not listed (payments, scripts, approvals and "Don't ask again", site permissions and modes, memory,
 * custom instructions, provider, keys, web search, background work, locks, voice, backup, clearing data, filter
 * lists) is refused outright. settingsTool's table must have exactly these keys (the compiler checks it).
 */
export type SettingClass = 'preference' | 'protectionOn' | 'protectionOff';

export const SETTINGS_TOOL_CLASSES = {
  theme: 'preference',
  dark_sites: 'preference',
  address_bar_position: 'preference',
  text_size: 'preference',
  search_engine: 'preference',
  search_suggestions: 'protectionOff',
  haptics: 'preference',
  force_zoom: 'preference',
  show_assistant_button: 'preference',
  reader_theme: 'preference',
  reader_font: 'preference',
  reader_easy_reading: 'preference',
  background_playback: 'preference',
  picture_in_picture: 'preference',
  block_ads: 'protectionOn',
  hide_cookie_banners: 'protectionOn',
  block_third_party_cookies: 'protectionOn',
  https_only: 'protectionOn',
} as const satisfies Record<string, SettingClass>;

export type SettingsToolKey = keyof typeof SETTINGS_TOOL_CLASSES;

export function settingClass(key: string): SettingClass | null {
  return (SETTINGS_TOOL_CLASSES as Record<string, SettingClass>)[key] ?? null;
}

/**
 * Whether the tool may set a boolean setting of this class to `value`: preferences either way, a protection only to
 * its protective side.
 */
export function mayWrite(cls: SettingClass, value: boolean): boolean {
  if (cls === 'protectionOn') return value === true;
  if (cls === 'protectionOff') return value === false;
  return true;
}
