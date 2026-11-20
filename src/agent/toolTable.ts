/**
 * Every tool the assistant can call, with what Qutai checks before it runs (`TOOL-30` in
 * docs/design/15-tools-and-phone-actions.md). One row per tool replaces the hand-kept lists that drifted apart; a tool
 * missing here is refused by executeTool and fails scripts/approval-tests/toolTable.test.ts, so a new tool can't skip
 * the checks.
 *
 * The checks run in this order, each only where the row lists it (executeTool.ts executeUnredacted):
 *   site      the site's permission for the page the call acts on (agent/sitePolicy.ts decide: blocked, read-only)
 *   outbound  an address the model wrote that carries the user's details to another site (agent/outbound.ts, UNTR-22)
 *   secret    a password, code or card field, or a card number in the text (SEC-1, SEC-2)
 *   personal  the user's remembered details and hidden values (MEM-17)
 *   press     a press or Enter that pays, deletes, changes an account or sends text (PAY-17, PAY-26, PAY-27)
 *   confirm   "Ask before every action" and the site's "Ask" level (decide's confirm)
 */

/** bookmarks actions that only read (never in the action history; bookmarkTool.ts uses the same set). */
export const BOOKMARK_READS: ReadonlySet<string> = new Set(['list', 'search']);

export type Gate = 'site' | 'outbound' | 'secret' | 'personal' | 'press' | 'confirm';
export const GATE_ORDER: readonly Gate[] = ['site', 'outbound', 'secret', 'personal', 'press', 'confirm'];

/**
 * The page a call acts on, for the site permission and the action history:
 * - none: no page (the app's own data, the phone, cards in the chat);
 * - agentTab: the page in the assistant's tab;
 * - readTab: the tab named by tab_id (read_tab);
 * - address: the address the call loads (navigate, open_tab);
 * - pdf: the assistant's tab, unless the PDF is one of the user's attachments (no site then).
 */
export type ToolTarget = 'none' | 'agentTab' | 'readTab' | 'address' | 'pdf';

/**
 * Whether the call needs the assistant's tab: 'agent' fails with a clear error when that tab was closed by the user
 * (element numbers from its page mean nothing elsewhere); 'optional' works without it (tab lists, opening a tab);
 * 'none' never uses it.
 */
export type TabNeed = 'agent' | 'optional' | 'none';

export type ToolSpec = {
  target: ToolTarget;
  tab: TabNeed;
  /** The address the model wrote that Qutai would load or request for this call (checked by 'outbound'). */
  address?: (input: Record<string, unknown>) => string | null;
  /** Runs while the app is in the background (Android, "Keep working in the background"). */
  background: boolean;
  /** Kept in the action history (never the text typed, the code or the values; see the tool's log line). */
  logged: boolean | ((input: Record<string, unknown>) => boolean);
  /** Asks the user itself every time, whatever "Ask before every action" says (never the generic question). */
  confirmsItself?: boolean;
  /** Reads or acts on the page itself (reader mode, the new tab page: executeTool runTool). */
  page?: boolean;
  /** Handled by the assistant's loop (runAgent), never by executeTool. */
  loop?: boolean;
  /** The checks, a subset of GATE_ORDER, run in that order. */
  gates: readonly Gate[];
};

/** "https://" in front of an address without a scheme, as navigate and open_tab load it. */
export function withScheme(raw: unknown): string {
  const url = String(raw || '').trim();
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '';

/** read_pdf's url, when it is the source (no ref, no attachment). */
function pdfAddress(input: Record<string, unknown>): string | null {
  if (typeof input.url !== 'string' || !input.url.trim() || hasValue(input.ref)) return null;
  return input.url.trim();
}

/** download_file's url, when the model wrote it (a ref is a link the page wrote). */
function downloadAddress(input: Record<string, unknown>): string | null {
  if (hasValue(input.ref) || typeof input.url !== 'string' || !input.url.trim()) return null;
  return input.url.trim();
}

const navAddress = (input: Record<string, unknown>) => withScheme(input.url);

const PAGE_READ = { target: 'agentTab', tab: 'agent', page: true, gates: ['site'] } as const;

export const TOOL_TABLE: Readonly<Record<string, ToolSpec>> = {
  // ---------- The page in the assistant's tab ----------
  read_page: { ...PAGE_READ, background: true, logged: true },
  read_source: { ...PAGE_READ, background: true, logged: true },
  view_screenshot: { ...PAGE_READ, background: false, logged: true },
  save_pdf: { ...PAGE_READ, background: false, logged: true },
  save_screenshot: { target: 'agentTab', tab: 'agent', page: true, background: false, logged: true, gates: ['site', 'confirm'] },
  read_aloud: { target: 'agentTab', tab: 'agent', background: false, logged: true, gates: ['site'] },
  scroll: { ...PAGE_READ, background: true, logged: false },
  scroll_to: { ...PAGE_READ, background: true, logged: false },
  go_back: { target: 'agentTab', tab: 'agent', background: true, logged: true, gates: ['site'] },
  click: { target: 'agentTab', tab: 'agent', page: true, background: true, logged: true, gates: ['site', 'press', 'confirm'] },
  click_at: { target: 'agentTab', tab: 'agent', page: true, background: true, logged: true, gates: ['site', 'press', 'confirm'] },
  type: {
    target: 'agentTab',
    tab: 'agent',
    page: true,
    background: true,
    logged: true,
    gates: ['site', 'secret', 'personal', 'press', 'confirm'],
  },
  select_option: { target: 'agentTab', tab: 'agent', page: true, background: true, logged: true, gates: ['site', 'personal', 'confirm'] },
  request_approval: { target: 'agentTab', tab: 'agent', page: true, background: false, logged: true, confirmsItself: true, gates: ['site'] },
  upload_image: { target: 'agentTab', tab: 'agent', page: true, background: false, logged: true, confirmsItself: true, gates: ['site'] },
  upload_file: { target: 'agentTab', tab: 'agent', page: true, background: false, logged: true, confirmsItself: true, gates: ['site'] },
  download_file: {
    target: 'agentTab',
    tab: 'agent',
    address: downloadAddress,
    background: false,
    logged: true,
    confirmsItself: true,
    gates: ['site', 'outbound'],
  },
  run_script: { target: 'agentTab', tab: 'agent', page: true, background: false, logged: true, confirmsItself: true, gates: ['site'] },
  restyle_page: {
    target: 'agentTab',
    tab: 'agent',
    page: true,
    background: false,
    logged: (input) => input.action === 'apply',
    confirmsItself: true,
    gates: ['site'],
  },
  page_cookies: {
    target: 'agentTab',
    tab: 'agent',
    page: true,
    background: false,
    logged: (input) => input.action === 'delete',
    confirmsItself: true,
    gates: ['site'],
  },
  try_hide: { target: 'agentTab', tab: 'agent', page: true, background: false, logged: false, gates: ['site'] },
  save_site_rules: { target: 'agentTab', tab: 'agent', page: true, background: false, logged: true, gates: ['site'] },
  site_rules: { target: 'agentTab', tab: 'agent', background: false, logged: (input) => input.action === 'remove', gates: ['site'] },

  // ---------- Addresses and tabs ----------
  navigate: { target: 'address', tab: 'agent', address: navAddress, background: true, logged: true, gates: ['site', 'outbound', 'confirm'] },
  open_tab: { target: 'address', tab: 'optional', address: navAddress, background: false, logged: true, gates: ['site', 'outbound', 'confirm'] },
  read_tab: { target: 'readTab', tab: 'none', background: true, logged: true, gates: ['site'] },
  read_pdf: { target: 'pdf', tab: 'optional', address: pdfAddress, background: false, logged: true, gates: ['site', 'outbound'] },
  list_tabs: { target: 'none', tab: 'optional', background: true, logged: false, gates: [] },
  switch_tab: { target: 'none', tab: 'optional', background: true, logged: false, gates: [] },
  close_tab: { target: 'none', tab: 'optional', background: true, logged: true, gates: [] },
  // Kept as before: the agent's tab is its target, so a blocked site in it refuses closing tabs too.
  close_tabs: { target: 'agentTab', tab: 'optional', background: true, logged: false, gates: ['site'] },
  take_notes: { target: 'agentTab', tab: 'optional', background: true, logged: false, gates: ['site'] },
  wait: { target: 'none', tab: 'optional', background: true, logged: false, gates: [] },

  // ---------- The app's own data and the phone ----------
  remember: { target: 'none', tab: 'none', background: true, logged: true, gates: [] },
  forget: { target: 'none', tab: 'none', background: true, logged: true, gates: [] },
  search_history: { target: 'none', tab: 'none', background: true, logged: false, gates: [] },
  bookmarks: { target: 'none', tab: 'optional', background: true, logged: (input) => !BOOKMARK_READS.has(String(input.action)), gates: [] },
  list_saved_tasks: { target: 'none', tab: 'none', background: true, logged: false, gates: [] },
  get_saved_task: { target: 'none', tab: 'none', background: true, logged: false, gates: [] },
  settings: { target: 'none', tab: 'none', background: true, logged: (input) => input.action === 'set', gates: [] },
  open_settings: { target: 'none', tab: 'none', background: false, logged: true, gates: [] },
  view_attachment: { target: 'none', tab: 'none', background: true, logged: false, gates: [] },
  edit_image: { target: 'none', tab: 'none', background: true, logged: false, gates: [] },
  save_file: { target: 'none', tab: 'none', background: true, logged: true, gates: [] },
  draft_email: { target: 'none', tab: 'none', background: false, logged: true, gates: [] },
  find_contact: { target: 'none', tab: 'none', background: false, logged: true, gates: [] },
  offer_call: { target: 'none', tab: 'none', background: true, logged: true, gates: [] },
  draft_sms: { target: 'none', tab: 'none', background: true, logged: true, gates: [] },
  draft_whatsapp: { target: 'none', tab: 'none', background: true, logged: true, gates: [] },
  share: { target: 'none', tab: 'none', background: true, logged: true, gates: [] },
  apps: {
    target: 'none',
    tab: 'none',
    background: false,
    logged: (input) => input.action === 'create' || input.action === 'update' || input.action === 'undo',
    gates: [],
  },
  add_calendar_event: { target: 'none', tab: 'none', background: false, logged: true, confirmsItself: true, gates: [] },
  add_reminder: { target: 'none', tab: 'none', background: false, logged: true, confirmsItself: true, gates: [] },
  schedule_notification: { target: 'none', tab: 'none', background: false, logged: true, confirmsItself: true, gates: [] },
  get_location: { target: 'none', tab: 'none', background: false, logged: true, confirmsItself: true, gates: [] },
  read_calendar: { target: 'none', tab: 'none', background: false, logged: true, confirmsItself: true, gates: [] },

  // ---------- Handled by the loop ----------
  ask_user: { target: 'none', tab: 'none', background: false, logged: false, loop: true, gates: [] },
  show_options: { target: 'agentTab', tab: 'none', background: false, logged: false, loop: true, gates: ['site'] },
};

export function toolSpec(name: string): ToolSpec | null {
  return Object.prototype.hasOwnProperty.call(TOOL_TABLE, name) ? TOOL_TABLE[name] : null;
}

export function isLoggedCall(spec: ToolSpec, input: Record<string, unknown>): boolean {
  return typeof spec.logged === 'function' ? spec.logged(input) : spec.logged;
}
