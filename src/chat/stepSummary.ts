import { t } from '../i18n';

/**
 * The finished task's steps folded into one line ("7 steps · opened 2 pages · filled 1 form"), built from the chat's
 * step lines (the 'action' items the agent recorded). Pure: no React, so it is tested on its own
 * (scripts/assistant-tests/stepSummary.test.ts).
 */

/** What the summary needs of a chat item. `tool`: the tool's name (absent in conversations saved before it was kept). */
export type StepItem = { kind: string; tool?: string; icon?: string };

export type StepKind = 'open' | 'read' | 'field' | 'search' | 'file' | 'move' | 'other';

const TOOL_KINDS: Record<string, StepKind> = {
  navigate: 'open',
  open_tab: 'open',
  read_page: 'read',
  read_source: 'read',
  read_tab: 'read',
  read_pdf: 'read',
  type: 'field',
  select_option: 'field',
  upload_image: 'field',
  upload_file: 'field',
  web_search: 'search',
  search_history: 'search',
  save_pdf: 'file',
  save_screenshot: 'file',
  save_file: 'file',
  download_file: 'file',
  edit_image: 'file',
  // Moving to another page or tab ends a form (see summarizeSteps).
  go_back: 'move',
  switch_tab: 'move',
};

/** Older conversations keep only the icon; these icons name one tool each (or one kind of step). */
const ICON_KINDS: Record<string, StepKind> = {
  globe: 'open',
  newTab: 'open',
  source: 'read',
  keyboard: 'field',
  select: 'field',
  upload: 'field',
  find: 'search',
  history: 'search',
  pdf: 'file',
  screenshot: 'file',
  download: 'file',
  back: 'move',
  switchTab: 'move',
};

export function stepKind(item: StepItem): StepKind {
  if (item.tool) return TOOL_KINDS[item.tool] ?? 'other';
  return (item.icon && ICON_KINDS[item.icon]) || 'other';
}

export type StepSummary = {
  /** Every step (each tool call and web search). */
  steps: number;
  /** Pages opened (navigate, new tabs). */
  opened: number;
  /** Pages, tabs and PDFs read. */
  read: number;
  /** Forms filled: runs of typing / choosing / uploading on one page (another page or tab starts a new one). */
  forms: number;
  /** Web and history searches. */
  searches: number;
  /** Files made or saved (PDF, screenshot, download, edited image). */
  files: number;
};

export function summarizeSteps(items: readonly StepItem[]): StepSummary {
  const summary: StepSummary = { steps: 0, opened: 0, read: 0, forms: 0, searches: 0, files: 0 };
  let inForm = false;
  for (const item of items) {
    if (item.kind !== 'action') continue;
    summary.steps++;
    const kind = stepKind(item);
    if (kind === 'field') {
      if (!inForm) summary.forms++;
      inForm = true;
      continue;
    }
    // Clicks, scrolling, reading and waiting between fields belong to the same form; a new page does not.
    if (kind === 'open' || kind === 'move') inForm = false;
    if (kind === 'open') summary.opened++;
    else if (kind === 'read') summary.read++;
    else if (kind === 'search') summary.searches++;
    else if (kind === 'file') summary.files++;
  }
  return summary;
}

/** At most this many details follow the step count, so the line stays one line on a phone. */
const MAX_DETAILS = 3;

/** "7 steps · opened 2 pages · filled 1 form" in the app's language. */
export function stepSummaryText(summary: StepSummary): string {
  const count = (n: number, one: Parameters<typeof t>[0], many: Parameters<typeof t>[0]) =>
    n === 1 ? t(one) : t(many, { count: n });
  const details: string[] = [];
  if (summary.opened) details.push(count(summary.opened, 'steps.opened1', 'steps.opened'));
  if (summary.forms) details.push(count(summary.forms, 'steps.forms1', 'steps.forms'));
  if (summary.read) details.push(count(summary.read, 'steps.read1', 'steps.read'));
  if (summary.searches) details.push(count(summary.searches, 'steps.searches1', 'steps.searches'));
  if (summary.files) details.push(count(summary.files, 'steps.files1', 'steps.files'));
  return [count(summary.steps, 'steps.count1', 'steps.count'), ...details.slice(0, MAX_DETAILS)].join(' · ');
}

/** Fewer steps than this stay as they are: folding two lines saves nothing. */
export const MIN_FOLDED_STEPS = 3;

/** What the chat shows: an item as it is, or a run of step lines folded behind a summary (items[start..end)). */
export type ChatSegment = { type: 'item'; index: number } | { type: 'steps'; start: number; end: number };

/**
 * Splits the chat into items and runs of steps. A run is consecutive step lines ('action'), with status and error
 * lines between them (a tool error, "paused") kept inside; one at the end of a run stays outside, in view (a final
 * error, "Stopped"). A run is folded when it has MIN_FOLDED_STEPS steps and its task has finished: while a task
 * runs, nothing after the user's last message is folded, so its steps show live.
 */
export function segmentChat(items: readonly StepItem[], running: boolean): ChatSegment[] {
  const lastUser = items.findLastIndex((item) => item.kind === 'user');
  const segments: ChatSegment[] = [];
  let i = 0;
  while (i < items.length) {
    if (items[i].kind !== 'action' || (running && i > lastUser)) {
      segments.push({ type: 'item', index: i++ });
      continue;
    }
    // Extend over steps, and over status / error lines that another step follows.
    let end = i + 1;
    let probe = end;
    while (probe < items.length) {
      const kind = items[probe].kind;
      if (kind === 'action') end = ++probe;
      else if (kind === 'info' || kind === 'error') probe++;
      else break;
    }
    const steps = items.slice(i, end).filter((item) => item.kind === 'action').length;
    if (steps >= MIN_FOLDED_STEPS) segments.push({ type: 'steps', start: i, end });
    else for (let k = i; k < end; k++) segments.push({ type: 'item', index: k });
    i = end;
  }
  return segments;
}
