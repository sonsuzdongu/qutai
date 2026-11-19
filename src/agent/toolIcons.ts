import type { IconName } from '../ui/Icon';
import { looksLikeIdNumber } from './memory';

const TOOL_ICONS: Record<string, IconName> = {
  read_page: 'document',
  read_source: 'source',
  navigate: 'globe',
  go_back: 'back',
  click: 'tap',
  click_at: 'tap',
  request_approval: 'shield',
  type: 'keyboard',
  select_option: 'select',
  scroll: 'scroll',
  scroll_to: 'scroll',
  save_pdf: 'pdf',
  save_screenshot: 'screenshot',
  view_screenshot: 'view',
  view_attachment: 'image',
  edit_image: 'image',
  upload_image: 'upload',
  upload_file: 'upload',
  share: 'share',
  read_pdf: 'pdf',
  read_aloud: 'readAloud',
  list_tabs: 'tabs',
  open_tab: 'newTab',
  switch_tab: 'switchTab',
  read_tab: 'tabs',
  close_tab: 'close',
  close_tabs: 'close',
  search_history: 'history',
  bookmarks: 'bookmarks',
  list_saved_tasks: 'tasks',
  get_saved_task: 'tasks',
  settings: 'settings',
  try_hide: 'shield',
  save_site_rules: 'shield',
  site_rules: 'shield',
  restyle_page: 'palette',
  run_script: 'script',
  page_cookies: 'cookies',
  open_settings: 'settings',
  draft_email: 'email',
  offer_call: 'phone',
  draft_sms: 'message',
  draft_whatsapp: 'message',
  take_notes: 'notes',
  wait: 'wait',
  remember: 'memory',
  forget: 'memory',
  add_calendar_event: 'calendar',
  read_calendar: 'calendar',
  add_reminder: 'alarm',
  schedule_notification: 'notifications',
  get_location: 'location',
  save_file: 'document',
  download_file: 'download',
};

/**
 * The icon shown before a tool call's label (describeToolCall) in the chat, the confirmation and the action
 * history. Without input (the history keeps only the tool's name) the tool's usual icon.
 */
export function toolIcon(name: string, input?: Record<string, unknown>): IconName {
  if (input) {
    // A hidden saved value, or an ID number being remembered: the lock, as their labels say.
    if (name === 'type' && input.memory !== undefined && input.memory !== null && input.memory !== '') return 'secure';
    if (name === 'remember' && looksLikeIdNumber(String(input.text ?? ''))) return 'secure';
    if (name === 'share' && input.app === 'whatsapp') return 'message';
  }
  return TOOL_ICONS[name] ?? 'tool';
}

/** The web search the model ran itself (the "Searched: …" line). */
export const WEB_SEARCH_ICON: IconName = 'find';
