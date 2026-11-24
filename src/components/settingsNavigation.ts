import type { Settings } from '../storage/settings';

/**
 * Settings' page navigation, kept out of SettingsModal.tsx so it can be tested: which page the back step leads to,
 * and the AI fields that wait for Save (the API key, provider and model are typed; everything else applies at once).
 */

export type SettingsPage =
  | 'main'
  | 'account'
  | 'credits'
  | 'assistant'
  /** Assistant's own pages (UI-55): what it may do, voice input, tasks and history. */
  | 'assistantPermissions'
  | 'assistantVoice'
  | 'assistantTasks'
  | 'privacy'
  | 'appearance'
  | 'language'
  | 'search'
  | 'backup'
  | 'about';

/** The AI fields of the settings, as the Assistant page edits them before Save. */
export const pickAi = (s: Settings) => ({
  provider: s.provider,
  apiKeys: s.apiKeys,
  models: s.models,
  customBaseUrl: s.customBaseUrl,
  customImages: s.customImages,
  customHeaders: s.customHeaders,
});

/**
 * The back step (the header's back button, Android's back button): the main page closes Settings, Qutai Credits goes
 * back to Account, the Assistant's own pages go back to Assistant, the Assistant page with unsaved AI fields asks to
 * discard them, every other page goes to the main page.
 */
export type BackStep = { kind: 'close' } | { kind: 'page'; page: SettingsPage } | { kind: 'askDiscard' };

export function backStep(page: SettingsPage, aiDirty: boolean): BackStep {
  if (page === 'main') return { kind: 'close' };
  if (page === 'credits') return { kind: 'page', page: 'account' };
  if (ASSISTANT_PAGES.includes(page)) return { kind: 'page', page: 'assistant' };
  if (page !== 'assistant' || !aiDirty) return { kind: 'page', page: 'main' };
  return { kind: 'askDiscard' };
}

/** The pages under Settings › Assistant; their back step is Assistant, which keeps unsaved AI fields as they were. */
export const ASSISTANT_PAGES: readonly SettingsPage[] = ['assistantPermissions', 'assistantVoice', 'assistantTasks'];
