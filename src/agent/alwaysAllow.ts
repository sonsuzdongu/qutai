/**
 * "Don't ask again" for the assistant's confirmations of the device-permission kind (the phone's notifications,
 * calendar, reminders, location, downloads), which the user may allow for good from the confirmation itself
 * (Settings › Assistant lists them with a switch each, to take it back; reading the calendar and the location say
 * there that the data then goes to the AI provider without asking).
 *
 * Only these kinds are ever offered. Everything that acts on a web page or leaves the phone on the user's behalf
 * (clicks, typing, form submits, purchases, messages, sign-in, sharing, uploads, entering personal details) asks every
 * time; so do deleting the user's data (removing bookmarks or folders), a download of a risky file, and a download in
 * an incognito conversation. A denial is never remembered. Incognito: the calendar, location and scheduling tools are
 * refused there before any confirmation, so a remembered kind never applies there either.
 */

/**
 * What can be allowed for good: a scheduled notification, a calendar event, a reminder, reading the calendar, the
 * location, a download.
 */
export type AlwaysAllowKind = 'notification' | 'calendarEvent' | 'reminder' | 'calendarRead' | 'location' | 'download';

/** In the order Settings lists them. */
export const ALWAYS_ALLOW_KINDS: readonly AlwaysAllowKind[] = [
  'notification',
  'calendarEvent',
  'reminder',
  'calendarRead',
  'location',
  'download',
];

/**
 * The kind behind a download's confirmation, or none (asked every time, no "Don't ask again"): a risky file (one that
 * installs or runs code, an archive), or a conversation that involves incognito tabs.
 */
export function kindForDownload(d: { risky: boolean; incognito: boolean }): AlwaysAllowKind | undefined {
  return d.risky || d.incognito ? undefined : 'download';
}

export function isAlwaysAllowKind(value: unknown): value is AlwaysAllowKind {
  return typeof value === 'string' && (ALWAYS_ALLOW_KINDS as readonly string[]).includes(value);
}

/** The kind behind a scheduling plan (agent/scheduling.ts SchedulePlan['kind']). */
export function kindForSchedule(plan: 'event' | 'reminder' | 'notification'): AlwaysAllowKind {
  return plan === 'event' ? 'calendarEvent' : plan;
}

/** Whether a confirmation of this kind is skipped (no kind: never). */
export function isAlwaysAllowed(allowed: readonly AlwaysAllowKind[], kind: AlwaysAllowKind | undefined): boolean {
  return !!kind && allowed.includes(kind);
}

/**
 * The list after the user answered a confirmation of `kind`: added only when it was allowed with "Don't ask again"
 * ticked. Denying, or allowing without the tick, leaves it as it was.
 */
export function afterAnswer(
  allowed: readonly AlwaysAllowKind[],
  kind: AlwaysAllowKind | undefined,
  answer: { allowed: boolean; dontAskAgain: boolean },
): AlwaysAllowKind[] {
  if (!kind || !answer.allowed || !answer.dontAskAgain || allowed.includes(kind)) return [...allowed];
  return cleanAlwaysAllow([...allowed, kind]);
}

/** A switch in Settings turned one kind on or off. */
export function withKind(allowed: readonly AlwaysAllowKind[], kind: AlwaysAllowKind, on: boolean): AlwaysAllowKind[] {
  return cleanAlwaysAllow(on ? [...allowed, kind] : allowed.filter((k) => k !== kind));
}

/** Known kinds only, once each, in the Settings order. */
export function cleanAlwaysAllow(list: readonly unknown[]): AlwaysAllowKind[] {
  return ALWAYS_ALLOW_KINDS.filter((kind) => list.includes(kind));
}

/** Stored as a comma-separated list ("notification,reminder"); anything unknown is dropped. */
export function parseAlwaysAllow(raw: string | null | undefined): AlwaysAllowKind[] {
  return raw ? cleanAlwaysAllow(raw.split(',').map((s) => s.trim())) : [];
}

export function serializeAlwaysAllow(list: readonly AlwaysAllowKind[]): string {
  return cleanAlwaysAllow(list).join(',');
}
