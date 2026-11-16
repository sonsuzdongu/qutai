import { t } from '../i18n';
import type { IconName } from '../ui/Icon';
import { cutText } from '../utils/wellFormed';

/**
 * A tool result has two readers. Its `content` is written for the model, in English, and goes to it unchanged; the
 * chat shows the user a short line in the app's language instead (this file). A tool that knows what to tell the user
 * attaches a notice; a failure without one shows a plain "didn't work" line with the model's text as its details.
 */
export type StepNotice = {
  text: string;
  /** 'info': an ordinary status line (the user declined, a setting refused it): not a failure. */
  tone: 'info' | 'error';
  icon?: IconName;
};

/** What the chat shows for a finished tool step, or null when the step's own action line is enough. */
export type StepLine =
  | { type: 'info'; text: string; icon?: IconName }
  | { type: 'error'; text: string; details?: string };

/** The user said no in a confirmation dialog. */
export function declinedNotice(): StepNotice {
  return { text: t('step.declined'), tone: 'info', icon: 'close' };
}

/** Not done because the conversation touched an incognito tab (calendar, location, notifications…). */
export function incognitoNotice(): StepNotice {
  return { text: t('step.incognito'), tone: 'info', icon: 'incognito' };
}

/** Refused by one of the user's own settings (a blocked site, read-only site, personal details blocked…). */
export function settingNotice(text: string): StepNotice {
  return { text, tone: 'info', icon: 'shield' };
}

/** A failure the user should read about in their own language. */
export function errorNotice(text: string): StepNotice {
  return { text, tone: 'error' };
}

/** The message Tab.run rejects with when the page doesn't answer in time (browser/Tab.ts). */
const PAGE_TIMEOUT = 'The page did not respond';

/** For an error thrown while running a step on the page: the translated line when it is a known one. */
export function pageErrorNotice(e: unknown): StepNotice | undefined {
  const message = e instanceof Error ? e.message : String(e);
  return message.startsWith(PAGE_TIMEOUT) ? errorNotice(t('step.pageNoAnswer')) : undefined;
}

/** The tool result shown to the user: its notice, or for an unannotated failure the plain line with details. */
export function stepLine(result: { content: string; isError: boolean; notice?: StepNotice }): StepLine | null {
  const notice = result.notice;
  if (notice?.tone === 'info') return { type: 'info', text: notice.text, ...(notice.icon ? { icon: notice.icon } : {}) };
  if (!notice && !result.isError) return null;
  // A failure keeps the model's text as its details, for a bug report.
  const details = cutText(result.content.trim(), 400);
  return { type: 'error', text: notice?.text ?? t('step.failed'), ...(details ? { details } : {}) };
}
