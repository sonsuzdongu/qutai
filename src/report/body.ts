/**
 * The report's request body (pure, no React Native: tested in scripts/credits-tests/report-body.test.ts). See report.ts.
 */

/** The same lists as the server's (`@qutai/shared` › reports.ts). */
export const REPORT_REASONS = ['offensive', 'sexual', 'dangerous', 'misleading', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportKind = 'answer' | 'app';

/** The server's limits; longer text is cut here, never refused. */
export const REPORT_NOTE_MAX = 1000;
export const REPORT_CONTENT_MAX = 20_000;
const APP_NAME_MAX = 100;

export type Report = {
  kind: ReportKind;
  reason: ReportReason;
  note?: string | null;
  /** Only when the user chose to include it. */
  content?: string | null;
  provider?: 'qutai' | 'own' | null;
  appName?: string | null;
};

/** Cuts text to `max` characters without splitting a surrogate pair. */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

/** The request body, as the server reads it. */
export function reportBody(report: Report, info: { version: string; platform: string; language: string }) {
  const body: Record<string, string> = { kind: report.kind, reason: report.reason };
  const note = report.reason === 'other' ? report.note?.trim() : '';
  if (note) body.note = cut(note, REPORT_NOTE_MAX);
  const content = report.content?.trim();
  if (content) body.content = cut(content, REPORT_CONTENT_MAX);
  if (report.provider) body.provider = report.provider;
  const appName = report.appName?.trim();
  if (report.kind === 'app' && appName) body.appName = cut(appName, APP_NAME_MAX);
  if (/^[0-9A-Za-z.+-]{1,40}$/.test(info.version)) body.appVersion = info.version;
  if (info.platform === 'ios' || info.platform === 'android') body.platform = info.platform;
  if (/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/.test(info.language)) body.language = info.language;
  return body;
}
