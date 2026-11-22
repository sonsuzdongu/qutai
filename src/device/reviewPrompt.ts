import * as SecureStore from 'expo-secure-store';
import * as StoreReview from 'expo-store-review';
import { accountsEnabled } from '../config/features';
import { secureStoreReady } from '../storage/secureStoreGate';
import { dueReviewDay, localDay, markAsked, parseReviewState, recordDay, type ReviewPromptState } from './reviewPromptRule';

/** Listed in storage/installCheck.ts so a delete-and-reinstall starts the count over. */
export const REVIEW_PROMPT_KEY = 'review_prompt';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

let busy = false;

async function read(): Promise<ReviewPromptState> {
  await secureStoreReady();
  return parseReviewState(await SecureStore.getItemAsync(REVIEW_PROMPT_KEY, OPTIONS));
}

async function write(state: ReviewPromptState): Promise<void> {
  await SecureStore.setItemAsync(REVIEW_PROMPT_KEY, JSON.stringify(state), OPTIONS);
}

/**
 * Pro mode only (UI-41): counts the days Qutai is opened and, on the 3rd and the 30th, asks the system for its rating
 * sheet once. Called when the app is in front and calm (setup, the lock, Settings, a running task and incognito are
 * not); iOS and Google Play still decide whether the sheet appears. If the sheet can't be offered (TestFlight), the
 * day stays due for a later start. Never throws.
 */
export async function maybeAskForReview(): Promise<void> {
  if (!accountsEnabled || busy) return;
  busy = true;
  try {
    const before = await read();
    let state = recordDay(before, localDay(new Date()));
    const due = dueReviewDay(state);
    if (due !== null && (await StoreReview.isAvailableAsync())) {
      await StoreReview.requestReview();
      state = markAsked(state, due);
    }
    if (state !== before) await write(state);
  } catch {
    // A rating prompt is never worth an error.
  } finally {
    busy = false;
  }
}
