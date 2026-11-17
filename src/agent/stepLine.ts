import { t } from '../i18n';
import type { IconName } from '../ui/Icon';
import { cutText } from '../utils/wellFormed';

/**
 * A tool result has two readers. Its `content` is written for the model, in English, and goes to it unchanged; the
 * chat shows the user a short line in the app's language instead (this file). A tool that knows what to tell the user
 * attaches a notice. Every failure reads the same way in every language: "This step didn't work", followed by the
 * translated reason when the tool gave one ("This step didn't work: the page didn't respond"), with the model's
 * English text under Details. The model's text is never the line itself.
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

/** A failure whose reason the user should read in their own language (shown after "This step didn't work: "). */
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

/**
 * An error from a user's own action (page menu, reader, downloads) as a toast line. An error whose English message
 * is also read by the model carries the user's sentence as `userMessage`.
 */
export function actionErrorText(e: unknown): string {
  const userMessage = (e as { userMessage?: unknown } | null)?.userMessage;
  if (typeof userMessage === 'string' && userMessage) return userMessage;
  return pageErrorNotice(e)?.text ?? t('common.error', { message: e instanceof Error ? e.message : String(e) });
}

/**
 * The tool result shown to the user: an info notice as it is; any failure as "This step didn't work" (with the
 * notice's translated reason after it when there is one) and the model's text as its details.
 */
export function stepLine(result: { content: string; isError: boolean; notice?: StepNotice }): StepLine | null {
  const notice = result.notice;
  if (notice?.tone === 'info') return { type: 'info', text: notice.text, ...(notice.icon ? { icon: notice.icon } : {}) };
  if (!notice && !result.isError) return null;
  // A failure keeps the model's text as its details, for a bug report.
  const details = cutText(result.content.trim(), 400);
  const text = notice ? t('step.failedWhy', { reason: notice.text }) : t('step.failed');
  return { type: 'error', text, ...(details ? { details } : {}) };
}
