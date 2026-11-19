// Qutai Credits only while signed in (src/credits/gate.ts) and setup's AI step in pro mode (src/credits/setupFlow.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lostQutaiAccount, providerToSave, qutaiAccess } from '../../src/credits/gate.ts';
import { SETUP_START, setupPicksQutai, setupReducer, type SetupEvent, type SetupState } from '../../src/credits/setupFlow.ts';

test('access: off without credits, signed in and the disclosure needed, suspended apart', () => {
  assert.equal(qutaiAccess({ enabled: false, account: 'signedIn', consented: true }), 'off');
  assert.equal(qutaiAccess({ enabled: true, account: 'loading', consented: true }), 'loading');
  assert.equal(qutaiAccess({ enabled: true, account: 'signedOut', consented: true }), 'signIn');
  assert.equal(qutaiAccess({ enabled: true, account: 'signedIn', consented: false }), 'consent');
  assert.equal(qutaiAccess({ enabled: true, account: 'signedIn', suspended: true, consented: true }), 'suspended');
  assert.equal(qutaiAccess({ enabled: true, account: 'signedIn', consented: true }), 'ready');
});

test('losing the account is noticed only when Qutai is in use', () => {
  // Sign-out, account deletion and a session the server ended all end as signedIn → signedOut.
  assert.equal(lostQutaiAccount('signedIn', 'signedOut', ['qutai']), true);
  assert.equal(lostQutaiAccount('signedIn', 'signedOut', ['anthropic', 'qutai']), true, "a conversation's own choice counts");
  assert.equal(lostQutaiAccount('signedIn', 'signedOut', ['anthropic']), false);
  // A restored backup on a new phone starts signed out: no transition, the send-time prompt covers it.
  assert.equal(lostQutaiAccount('loading', 'signedOut', ['qutai']), false);
  assert.equal(lostQutaiAccount('signedOut', 'signedIn', ['qutai']), false);
});

test('setup never saves Qutai without an account', () => {
  assert.equal(providerToSave('qutai', true, 'anthropic'), 'qutai');
  assert.equal(providerToSave('qutai', false, 'openai'), 'openai');
  assert.equal(providerToSave('qutai', false, 'qutai'), 'anthropic');
  assert.equal(providerToSave('gemini', false, 'anthropic'), 'gemini');
});

const run = (events: SetupEvent[], from: SetupState = SETUP_START) => events.reduce(setupReducer, from);

test('setup: disclosure, sign-in, account; Qutai picked only there', () => {
  let s = run([{ type: 'chooseQutai', consented: false, signedIn: false }]);
  assert.deepEqual(s, { screen: 'disclosure' });
  assert.equal(setupPicksQutai(s), false);
  s = run([{ type: 'disclosureAnswered', accepted: true, signedIn: false }], s);
  assert.deepEqual(s, { screen: 'signIn' });
  assert.equal(setupPicksQutai(s), false);
  s = run([{ type: 'signedIn' }], s);
  assert.deepEqual(s, { screen: 'account' });
  assert.equal(setupPicksQutai(s), true);
});

test('setup: already accepted and signed in goes straight to the account', () => {
  assert.deepEqual(run([{ type: 'chooseQutai', consented: true, signedIn: true }]), { screen: 'account' });
  assert.deepEqual(run([{ type: 'chooseQutai', consented: true, signedIn: false }]), { screen: 'signIn' });
});

test('setup: declining, cancelling or failing returns to the choice with a note', () => {
  const declined = run([
    { type: 'chooseQutai', consented: false, signedIn: false },
    { type: 'disclosureAnswered', accepted: false, signedIn: false },
  ]);
  assert.deepEqual(declined, { screen: 'choose', notice: 'declined' });
  const cancelled = run([{ type: 'chooseQutai', consented: true, signedIn: false }, { type: 'signInCancelled' }]);
  assert.deepEqual(cancelled, { screen: 'choose', notice: 'signInCancelled' });
  assert.equal(setupPicksQutai(cancelled), false);
  const failed = run([{ type: 'chooseQutai', consented: true, signedIn: false }, { type: 'signInFailed', message: 'offline' }]);
  assert.deepEqual(failed, { screen: 'choose', notice: 'signInFailed', detail: 'offline' });
  const withDetails = run([
    { type: 'chooseQutai', consented: true, signedIn: false },
    { type: 'signInFailed', message: 'refused', details: 'Qutai server: HTTP 401 unauthorized (wrong_audience)' },
  ]);
  assert.deepEqual(withDetails, {
    screen: 'choose',
    notice: 'signInFailed',
    detail: 'refused',
    technical: 'Qutai server: HTTP 401 unauthorized (wrong_audience)',
  });
  const back = run([{ type: 'chooseQutai', consented: true, signedIn: false }, { type: 'back' }]);
  assert.deepEqual(back, { screen: 'choose' });
});

test('setup: losing the account on the account screen goes back to the choice', () => {
  const s = run([{ type: 'chooseQutai', consented: true, signedIn: true }, { type: 'accountLost' }]);
  assert.deepEqual(s, { screen: 'choose', notice: 'signedOut' });
  assert.equal(setupPicksQutai(s), false);
});

test('setup: own key path and back; stray events change nothing', () => {
  const own = run([{ type: 'ownKey' }]);
  assert.deepEqual(own, { screen: 'ownKey' });
  assert.deepEqual(run([{ type: 'back' }], own), { screen: 'choose' });
  assert.deepEqual(run([{ type: 'signedIn' }]), SETUP_START);
  assert.deepEqual(run([{ type: 'chooseQutai', consented: true, signedIn: true }], own), own);
});

test('setup accordion (INTRO-28): opening one section closes the other, a note clears, Qutai Credits opens first', () => {
  assert.equal(SETUP_START.screen, 'choose');
  const declined = run([{ type: 'chooseQutai', consented: false, signedIn: false }, { type: 'disclosureAnswered', accepted: false, signedIn: false }]);
  assert.deepEqual(declined, { screen: 'choose', notice: 'declined' });
  const own = run([{ type: 'ownKey' }], declined);
  assert.deepEqual(own, { screen: 'ownKey' });
  // Opening Qutai Credits again: its section, with the note gone; opening the own key a second time is the same section.
  assert.deepEqual(run([{ type: 'back' }], own), { screen: 'choose' });
  assert.deepEqual(run([{ type: 'ownKey' }, { type: 'ownKey' }]), { screen: 'ownKey' });
  assert.equal(setupPicksQutai(own), false);
});
