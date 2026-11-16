/**
 * "Don't ask again" for the assistant's confirmations: a short list of low-risk kinds of action that stay on the
 * phone, which the user may allow for good from the confirmation itself (Settings › Assistant lists them with a
 * switch each, to take it back).
 *
 * Only these kinds are ever offered. Everything that acts on a web page or leaves the phone (clicks, typing, form
 * submits, purchases, messages, downloads, sign-in, sharing, uploads) and everything that sends the user's data to
 * the AI provider (reading the calendar, the location) or deletes it (removing bookmarks) asks every time, and a
 * denial is never remembered.
 */

/** What can be allowed for good: a scheduled notification, a calendar event, a reminder. */
export type AlwaysAllowKind = 'notification' | 'calendarEvent' | 'reminder';

/** In the order Settings lists them. */
export const ALWAYS_ALLOW_KINDS: readonly AlwaysAllowKind[] = ['notification', 'calendarEvent', 'reminder'];

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
