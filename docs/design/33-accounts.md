# 33. Accounts and sign-in

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The optional Qutai account in the official (pro) builds: signing in with Apple, Google or an email code, the rules that
decide when two sign-ins are the same person, adding and removing sign-in methods, combining two accounts, signing out
and deleting the account. Builds from this repository have none of it.

## How it works

1. Only pro builds (built with `EXPO_PUBLIC_PRO_MODE=on` and a server address) have Settings › Account. Signed out, it
   offers **Sign in with Apple** (iPhone; on Android only when the server says it supports Apple's web flow), **Sign in
   with Google** (only when the build has the Google client id) and **Continue with email**. The same buttons appear in
   setup when the user picks Qutai Credits (choose → disclosure → sign in → account and balance).
2. Apple on iPhone uses the system sheet. Google on Android uses the phone's Credential Manager; Google on iPhone opens
   Google's page in the system's sign-in browser, never inside a web view. Each sign-in carries a fresh random value
   (a nonce: a number used once) so a captured sign-in can't be replayed.
3. Email: the user types an address and gets one mail, in the app's language, with a 6-digit code and a link. Typing
   the code, or tapping the link **on the same phone**, signs in. Example: Ayşe types her address, opens the mail in
   Gmail, taps the link; a page on Qutai's website opens Qutai and she is signed in. If Qutai itself is the browser the
   link opens in, Qutai takes the link without loading the page.
4. The server gives the phone a 15-minute access pass and a 60-day renewal pass (a refresh token); the app keeps both
   in the phone's secure storage and renews quietly. If an old renewal pass is ever used twice, that phone's session
   ends (someone may have copied it).
5. Two sign-ins become one account only through an address both sides can vouch for. Example: Ali signed in with
   Google with his Gmail address last week; today he chooses email and proves the same Gmail address with the code → Ali lands in the
   same account and Qutai says once which ways Ali can now sign in. An Apple "Hide My Email" address never joins
   anything.
6. Signed in, Settings › Account lists **Ways to sign in**, each with its address (since 19 Nov 2026, `ACC-52`):
   "Email: name@example.com", "Google: name@gmail.com", "Apple: hidden email" for a Hide My Email address. **Add a sign-in method** (Google, Apple, or email with a
   separate "confirm" code) adds one, and every address on the account gets a "sign-in method added" mail. If that
   method already belongs to another Qutai account, nothing changes and Qutai offers **Combine with another account**.
7. Removing a method (the × next to it) asks for confirmation. If the user hasn't signed in on this phone in the last
   5 minutes with that method or an older one, Qutai asks them to confirm with one of exactly those methods first. The
   last method can't be removed. Other phones stay signed in; the confirmation and the mail point to "Sign out of all
   devices".
8. **Combine with another account**: the account the user is signed in to stays. The user signs in to the other
   account on this phone; Qutai shows both accounts' methods and balances, says it can't be undone, and combines on
   "Combine". Methods, credits (even a negative balance), purchases, usage and server backups move over; the other
   account's sessions end on every phone.
9. Settings › Account also has **Sign out**, **Sign out of all devices** and **Delete account**. Deletion says what is
   deleted; Apple accounts confirm with Apple first so the server can withdraw Qutai's access at Apple.
10. Signing out leaves the app working with the user's own AI key; nothing on the phone is lost.
11. Test sign-in (for the owner's local test server only): Settings › Account › Test sign-in › test-1, test-2 or
    test-3, shown only in builds made for that. The owner ordered it off for pro test APKs on 17 Nov 2026.

## The rules

- **`ACC-1`** Accounts, sign-in and Settings › Account exist only when pro mode is on and a server address is set; otherwise the app never contacts Qutai's server.
  Status: Owner, date not recorded · Why: builds from the repository must keep "the user's own AI key, no account, nothing sent to our servers" (TODO.md › Pro mode); pro-only parts must not break that build (a9e83e4) · Enforced: In the app: src/config/features.ts (accountsEnabled) · Source: TODO.md › Pro mode; README.md › Official builds; d95ab3e, a9e83e4
- **`ACC-2`** Accounts join automatically only through a trustworthy address: an address proved with Qutai's own code, a Google address on gmail.com or googlemail.com or from a Google Workspace account (the `hd` claim), or an Apple address that is not a private-relay address.
  Status: Owner, 2026-11-16 (the Google part is also listed again for confirmation in [TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Accounts and sign-in) · Why: Google calls an address authoritative only for gmail and Workspace; any other verified address "may have changed hands"; Apple relay addresses are per-app aliases · Enforced: Server: backend/apps/api/src/auth/email/trust.ts (providerEmail, GMAIL_DOMAINS, APPLE_RELAY_DOMAIN) · Source: backend/DESIGN.md › Sign-in by email › Trust, › Decisions (b), (c); b91825e
- **`ACC-3`** Unverified provider addresses and test-sign-in users never join accounts.
  Status: Owner, 2026-11-16 · Why: not proved · Enforced: Server: backend/apps/api/src/auth/email/trust.ts (providerEmail) · Source: backend/DESIGN.md › Trust
- **`ACC-4`** Google and Apple sign-ins never join each other by address; they join only through an email sign-in method.
  Status: Default (manager or implementing session; open to change) · Why: "was not asked and would change today's behaviour" · Enforced: Server: backend/apps/api/src/auth/users.ts (findOrCreateUser) · Source: backend/DESIGN.md › Sign-in by email › Linking rules
- **`ACC-5`** A trustworthy address stored on an account is never replaced by an untrustworthy one from a later sign-in, and adding a method never takes the account's address away from the method that gave it.
  Status: Default (manager or implementing session; open to change) · Why: keeps joining stable; reason not recorded beyond that · Enforced: Server: backend/apps/api/src/auth/users.ts (findOrCreateUser); backend/apps/api/src/routes/methods.ts (afterAdd) · Source: backend/DESIGN.md › Trust, › Adding a method
- **`ACC-6`** An email sign-in to an address that is the trustworthy address of two existing accounts is refused ("account_conflict"); nothing is merged and the pair is recorded.
  Status: Owner, 2026-11-16 · Why: chosen over picking one account or creating a third · Enforced: Server: backend/apps/api/src/auth/users.ts (findOrCreateEmailUser, recordConflict) · Source: backend/DESIGN.md › Linking rules, › Decisions (e)
- **`ACC-7`** A Google or Apple sign-in to an identity that already exists is never refused because of an address clash; the clash is only recorded, and an untrusted match makes a separate account.
  Status: Owner, 2026-11-16 · Why: existing sign-ins keep working · Enforced: Server: backend/apps/api/src/auth/users.ts (findOrCreateUser, recordConflict) · Source: backend/DESIGN.md › Linking rules, › Decisions (e)
- **`ACC-8`** A suspended account is refused on every sign-in path, a deleted one too, and an address is never handed to a new account while the old one exists.
  Status: Default (manager or implementing session; open to change) · Why: "a suspension can't be dodged by signing in another way" · Enforced: Server: backend/apps/api/src/auth/users.ts (refusal); backend/apps/api/src/auth/sessions.ts (rotateSession) · Source: backend/DESIGN.md › Suspended and deleted users
- **`ACC-10`** The server accepts an Apple or Google token only after checking its signature, issuer, audience (the configured client ids), expiry (30 s tolerance) and nonce; a refusal carries a fixed reason the app shows under "Details", never token content.
  Status: Default (manager or implementing session; open to change) · Why: lets a tester tell a console mistake from a code bug · Enforced: Server: backend/apps/api/src/auth/providers.ts, jwks.ts · Source: backend/README.md › Auth › Sign-in error reasons; 782a2ad
- **`ACC-11`** Sign in with Apple is offered on iPhone whenever Google is, and its capability is added only to pro builds.
  Status: Default (manager or implementing session; open to change) · Why: App Store guideline 4.8; Expo adds the capability to every build, so the pro plugin removes it when pro is off · Source: TODO.md › Accounts and OAuth sign-in; plugins/withProAccounts.js; d95ab3e
- **`ACC-13`** The access pass lasts 15 minutes and every request checks in the database that the session is live, so sign-out, suspension and deletion take effect at once.
  Status: Default (manager or implementing session; open to change) · Why: "not after 15 minutes" · Enforced: Server: backend/apps/api/src/auth/middleware.ts, tokens.ts · Source: backend/README.md › Auth; backend/DESIGN.md › API Worker
- **`ACC-14`** Renewal passes are random, stored only as a keyed hash, last 60 days and work once; presenting a used one again ends that phone's whole session chain.
  Status: Default (manager or implementing session; open to change) · Why: detects theft or a replayed request · Enforced: Server: backend/apps/api/src/auth/sessions.ts (rotateSession, revokeFamily) · Source: backend/README.md › Auth
- **`ACC-15`** The app keeps its passes in secure storage readable only on this phone, keeps no Apple or Google token, renews one at a time and signs out when the server refuses the renewal.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/account/storage.ts (OPTIONS, AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY); src/account/session.ts · Source: TODO.md › Accounts and OAuth sign-in; README.md › Accounts
- **`ACC-17`** An email sign-in sends one mail with a 6-digit code and a separate long link; using either ends both, and the server keeps only keyed hashes of the address, code and link.
  Status: Owner, 2026-11-16 · Why: the link must find its sign-in without the address so a wrong phone can be told so, and a 6-digit value can't be a lookup key; a copy of the database alone can't test codes or list addresses · Enforced: Server: backend/apps/api/src/auth/email/challenges.ts (createChallenge, proveCode, proveLink) · Source: backend/DESIGN.md › Flow and secrets, › Decisions (a)
- **`ACC-18`** Asking for an email code answers the same way for every address and never looks at whether an account exists.
  Status: Default (manager or implementing session; open to change) · Why: nobody can find out which addresses have accounts · Enforced: Server: backend/apps/api/src/routes/email.ts (startEmailSignIn) · Source: backend/DESIGN.md › Flow and secrets, › Threat model
- **`ACC-19`** Email limits: per address 5 codes an hour and 10 a day; per phone 10 an hour; one new code per 30 seconds; each code 5 tries, 10 minutes, once; per network address about 5 code requests and 20 sign-in calls a minute. Since 20 Nov 2026 also caps on all mails (60 an hour, 200 a day) and per network address (20 a day), in the setting `email_limits` (changeable in the panel, safe defaults); at a cap the start is refused like the per-address-network limit, the same for every address, nothing is stored or mailed, it is logged and the panel's Overview shows the mails against the caps.
  Status: Owner, 2026-11-16 · Changed 2026-11-20 (code review): the global and per-network daily caps (backend migration 0013, `email_sends`, a keyed hash of the network address kept a day) · Why: caps mail-bombing and guessing (about 1 in 20 000 per address per day); kept in code because they are "security floors rather than business numbers" · Enforced: Server: backend/apps/api/src/auth/email/limits.ts; backend/apps/api/src/auth/email/challenges.ts (createChallenge) · Source: backend/DESIGN.md › Sign-in by email › Limits
- **`ACC-20`** The code and the link work only on the phone that asked; a link opened elsewhere is refused without being used up.
  Status: Default (manager or implementing session; open to change) · Why: forwarded mails, mail scanners and laptops can't use it · Enforced: Server: backend/apps/api/src/routes/email.ts (proveEmail); backend/apps/api/src/auth/email/challenges.ts (proveLink) · Source: backend/DESIGN.md › Flow and secrets
- **`ACC-22`** The mail links to an https page on Qutai's website that opens the app; the page never signs anyone in by itself.
  Status: Owner, 2026-11-17 · Why: Gmail showed the `qutai://` link as plain text; mail scanners open links · Enforced: webpage/worker/intent.ts; Server: MAIL_INTENT_DOMAIN, MAIL_INTENT_PATH · Source: TODO.md › Accounts and OAuth sign-in; backend/README.md › Owner decisions › Link; 9b92c94, 2a06fbd
- **`ACC-23`** A sign-in link opened inside Qutai's own browser is never loaded: it never becomes a tab, a history entry, a search, page text for the assistant or a line in "What was sent to the AI".
  Status: Default (manager or implementing session; open to change) · Why: keeps the token out of history, logs and the AI · Enforced: In the app: src/components/AccountLinks.tsx (takeSignInLink), called from src/components/BrowserView.tsx · Source: README.md › Sign-in by email; docs/app-links.md; 75e2294
- **`ACC-24`** Mails go through Mailjet with open and click tracking switched off per message; with no sender configured the server refuses to start an email sign-in; a print-to-terminal sender exists only on local test servers.
  Status: Owner, 2026-11-16 (Mailjet chosen); tracking off: Default (manager or implementing session; open to change) · Why: Cloudflare has no free sending; click tracking had rewritten the link through Mailjet's tracker, putting the token in a third party's logs · Enforced: Server: backend/apps/api/src/auth/email/sender.ts · Source: backend/DESIGN.md › Sender, › Mail in ten languages; notes mailjet-domain-authentication
- **`ACC-25`** Account mails (sign-in code, confirm code, method added, method removed, accounts combined) exist in all ten app languages, with Turkish in the "siz" form, and the app sends its language with every sign-in.
  Status: Owner, 2026-11-16 (English and Turkish wording); the other eight: Default (manager or implementing session; open to change) · Why: mail in the user's language · Source: backend/README.md › Message wording; backend/apps/api/src/auth/email/message.ts; memory turkish-ui-siz
- **`ACC-26`** When a sign-in method is joined to an existing account, every address on the account gets a notice mail; new accounts, ordinary sign-ins and clashes send none, and the mail never delays or fails the sign-in.
  Status: Owner, 2026-11-16 · Why: a method joined behind the owner's back; the mail points to "Sign out of all devices" · Enforced: Server: backend/apps/api/src/auth/email/notice.ts (sendMethodAddedNotice); backend/apps/api/src/routes/methods.ts (settleProof) · Source: backend/DESIGN.md › Notice when a sign-in method is added
- **`ACC-27`** Every change while signed in (add, re-check, combine) starts with a full sign-in with one method on the same phone; a sign-in code can't confirm and a confirm code can't sign in.
  Status: Default (manager or implementing session; open to change) · Why: one mechanism for all three; codes can't be reused across purposes · Enforced: Server: backend/apps/api/src/routes/methods.ts (settleProof, proveEmailStart); backend/apps/api/src/auth/proofs.ts (recordProof) · Source: backend/DESIGN.md › Proof while signed in
- **`ACC-28`** Today adding a sign-in method needs only the session and the new method's own sign-in, no re-check of an existing method.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Security) · Why: a re-check "would stop nothing an attacker holding the session can't already do"; removal is the guarded action; risk left open: someone holding an unlocked phone can add their own method and keeps access until the owner removes it · Enforced: Server: backend/apps/api/src/routes/methods.ts (settleProof, no recent-proof check on add) · Source: backend/DESIGN.md › Adding a method, › Threat model
- **`ACC-29`** An address that is only another account's Google or Apple address can be added by proving it with a code; it is recorded as a clash and never counts as signing in to that other account.
  Status: Default (manager or implementing session; open to change) · Why: the user proved the mailbox; combining needs a real sign-in to the other account · Enforced: Server: backend/apps/api/src/routes/methods.ts (afterAdd) · Source: backend/DESIGN.md › Adding, › Decisions
- **`ACC-30`** Today removing a method needs a sign-in on this phone in the last 5 minutes with that method or one added before it; otherwise the server asks for a re-check and the app offers exactly those methods.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Accounts and sign-in) · Why: an intruder with an unlocked phone could add a method and use it to remove the owner's; with the age rule a newer method can never remove an older one; cost: someone who lost their oldest method needs support · Enforced: Server: backend/apps/api/src/auth/proofs.ts (RECENT_PROOF_MS, recentProofs); backend/apps/api/src/routes/methods.ts (removeMethod); In the app: src/account/methodRules.ts (methodsThatCanConfirm) · Source: backend/DESIGN.md › Removing a method
- **`ACC-31`** The last sign-in method can never be removed, checked inside the delete itself.
  Status: Default (manager or implementing session; open to change) · Why: two removals at once can't empty the account · Enforced: Server: backend/apps/api/src/routes/methods.ts (removeMethod); In the app: src/account/methodRules.ts (canRemove) · Source: backend/DESIGN.md › Removing
- **`ACC-32`** Today removing a method leaves other phones signed in; the confirmation and the "method removed" mail (to the account's addresses and the removed one) point to "Sign out of all devices".
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Accounts and sign-in) · Why: sessions aren't tied to the method; ending them "would sign out the person's own other phones for an ordinary tidy-up" · Enforced: Server: backend/apps/api/src/routes/methods.ts (removeMethod, no session revocation); backend/apps/api/src/auth/email/notice.ts (sendMethodRemovedNotice) · Source: backend/DESIGN.md › Removing; README.md › Sign-in methods
- **`ACC-33`** Removing an email method ends its pending codes and stops it joining sign-ins; removing Apple withdraws Qutai's access at Apple (a failure is logged and the removal still happens).
  Status: Default (manager or implementing session; open to change) · Why: a removed address must stop joining; Apple revocation as at deletion · Enforced: Server: backend/apps/api/src/routes/methods.ts (removeMethod); backend/apps/api/src/auth/users.ts (revokeApple) · Source: backend/DESIGN.md › Removing
- **`ACC-34`** Only the signed-in account can start a combine, by a full sign-in to one of the other account's own methods on the same phone; the proof works once, for 10 minutes, for that account and phone; never automatic, never from an address match.
  Status: Default (manager or implementing session; open to change) · Why: nobody can fold someone else's account into theirs · Enforced: Server: backend/apps/api/src/auth/proofs.ts (MERGE_PROOF_TTL_MS, createMergeProof, findMergeProof); backend/apps/api/src/routes/merge.ts (previewMerge, confirmMerge) · Source: backend/DESIGN.md › Merging two accounts
- **`ACC-35`** The signed-in account survives a combine; the combine is final, the other account never signs in again and its sessions end everywhere.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded beyond "a merge is final"; the trail is kept (tombstone row, audit rows, ledger references) · Enforced: Server: backend/apps/api/src/account/merge.ts (beginMerge) · Source: backend/DESIGN.md › Merging, › What cannot be undone
- **`ACC-36`** Today someone who controls one method of another account (for example a stolen Google account) can combine its credits into their own account, and it is final; there is no waiting period or mail confirmation.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026) › Security) · Why: inherent, "as at sign-in"; options offered: accept, a waiting period, or confirmation by mail · Enforced: Designed, not built (no extra check) · Source: backend/DESIGN.md › Threat model
- **`ACC-37`** A combine moves the whole balance including a debt, purchase records (a later refund is taken from the surviving account), abuse flags, usage and server backups; suspended or deleting accounts can't be combined.
  Status: Default (manager or implementing session; open to change) · Why: a combine must not wash away a debt or a flag or dodge a suspension · Enforced: Server: backend/apps/api/src/account/UserAccount.ts (mergeOut, mergeIn); backend/apps/api/src/account/merge.ts (beginMerge, resumeMerge) · Source: backend/DESIGN.md › Merging (steps 1–4)
- **`ACC-39`** "Sign out of all devices" ends every session of the account and kills pending email codes for its addresses.
  Status: Default (manager or implementing session; open to change) · Why: a half-finished sign-in by someone else can't complete afterwards · Enforced: Server: backend/apps/api/src/auth/sessions.ts (endAllSessions); backend/apps/api/src/auth/email/challenges.ts (endChallengesFor) · Source: backend/DESIGN.md › Clean-up
- **`ACC-40`** Deleting the account ends its sessions, withdraws Sign in with Apple, wipes the credit ledger, deletes its server backups and its payment-service customer, and removes the account; purchase records stay without the user; a failed step is finished by a retry.
  Status: Default (manager or implementing session; open to change) · Why: the App Store requires in-app deletion and Apple revocation (guideline 5.1.1(v)); tax law requires the anonymised sales record · Enforced: Server: backend/apps/api/src/auth/users.ts (deleteAccount, revokeApple) · Source: backend/README.md › Account deletion
- **`ACC-41`** The server keeps Apple's renewal token only encrypted and only to withdraw access at deletion or removal; it stores no Google credential.
  Status: Default (manager or implementing session; open to change) · Why: Apple requires revocation · Enforced: Server: backend/apps/api/src/auth/users.ts (storeAppleRevocationToken) · Source: backend/README.md › Account deletion
- **`ACC-42`** A suspended account can't sign in, renew or use the service but can still sign out and delete itself.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Server: backend/apps/api/src/auth/sessions.ts (rotateSession); backend/apps/api/src/auth/middleware.ts · Source: backend/README.md › Auth
- **`ACC-43`** Sign in with Apple on Android runs Apple's web flow through the server in a browser tab and is on only when the owner has configured it; Apple's tokens never appear in a web address, the app finishes with a secret that never leaves the phone, and only the email is asked for.
  Status: Default (manager or implementing session; open to change) · Why: Apple has no Android library; another app catching the return link can't finish without the phone's secret · Enforced: Server: backend/apps/api/src/routes/appleWeb.ts (FLOW_TTL_MS); In the app: src/account/appleWeb.ts · Source: backend/DESIGN.md › Sign in with Apple on Android; docs/apple-sign-in.md
- **`ACC-45`** Test sign-in exists on the server only on a local test server switched on with a secret of at least 32 characters; otherwise, and for a wrong secret, it answers "not found" like a path that doesn't exist; 10 tries a minute for everyone together.
  Status: Owner, 2026-11-16 · Why: to try pro mode on a phone through a tunnel before Apple and Google were set up; not "local only" because the tunnel is public · Enforced: Server: backend/apps/api/src/auth/dev.ts (devSignInEnabled, DEV_SIGN_IN_PER_MINUTE); backend/apps/api/src/index.ts · Source: backend/README.md › Test sign-in; 53000e3
- **`ACC-46`** The app shows Test sign-in only when built with `EXPO_PUBLIC_DEV_LOGIN=on` and the secret; such a build must never be shared or shipped, and pro test APKs are built without it since 17 Nov 2026.
  Status: Owner, 2026-11-17 (test sign-in off) · Why: values built into the app are readable by anyone with the build · Enforced: In the app: src/config/features.ts (devLoginEnabled) · Source: README.md › Test sign-in; 3249723; memory fix-before-launch
- **`ACC-47`** A failed sign-in shows a plain sentence and a "Details" line that never contains a token, nonce, client id or email.
  Status: Default (manager or implementing session; open to change) · Why: the owner can send the line for diagnosis · Enforced: In the app: src/account/errorDetails.ts · Source: docs/google-sign-in.md; ac7b432
- **`ACC-48`** Sign-in logs carry only a request id, user id, provider and a fixed reason; never a token, nonce, code, link, email or provider account id.
  Status: Default (manager or implementing session; open to change) · Why: privacy; a test checks it in a production-like run · Enforced: Server: backend/apps/api/src/lib/log.ts (ALLOWED, sanitize) · Source: backend/README.md › Auth
- **`ACC-49`** Today setup offers sign-in only on the Qutai Credits path; own-key users get no optional "Sign in" step.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#accounts-and-oauth-sign-in)) · Why: reason not recorded · Source: TODO.md › Accounts and OAuth sign-in; src/credits/setupFlow.ts
- **`ACC-50`** Today Sign in with Apple on Android is built but stays off until the owner creates Apple's Services ID and return address.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#accounts-and-oauth-sign-in)) · Why: "if wanted" · Source: TODO.md › Accounts and OAuth sign-in, › Set-up only the owner can do; docs/apple-sign-in.md
- **`ACC-51`** Today the sign-in methods are Apple, Google and email; no other provider.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#pending-decisions)) · Why: reason not recorded · Source: TODO.md › Qutai Credits › Pending decisions
- **`ACC-52`** Each sign-in method shows its address beside it: email methods their address, Google and Apple the address their own token gave (the server keeps it per method, `identities.email`, refreshed on each sign-in with one); an Apple private-relay address shows as a translated "hidden email". A method without an address (an older server, a token that carried none, a method not signed in again since the update on an account with two Google or Apple methods) shows its name alone. Logs stay free of addresses (`ACC-48`).
  Status: Owner, 2026-11-19 · Why: the owner wanted to see which address each method signed in with; the relay address means nothing to the user · Enforced: Server: backend/apps/api/src/auth/users.ts (getMe, methodEmail, refreshMethodEmail), migration 0012; In the app: src/components/accountLabels.ts (methodLine), src/account/methodRules.ts (isPrivateRelayAddress) · Source: docs/test-checklist.md › 19 Kasım'da bildirilenler; backend/DESIGN.md › Adding a method

- **`ACC-53`** When the phone can't save the session after a sign-in or a refresh (the refresh token rotates at every refresh, and the server treats a spent one as stolen and ends the whole session), Qutai tries three times, keeps the new tokens working in memory, saves them again before every later request, and tells the user once: "Qutai couldn't save your sign-in on this phone. If Qutai restarts before it can, you'll need to sign in again." The old token can't be kept usable: the server has already spent it. A profile-only save that fails is retried the same way without a message (the stored tokens stay valid). A sign-out the phone can't remove from its storage is tried three times, then the user is told that after a restart they may still appear signed in and should sign out again. Before 20 Nov 2026 both failures were ignored.
  Status: Default (implementing session; owner's 20 Nov 2026 code-review request) · Why: a swallowed failure meant a silent sign-out at the next start, and presenting the spent token could end the session on the server · Enforced: In the app: src/account/session.ts (persist, retryStorage, clearStored), src/account/index.ts (the message through storage/failures.ts) · Tests: scripts/account-tests/session.test.ts · Source: 20 Nov 2026 code review
- **`ACC-54`** One store-review account can sign in by email with a fixed code: while the server setting "Fixed sign-in code for a review account" (`review_login`) is on, a sign-in for exactly its address (normalised like every sign-in) takes its six-digit code instead of a random one (owner's account `test@sonsuzdongu.com`, code `000000`). Everything else about the code is unchanged (10 minutes, 5 tries, the asking phone only, the per-address limits, the mail still sent). Off by default; on needs an address and a code; malformed means off; only for signing in, never for adding the address as a method of another account; the code is never logged; the admin Overview shows a red banner while it is on.
  Status: Owner, 2026-11-21 ("bizde, email ile bir OTP üretiliyor. bunu test@sonsuzdongu.com kullanıcısı için her zaman 000000 yapar mısın"); the switch, the sign-in-only rule and the banner are the implementing session's defaults · Why: App Store and Google Play reviewers can't read the sign-in mail; anyone who knows the address and code can sign in as that account, so it stays off outside a review and the account holds no real credits or data · Enforced: Server: backend/packages/shared/src/settingsSchema.ts (checkReviewLogin, readReviewLogin), backend/apps/api/src/auth/email/challenges.ts (reviewLoginCode, createChallenge); panel: backend/apps/admin/src/settingForms.tsx (ReviewLoginEditor), screens/Overview.tsx · Tests: backend/apps/api/test/review-login.test.ts, backend/apps/admin/test/review-login.test.ts · Source: backend/README.md › Sign-in by email › Fixed code for a review account; backend/DEPLOY-prod.md › Mağaza incelemesi için sabit giriş kodu

## Details

**Sign-in mechanics**

- (was `ACC-9`) Every Apple or Google sign-in uses a fresh nonce (its SHA-256 goes to Apple or Google, the raw value to Qutai's server), required for both and accepted once. Why: a replayed or retried token is refused ("nonce_reused"). Where: Server: auth_nonces table, backend/apps/api/src/auth/providers.ts; In the app: src/account/nonce.ts; backend/README.md › Auth; notes backend-step2-auth.
- (was `ACC-12`) Google sign-in uses Credential Manager in the app's own module on Android and the system sign-in browser with PKCE on iPhone; never an embedded web view. Why: the old Google Sign-In SDK is deprecated; the free React Native module can't pass a nonce on Android; another candidate supports only older React Native; a newer Google library didn't build with the app's Kotlin. Where: In the app: src/account/providers.ts; modules/qutai-auth; README.md › Accounts (pro mode); notes step8-app-accounts.
- (was `ACC-16`) A random device id per install identifies the phone's session; there is no separate list of devices. Where: In the app: src/account/storage.ts; Server: backend/apps/api/src/routes/auth.ts (DEVICE_ID); backend/DESIGN.md › API Worker.
- (was `ACC-21`) While waiting for a code the app keeps the address (never the code or link) in memory and secure storage, and forgets it on success, "Use another address", another way of signing in, or after 10 minutes. Why: the code and link still work after the system closed the app while the user read the mail. Where: In the app: src/account/emailSignIn.ts; README.md › Sign-in by email; notes email-sign-in-app.

**Combining accounts**

- (was `ACC-38`) A combine waits while the other account has a task running and can be resumed; the daily job finishes combines left running over 10 minutes. Why: credits move only through two keyed entries, so a crash can't lose or double them. Where: Server: backend/apps/api/src/account/merge.ts (resumeMerge, resumeStaleMerges); backend/DESIGN.md › Crash between steps.

**Sign-in links**

- (was `ACC-44`) The https sign-in link opens Qutai directly (an App Link on Android, a Universal Link on iPhone) only in builds made with `EXPO_PUBLIC_APP_LINK_HOST`; the website page stays the fallback. Why: phones without the app and failed verification still need the page. Where: docs/app-links.md; plugins/withProAccounts.js.

## Why it is designed this way

Joining accounts by address is convenient but is also the way an account can be taken over, so only addresses that
someone authoritative has proved may join (ACC-2 to ACC-7). The main threat the account screens guard against is
someone holding an unlocked phone: they can already act as the user, so adding a method is not re-checked, but
removing one needs a recent sign-in with an older method, so an intruder's new method can never push out the owner
(ACC-28, ACC-30). Details and the full threat tables: [backend/DESIGN.md](../../backend/DESIGN.md) › Sign-in by email and
› Account methods: add, remove, merge.

## Limits and what is not built

- Not verified with real Apple tokens or the iPhone Google redirect. Google on Android worked in a Play internal-test
  build on 17 Nov 2026 after every app-signing certificate was registered ([docs/google-sign-in.md](../../docs/google-sign-in.md) §7).
- Not checked: Gmail or Chrome on a phone handing the link to the app; iPhone; iPhone offering the code from Mail.
  App Links / Universal Links need the owner's site files and a native rebuild (planned, [docs/app-links.md](../../docs/app-links.md)).
- Apple's server notifications (consent withdrawn, account deleted at Apple) and Google's Cross-Account Protection are
  not handled (planned).
- No notice mail when an existing method signs in on a new phone (open in the threat model).
- Someone who loses their oldest method needs support to remove it.
- Phone ids are chosen by the app: someone who steals both the link and the phone's id could use the link.
- Addresses with non-ASCII names before the @ are refused for now; a global mail cap against botnets is a later setting.
- Mailjet before production: keys on the deployed server, bounce handling, plan limits, a stricter mail policy later.

## Where it lives

- App: `src/account/` (`session.ts`, `storage.ts`, `providers.ts`, `nonce.ts`, `emailSignIn.ts`, `appleWeb.ts`,
  `methodRules.ts`, `errorDetails.ts`), `src/components/AccountScreen.tsx`, `AccountMethods.tsx`, `SignInOptions.tsx`,
  `EmailSignIn.tsx`, `AccountLinks.tsx`, `modules/qutai-auth`, `plugins/withProAccounts.js`.
- Server: `backend/apps/api/src/auth/`, `backend/apps/api/src/routes/` (`auth.ts`, `email.ts`, `methods.ts`,
  `merge.ts`, `appleWeb.ts`, `account.ts`), `backend/apps/api/src/account/merge.ts`.
- Read next: [README.md](../../README.md) › Accounts (pro mode); [backend/README.md](../../backend/README.md) › Auth;
  [backend/DESIGN.md](../../backend/DESIGN.md) › Sign-in by email, › Account methods: add, remove, merge;
  [docs/google-sign-in.md](../../docs/google-sign-in.md), [docs/apple-sign-in.md](../../docs/apple-sign-in.md),
  [docs/app-links.md](../../docs/app-links.md).

## Disagreements between sources

- README.md › Sign-in methods and combining accounts, and TODO.md › Accounts and OAuth sign-in, still list adding and removing methods, merging accounts, App Links and the eight extra mail languages as not built; they were built on 17 Nov 2026 (b91825e, 1c50bc1, 233f602). The code follows the built version.
- backend/README.md › Owner decisions › Sender still lists sender validation and SPF/DKIM as to do; the Mailjet session note says SPF, DKIM and DMARC passed on 17 Nov 2026.
- backend/README.md › What to set up at Apple and Google says Apple's web flow on Android is "not built yet"; backend/README.md › Sign in with Apple on Android and the code say it is built.
