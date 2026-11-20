// The settings tool can never weaken a protection (decided 19 Nov 2026; src/agent/settingsClass.ts, used by
// src/agent/settingsTool.ts, whose table the compiler holds to exactly these keys). A new key fails here until someone
// decides which side it is on.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mayWrite, settingClass, SETTINGS_TOOL_CLASSES } from '../../src/agent/settingsClass.ts';

const EXPECTED = {
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
  block_video_ads: 'protectionOn',
  block_third_party_cookies: 'protectionOn',
  https_only: 'protectionOn',
} as const;

test('every setting the tool can write is classified, and nothing else is writable', () => {
  assert.deepEqual(SETTINGS_TOOL_CLASSES, EXPECTED);
  for (const key of [
    'assistant_payments', 'assistant_scripts', 'always_allow', 'confirm_actions', 'site_permissions', 'memory',
    'custom_instructions', 'api_key', 'web_search', 'background_tasks', 'app_lock', 'clear_data', 'filter_lists',
  ])
    assert.equal(settingClass(key), null, key);
});

test('protections can only be turned on; search suggestions only off; preferences both ways', () => {
  for (const key of ['block_ads', 'hide_cookie_banners', 'block_video_ads', 'block_third_party_cookies', 'https_only']) {
    assert.equal(mayWrite(settingClass(key)!, true), true, key);
    assert.equal(mayWrite(settingClass(key)!, false), false, key);
  }
  assert.equal(mayWrite(settingClass('search_suggestions')!, false), true);
  assert.equal(mayWrite(settingClass('search_suggestions')!, true), false);
  assert.equal(mayWrite(settingClass('haptics')!, false), true);
  assert.equal(mayWrite(settingClass('haptics')!, true), true);
});
