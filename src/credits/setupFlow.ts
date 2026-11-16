/**
 * Setup's AI step in pro mode (Onboarding › QutaiSetup), as a small state machine so its rules are tested in Node
 * (scripts/credits-tests/setup-flow.test.ts):
 *
 *   choose ──"Continue with Qutai"──▶ (disclosure, unless accepted before) ──▶ signIn (unless signed in) ──▶ account
 *     │                                   │ declined                            │ cancelled / failed
 *     │                                   ▼                                     ▼
 *     │                                 choose + a note                       choose + a note
 *     └──"Use my own AI provider key"──▶ ownKey (the existing key fields) ──"back"──▶ choose
 *
 * Qutai is only picked on `account`, which is reached only signed in; losing the account there (signed out, deleted
 * elsewhere, session ended) goes back to `choose` with a note. Nothing here talks to the server or the stores.
 */
export type SetupNotice = 'declined' | 'signInCancelled' | 'signInFailed' | 'signedOut';

export type SetupState =
  | { screen: 'choose'; notice?: SetupNotice; detail?: string }
  | { screen: 'disclosure' }
  | { screen: 'signIn' }
  | { screen: 'account' }
  | { screen: 'ownKey' };

export type SetupEvent =
  | { type: 'chooseQutai'; consented: boolean; signedIn: boolean }
  | { type: 'disclosureAnswered'; accepted: boolean; signedIn: boolean }
  | { type: 'signedIn' }
  | { type: 'signInCancelled' }
  | { type: 'signInFailed'; message: string }
  | { type: 'accountLost' }
  | { type: 'ownKey' }
  | { type: 'back' };

export const SETUP_START: SetupState = { screen: 'choose' };

export function setupReducer(state: SetupState, event: SetupEvent): SetupState {
  switch (event.type) {
    case 'chooseQutai':
      if (state.screen !== 'choose') return state;
      if (!event.consented) return { screen: 'disclosure' };
      return event.signedIn ? { screen: 'account' } : { screen: 'signIn' };
    case 'disclosureAnswered':
      if (state.screen !== 'disclosure') return state;
      if (!event.accepted) return { screen: 'choose', notice: 'declined' };
      return event.signedIn ? { screen: 'account' } : { screen: 'signIn' };
    case 'signedIn':
      return state.screen === 'signIn' ? { screen: 'account' } : state;
    case 'signInCancelled':
      return state.screen === 'signIn' ? { screen: 'choose', notice: 'signInCancelled' } : state;
    case 'signInFailed':
      return state.screen === 'signIn' ? { screen: 'choose', notice: 'signInFailed', detail: event.message } : state;
    case 'accountLost':
      return state.screen === 'account' ? { screen: 'choose', notice: 'signedOut' } : state;
    case 'ownKey':
      return state.screen === 'choose' ? { screen: 'ownKey' } : state;
    case 'back':
      return state.screen === 'choose' ? state : { screen: 'choose' };
  }
}

/** Qutai Credits is the choice setup saves: only from the account screen (signed in). */
export function setupPicksQutai(state: SetupState): boolean {
  return state.screen === 'account';
}
