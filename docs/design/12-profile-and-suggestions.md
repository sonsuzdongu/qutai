# 12. Personal profile, custom instructions and page suggestions

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

How Qutai gets to know the user (the voice introduction and the setup questions), the user's standing instructions
for the assistant, and the suggestions the empty assistant panel shows for the page on screen.

## How it works

1. **"Let me get to know you a little"** is an optional setup step (only with memory on), also reached later from
   Settings › Assistant › Memory ("Introduce yourself", "Answer a few questions").
2. **Voice introduction.** The first page asks "Tell me about yourself". The user talks freely (or types), edits the
   transcript, and one request to their AI turns it into notes. Qutai then asks at most three fixed follow-up
   questions (food, the name, shopping, the city, answer style), answered by voice, typing, chips or Skip. A review
   page lists every note, editable and deletable; age, gender, allergies and health can be hidden from the AI. Nothing
   is saved before the user confirms. Without an AI, or if the request fails, it says so and offers the typed questions.
3. **Typed questions** (no AI request): what to call the user, city (typed or "Use my location"), how they pay and
   receive deliveries, food, answer style; then "Fill in address and contact details now?" and one form.
4. **Answer style** ("short and to the point" / "detailed") is written as a line in the custom instructions.
5. **Custom instructions** (Settings › Assistant, under the memory switch): up to 500 characters, with tappable
   examples ("Answer briefly", "Prefer metric units"). They go with every request, after the safety rules.
6. **Page suggestions.** The empty panel offers 3 to 5 things that fit the page: "Is this a good buy?" and "Find it
   cheaper" on a product, the ingredients of a recipe, "Help me fill this in" on a form, "Which result fits best?" on
   search results, "Save this table as CSV"; general examples on the new tab page. Nothing is sent until one is tapped.

## The rules

- **`PROF-1`** The voice introduction's answer is checked, not trusted: each value must come with the user's own words found in the transcript, so an inferred age, gender or diet is refused; values up to 120 characters, quotes up to 200, at most 20 items, transcript up to 8,000 characters; each value also passes the memory's refusal check.
  Status: Default (manager or implementing session; open to change) · Why: the AI must not invent facts about the user · Enforced: In the app: src/intro/extract.ts (MAX_VALUE_CHARS, MAX_ITEMS, sensitiveReason check) · Source: 2e86c84; docs/voice-introduction.md
- **`PROF-2`** Follow-up questions are fixed and translated, chosen by code, at most 3, from food, name, shopping, city and answer style in that order; age and gender are never asked (kept only when the user says them).
  Status: Owner, date not recorded (docs/voice-introduction.md: "an owner decision") · Why: reason not recorded · Source: src/intro/followUps.ts (MAX_FOLLOW_UPS); docs/voice-introduction.md › Follow-up rules
- **`PROF-3`** Nothing from the introduction is saved before the review page; age, gender, allergy and health rows have a "hide from the AI" switch, and a hidden row's label never contains the value.
  Status: Default (manager or implementing session; open to change) · Why: the user confirms every fact · Enforced: In the app: src/intro/items.ts; src/agent/memory.ts (hiddenLabelProblem) · Source: docs/voice-introduction.md › Mapping
- **`PROF-5`** The introduction tells the user before the microphone: no audio is stored or sent by Qutai; the text goes to their AI provider once (twice with follow-ups); confirmed notes stay only on this phone.
  Status: Default (manager or implementing session; open to change) · Why: the user must know before speaking · Source: docs/voice-introduction.md › Privacy text
- **`PROF-6`** Without an AI, or when the request or its answer fails, the introduction says so and continues with the typed questions, showing the transcript; a failed follow-up round keeps the answers as the user said them.
  Status: Default (manager or implementing session; open to change) · Why: "nothing they said is invented or lost" · Source: docs/voice-introduction.md › Failure paths
- **`PROF-7`** The typed questions make no AI request; their privacy text says "your AI provider" (no provider name) and says "nothing goes to Qutai" only when pro mode is off.
  Status: Default (manager or implementing session; open to change) · Why: the text must be true for every provider and build · Source: src/components/ProfileQuestions.tsx; d1c677e; TODO.md › Assistant
- **`PROF-8`** The answer-style question writes one custom-instruction line, replaced if answered again; it is not a memory.
  Status: Default (manager or implementing session; open to change) · Why: "it is a standing instruction about replies, not a fact about the user" · Source: TODO.md › Assistant (custom instructions); item 29 hand-over note
- **`PROF-9`** Custom instructions: at most 500 characters, blank-line runs shortened; added last to every request, between `<<<` and `>>>` (those characters removed from the text), sent with memory on or off.
  Status: Default (manager or implementing session; open to change) · Why: placed last so everything it could conflict with comes before it · Enforced: In the app: src/agent/systemPrompt.ts (MAX_CUSTOM_INSTRUCTIONS, cleanCustomInstructions, customInstructionsPrompt); src/agent/runAgent.ts (systemPrompt) · Source: 849029b
- **`PROF-10`** Custom instructions never override the safety, confirmation, memory and personal-information rules; on a conflict the assistant follows those and says it can't do that part.
  Status: Default (manager or implementing session; open to change) · Why: "They are the user's own preferences, but lower in precedence than the safety rules" · Enforced: Prompt only: src/agent/systemPrompt.ts (customInstructionsPrompt); the app's own checks (approvals, personal gate) still apply · Source: 849029b
- **`PROF-11`** The old example line "Always reply in Turkish" / "Her zaman Türkçe yanıt ver" is removed once, only when it is an exact line of its own, on launch and when a backup from before the removal is restored; replies follow the language the user writes in.
  Status: Owner, 2026-11-16 (removed only on exact match) · Why: the example was retired; the user's own wording must stay · Source: src/agent/retiredInstructions.ts; ab94093
- **`PROF-12`** Custom instructions can be written only by the user, never by the assistant.
  Status: Default (manager or implementing session; open to change) · Why: "they steer the assistant in every conversation, so only the user writes them" · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE) · Source: febcdb4
- **`PROF-13`** The Turkish interface addresses the user as "siz"; texts the user sends to the assistant (suggestion prompts, instruction examples, answer-style lines) keep their wording; the assistant uses the formal address where a language has one.
  Status: Owner, 2026-11-16 ("siz") · Why: the owner's choice · Source: memory note "Turkish UI uses siz"; 9cea977; 20ac063
- **`PROF-14`** Page suggestions are picked on the phone from a few flags in the page's markup (structured data, forms, video, tables, PDF, payment fields, phone, address, page length), never from its text, with no AI request; nothing is sent or logged until one is tapped, and then it is sent like a typed message.
  Status: Default (manager or implementing session; open to change) · Why: no cost and nothing leaves the phone for a suggestion · Enforced: In the app: src/agent/pageSuggestions.ts (pageSuggestions); src/browser/pageScript.ts (pageSignals) · Source: e19a721
- **`PROF-15`** Three to five suggestions are shown; without a fitting page they fall back to Summarize / What can I do here? / Key points, or to general examples.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/agent/pageSuggestions.ts (MAX, MIN)
- **`PROF-16`** A blocked site gets no page suggestions (general examples instead), a read-only site no form filling, and incognito tabs nothing that needs the location or the calendar.
  Status: Default (manager or implementing session; open to change) · Why: suggestions must not offer what the site level or incognito forbids · Enforced: In the app: src/agent/pageSuggestions.ts · Source: README intro; TODO.md › Assistant

## Details

- (was `PROF-4`) Name, city, age, gender and payment keep one note each (a new one replaces the earlier note of its kind); allergies, health, shopping and other notes add up. Where: docs/voice-introduction.md › Mapping.
- (was `PROF-17`) Quick chips under the conversation leave out what a suggestion already offers. Why: avoid showing the same thing twice. Where: page-suggestions hand-over note.

## Limits and what is not built

- The introduction is not offered from the Memory screen while an incognito tab is open.
- Native-speaker review of the questions in Turkish "siz" and in the eight newer languages is pending (TODO.md).
- Page suggestions have not been tried on a phone.

## Where it lives

- `src/components/ProfileStep.tsx`, `VoiceIntro.tsx`, `ProfileQuestions.tsx`; `src/intro/` (extract.ts, followUps.ts, items.ts, flow.ts, request.ts)
- `src/agent/systemPrompt.ts`, `src/agent/retiredInstructions.ts`
- `src/agent/pageSuggestions.ts`, `src/browser/pageKind.ts`, `src/browser/pageScript.ts` (pageSignals)
- [docs/voice-introduction.md](../../docs/voice-introduction.md); [section 31](31-onboarding.md) (onboarding); TODO.md › Assistant
