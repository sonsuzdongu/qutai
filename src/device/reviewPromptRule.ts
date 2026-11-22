// When the system's rating sheet is asked for on its own (pro mode, UI-41); kept apart so it can be tested without
// React Native. The sheet itself is in reviewPrompt.ts.

/** The days of use on which the rating sheet is asked for, once each. */
export const REVIEW_DAYS = [3, 30] as const;

export type ReviewPromptState = {
  /** Calendar days (the phone's local date) on which Qutai was opened. */
  days: number;
  /** The last of those days, as YYYY-MM-DD. */
  lastDay: string;
  /** Which of REVIEW_DAYS have been asked already. */
  asked: number[];
};

export const EMPTY_REVIEW_STATE: ReviewPromptState = { days: 0, lastDay: '', asked: [] };

/** The phone's local calendar day as YYYY-MM-DD. */
export function localDay(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Reads a stored state; anything unreadable starts over. */
export function parseReviewState(raw: string | null): ReviewPromptState {
  if (!raw) return EMPTY_REVIEW_STATE;
  try {
    const v = JSON.parse(raw) as Partial<ReviewPromptState>;
    const days = typeof v.days === 'number' && v.days >= 0 ? Math.floor(v.days) : 0;
    const lastDay = typeof v.lastDay === 'string' ? v.lastDay : '';
    const asked = Array.isArray(v.asked) ? v.asked.filter((d): d is number => typeof d === 'number') : [];
    return { days, lastDay, asked };
  } catch {
    return EMPTY_REVIEW_STATE;
  }
}

/** Qutai was opened on `today`: counts the day once, however often the app is opened that day. */
export function recordDay(state: ReviewPromptState, today: string): ReviewPromptState {
  if (state.lastDay === today) return state;
  return { ...state, days: state.days + 1, lastDay: today };
}

/**
 * The review day due now, if any: the latest of REVIEW_DAYS reached and not yet asked. A day missed (the sheet could
 * not be shown, the app was busy) is asked at the next calm moment; once day 30 is reached, an unasked day 3 is not
 * asked as well.
 */
export function dueReviewDay(state: ReviewPromptState): number | null {
  const reached = REVIEW_DAYS.filter((d) => state.days >= d);
  const latest = reached[reached.length - 1];
  return latest !== undefined && !state.asked.includes(latest) ? latest : null;
}

/** Marks a review day (and every earlier one) as asked. */
export function markAsked(state: ReviewPromptState, day: number): ReviewPromptState {
  const asked = REVIEW_DAYS.filter((d) => d <= day || state.asked.includes(d));
  return { ...state, asked: [...asked] };
}
