# 31. Onboarding and the voice introduction

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The first-launch setup, and "Tell me about yourself": the user talks freely and Qutai turns it into memory notes the user checks before anything is saved.

## How it works

1. **Setup steps, in order:** welcome → privacy policy and terms (must be accepted) → AI (provider and key; in official builds Qutai Credits first) → "What Qutai may use" (phone permissions) → "Let me get to know you a little" (only while memory is on) → keep working in the background (Android builds that support it) → protection against ads and trackers → make Qutai the default browser. Steps blur out and back in.
2. **"What Qutai may use".** Microphone (on iOS also speech recognition), contacts (since 19 Nov 2026, `CON-11`), location, calendar, Reminders (iOS) and notifications. Each row says what it is for and has a switch; the system is asked only when the user turns a switch on, then the real state shows (allowed, iOS "default calendar only", not allowed, not allowed for good with Open settings). Every row is optional; turning an allowed one off opens the phone's settings. There is no camera row.
3. **Calendar choice.** With two or more calendars, the user picks which one the assistant writes to (and on iOS which Reminders list), or "Automatic". Also in Settings › Assistant › "Calendar for the assistant".
4. **"Tell me about yourself"** (first page of the get-to-know-you step, and Settings › Assistant › Memory › "Introduce yourself"). Example: the user taps the microphone and says "I'm Ayşe, I live in Kadıköy, I'm allergic to peanuts and I prefer short answers." Ways out: "I'd rather type", "Answer questions instead" (the typed questions), "Not now". A privacy note sits right under the microphone.
5. The words appear as a transcript the user can edit, speak more to, or start over.
6. One request to the user's AI turns the transcript into notes. Qutai then asks at most three fixed follow-up questions about what was not mentioned (food, name, shopping and delivery, city, answer style), answered by voice, typing, a chip ("Vegetarian", "Cash on delivery") or Skip.
7. **Review:** "Here's what I understood", one row per note, each editable and deletable; age, gender, allergies and health conditions have a "Hide from the AI" switch. Nothing is saved before Save.
8. If there is no AI, the request fails or the answer makes no sense, Qutai says so in one sentence and continues with the typed questions, showing the transcript to copy.
9. **City question:** "Use my location" fills neighbourhood, district, province or state and country, editable.
10. **After setup** a one-time tour dims the browser around the Qutai button: tap opens the assistant, hold talks. Settings › Assistant › "Show the Qutai button tour" shows it again.
11. **Official (pro) builds:** the AI step leads with Qutai Credits: a disclosure of what passes through Qutai's server → sign in → "You're signed in" with the balance and Buy credits. "Use my own AI provider key" is a separate quieter card; "Decide later" skips. Declining, cancelling or a failed sign-in return to the choice with a note.

## The rules

- **`INTRO-1`** Setup order is welcome, legal, AI, permissions, get-to-know-you (only with memory on), background (only where supported), protection, default browser.
  Status: Default (manager or implementing session; open to change) · Why: the get-to-know-you questions only fill memory, so without memory they are left out · Source: src/components/Onboarding.tsx (ALL_STEPS)
- **`INTRO-2`** The privacy policy and terms must be accepted to continue; a new legal version asks everyone again.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/legal/documents.ts (LEGAL_VERSION) · Source: ROADMAP.md › Phase 3.5
- **`INTRO-3`** The permissions step asks the system only when the user turns a switch on; every row is optional; there is no camera row; the usual in-context requests stay.
  Status: Default (manager or implementing session; open to change) · Why: from the owner's Android test (November 2026) · Enforced: In the app: src/components/PermissionsStep.tsx, src/device/permissionStatus.ts · Source: bb8a50b; TODO.md › Assistant › Onboarding
- **`INTRO-4`** The microphone row asks exactly what voice input asks on first use (microphone, and on iOS speech recognition); the question about the phone's online speech service stays separate.
  Status: Default (manager or implementing session; open to change) · Why: so the panel's microphone asks nothing more later · Enforced: In the app: src/device/voiceInput.ts (requestVoicePermissions) · Source: 146c258; TODO.md › Onboarding
- **`INTRO-5`** The chosen calendar is stored only on the phone (not in backups); a calendar that is gone falls back to the default and the assistant is told to say so.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/device/calendarChoice.ts · Source: bb8a50b
- **`INTRO-6`** "Use my location" sends the position to the platform's place-name service (Apple's on iOS, usually Google's on Android) and says so in a sentence; it gives up after 30 s.
  Status: Default (manager or implementing session; open to change) · Why: the position leaves the phone, so the user is told · Enforced: In the app: src/device/location.ts (readPlaceName) · Source: bb8a50b; TODO.md › Other (privacy policy, What leaves your phone)
- **`INTRO-8`** The Qutai button tour shows once after setup (existing installs once too), waits while the panel, Settings, the tab switcher or the lock is in front, and has no pulse with Reduce motion.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: bb8a50b; README › Running
- **`INTRO-9`** The introduction uses one request with its own short prompt and no tools, recorded in "What was sent to the AI" as `memory:introduce`; a second request only when a follow-up is answered in words.
  Status: Default (manager or implementing session; open to change) · Why: keep the cost small (about 450 tokens in and 400 out with an own key) · Enforced: In the app: src/intro/request.ts · Source: docs/voice-introduction.md › The extraction request; 2e86c84
- **`INTRO-10`** The AI's answer is checked, not trusted: every note needs the user's own words, which must be found in the transcript; unknown topics or keys are dropped; at most 20 items; values 1–120 characters; age a whole number 1–120; a gender must be stated by more than the name; anything memory refuses (passwords, card, bank or ID numbers) is dropped.
  Status: Default (manager or implementing session; open to change) · Why: refuses inferred values: "the model has to point at the words, and Qutai checks them" · Enforced: In the app: src/intro/extract.ts (parseExtraction) and src/agent/memory.ts (sensitiveReason) · Source: docs/voice-introduction.md › Validation and normalisation
- **`INTRO-11`** Age and gender are never asked; they are saved only when the user volunteers them.
  Status: Owner, 2026-11-17 · Why: reason not recorded · Enforced: In the app: src/intro/followUps.ts · Source: docs/voice-introduction.md › Follow-up rules
- **`INTRO-12`** At most three fixed, translated follow-up questions, chosen by code in the order food, name, shopping, city, answer style, and only for topics with no note that the user didn't decline or say don't apply.
  Status: Default (manager or implementing session; open to change) · Why: the model only understands answers; it never chooses questions · Source: docs/voice-introduction.md › Follow-up rules
- **`INTRO-14`** Nothing is saved before Save on the review page; age, gender, allergy and health rows can be hidden from the AI, and a hidden note is saved under a label in the interface language that never contains the value.
  Status: Default (manager or implementing session; open to change) · Why: the user confirms every note; hidden values never reach the AI by value · Enforced: In the app: src/intro/items.ts (introWrites, hiddenLabelProblem) · Source: docs/voice-introduction.md › Mapping; 63793f0
- **`INTRO-16`** The privacy note sits right under the microphone and says: speech is turned into text on the phone or by Apple's or Google's service after asking; Qutai stores or sends no audio; the text goes to the AI provider (or Qutai's AI service with credits) once, and once more for follow-ups; confirmed notes stay only on the phone.
  Status: Default (manager or implementing session; open to change) · Why: it must be read before the microphone is used (it was out of view below the topics) · Source: docs/voice-introduction.md › Privacy text; 63793f0
- **`INTRO-17`** The get-to-know-you step runs only with memory on; "Introduce yourself" on the Memory screen is offered only while no incognito tab is open.
  Status: Default (manager or implementing session; open to change) · Why: the notes only go into memory · Enforced: In the app: src/components/Onboarding.tsx (step filter) · Source: docs/voice-introduction.md › Privacy text
- **`INTRO-18`** Today, with Qutai Credits, the introduction's instructions travel at the start of the user's message, adding the assistant's ~13,500-token prompt and tools to each request; "Organise for me" loses its instructions entirely.
  Status: Waiting for the owner ([docs/voice-introduction.md](../../docs/voice-introduction.md#cost-npm-run-measureintro)) · Why: the server's relay serves only the registered agent profile and never receives the app's own system prompt; a server "side request" profile would fix both, which is server work and an owner decision · Enforced: Server: backend/apps/api/src/relay/relay.ts (profile prompt and tools) · Source: docs/voice-introduction.md › Cost
- **`INTRO-19`** In official builds setup leads with Qutai Credits; Qutai Credits is saved only from the signed-in account screen, never without an account; the open-source build never shows sign-in.
  Status: Default (manager or implementing session; open to change) · Why: credits need an account · Enforced: In the app: src/credits/setupFlow.ts (providerToSave) · Source: README › Setup in pro mode; 0d0c889
- **`INTRO-20`** Today own-key users get no sign-in step in setup.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#accounts-and-oauth-sign-in)) · Why: reason not recorded · Source: TODO.md › Pro mode › Accounts and OAuth sign-in
- **`INTRO-21`** Today the welcome and legal summary say "Private by design" / "we have no servers"; these must be rewritten together with the privacy policy (and a legal version bump) before the server goes live.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#5-legal)) · Why: true for own keys, not once requests can go through Qutai's server · Source: TODO.md › Qutai Credits › 5. Legal
- **`INTRO-23`** An official-build step asking for anonymous usage data is planned, not built.
  Status: Default (manager or implementing session; open to change) · Why: analytics only with consent · Enforced: Designed, not built · Source: TODO.md › Analytics, with consent
- **`INTRO-24`** The welcome and legal screens use smaller type than the later steps (tagline and bullets 14–15 pt, feature text 13 pt), tighter still on screens under 760 dp tall and in landscape (the logo then sits beside the name). Their text grows with the system's text size up to 1.4× and the screen scrolls past that (the scroll bar flashes when there is more); the "I have read and accept" checkbox sits with the Accept button, pinned at the bottom, and the button grows instead of clipping a wrapped label.
  Status: Owner, 2026-11-19 · Why: on the owner's phone the text of both screens did not fit; the legal summary runs to 600–730 characters in the longer languages, and the checkbox that enables Accept had scrolled out of view · Enforced: In the app: src/components/Onboarding.tsx (FIT_FONT_SCALE, compact styles), src/ui/BrandGradient.tsx (GradientButton) · Source: docs/test-checklist.md › 19 Kasım'da bildirilenler

## Details

**Setup fields**

- (was `INTRO-7`) A setup field accepts text only while it is the focused field. · Why: Android autofill and iOS contact AutoFill fill a whole dataset (picking an email replaced the phone number) · Where: TODO.md › Onboarding

**Introduction notes**

- (was `INTRO-13`) A chip answer becomes a note directly; spoken or typed answers go in one more request, and if that fails they are kept as the user said them ("Food: …"). · Why: nothing the user said is invented or lost · Where: docs/voice-introduction.md
- (was `INTRO-15`) Name, city, age, gender and payment replace the earlier note of their kind; allergies, health, shopping and other notes add up. · Why: running the introduction again added a second "Preferred name" · Where: 3abca8e; src/intro/items.ts (withReplacements)

**App structure**

- (was `INTRO-22`) The screen-safe-area provider sits at the root of the app, above setup. · Why: picking Qutai in setup crashed the app ("No safe area value available") because the disclosure dialog had no provider above it · Where: 4859367; scripts/credits-tests/safe-area-root.test.ts

## Limits and what is not built

- Not verified on a device: real speech in the introduction, Android, TalkBack and VoiceOver, the largest text, dark mode, landscape, the setup entry and credits mode ([docs/test-checklist.md](../../docs/test-checklist.md) § 14).
- Android location: after Google's "Location Accuracy" dialog is dismissed the read can time out (open in TODO).
- O1: on the iOS simulator in Turkish the onboarding email field did not take focus (most likely the simulator).
- Usage-data consent step (planned).

## Where it lives

- `src/components/Onboarding.tsx`, `PermissionsStep.tsx`, `CalendarChoiceScreen.tsx`, `ProfileStep.tsx`, `VoiceIntro.tsx`, `ProfileQuestions.tsx`, `AssistantIntro.tsx`, `QutaiSetup.tsx`
- `src/intro/` (extract, followUps, items, flow, request); `src/device/permissionStatus.ts`, `calendarChoice.ts`
- [docs/voice-introduction.md](../../docs/voice-introduction.md); tests `npm run test:intro`, cost `npm run measure:intro`

## Disagreements between sources

- docs/voice-introduction.md calls the credits-mode handling (INTRO-18) an owner decision, but TODO.md's "Decisions waiting for the owner" does not list it.
