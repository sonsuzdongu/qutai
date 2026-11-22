/**
 * The fixed vocabulary of Qutai's consented, anonymous usage events (pro builds only; docs/design/37-server-and-analytics.md
 * `SRV-31`…`SRV-33`). The server keeps exactly this list (backend/packages/shared/src/events.ts; the test in
 * scripts/analytics-tests compares the two) and drops anything else. Every field is one of a few fixed words: nothing
 * here can carry a web address, page content, a search term, chat text, memory, an account or a lasting device id.
 */

export const EVENT_FEATURES = ['voice_input', 'read_aloud', 'reader', 'saved_task', 'scheduled_task', 'app', 'page_style', 'image_edit', 'backup'] as const;
export const EVENT_PROVIDERS = ['qutai', 'own'] as const;
export const EVENT_ERROR_CLASSES = ['network', 'timeout', 'rate_limited', 'insufficient_credits', 'refused', 'provider', 'other'] as const;

export const EVENT_SCHEMA = {
  setup_finished: {},
  feature_used: { feature: EVENT_FEATURES },
  task_finished: { provider: EVENT_PROVIDERS },
  task_failed: { provider: EVENT_PROVIDERS, errorClass: EVENT_ERROR_CLASSES },
  purchase_screen_opened: {},
} as const;

export type EventName = keyof typeof EVENT_SCHEMA;
export type EventFeature = (typeof EVENT_FEATURES)[number];
export type EventErrorClass = (typeof EVENT_ERROR_CLASSES)[number];

type Props<N extends EventName> = { [K in keyof (typeof EVENT_SCHEMA)[N]]: (typeof EVENT_SCHEMA)[N][K] extends readonly (infer V)[] ? V : never };
/** The fields an event takes (none for setup_finished and purchase_screen_opened). */
export type EventProps<N extends EventName> = Props<N>;

export interface AnalyticsEvent {
  name: EventName;
  at: number;
  props: Record<string, string>;
}

/** What goes to `POST /events`: the batch carries the install id and the app's version, platform and language. */
export interface EventBatch {
  installId: string;
  appVersion: string;
  platform: 'ios' | 'android';
  locale: string;
  events: AnalyticsEvent[];
}
