# Voice introduction ("Tell me about yourself")

The first page of setup's "Let me get to know you a little" step, and of Settings › Assistant › Memory › "Introduce
yourself". The user talks (or types) freely about themselves; one AI request turns that into memory items; Qutai asks
at most three fixed follow-up questions about important things not mentioned; the user reviews every item; nothing is
saved before they confirm. The typed questions (`ProfileQuestions`) stay as the alternative and as the way out of every
failure.

Code: pure logic in `src/intro/` (`extract.ts`, `followUps.ts`, `items.ts`, `flow.ts`), the request in
`src/intro/request.ts`, the screens in `src/components/VoiceIntro.tsx`, the step around both in
`src/components/ProfileStep.tsx`. Tests: `npm run test:intro` (`scripts/intro-tests/`).

## Screens and states

The flow is one reducer (`src/intro/flow.ts`); the screen shows the phase.

| Phase | Shows | Ways on |
| --- | --- | --- |
| `choose` (first page, since 19 Nov 2026) | Title, "How would you like to tell me?", three choices: "I want to say it by speaking", "I want to type", "Ask me questions", and a one-line privacy note (what is said or typed goes to the AI provider, or Qutai's AI service with credits; nothing is saved before it is checked). Without an AI: a note and only "Ask me questions" | Speaking → `intro`; typing → `transcript` (keyboard); "Ask me questions" → `followUp 0` with all five questions; "Not now" → step done. Nothing here touches the microphone |
| `intro` | Title, a large microphone button ("Tap and tell me about yourself"), what is worth mentioning (what to call you; your city; age and gender only if you want; food: diet, allergies or a health condition that affects what you eat; shopping and delivery; how you like answers), the privacy note | Microphone → `listening` (the permission is asked here, on that tap); "I'd rather type" → `transcript` (keyboard); "Not now" → step done; back → `choose` |
| `listening` | The live transcript growing, a stop button, the listening language | Stop / the recogniser ends / app backgrounded / a dialog → `transcript` with the words heard (nothing heard → `intro` with "Didn't hear anything") |
| `transcript` | The transcript in an editable field; "Continue", "Speak more" (appends), "Start over" (an empty field, or the microphone page, the way it was started) | Continue → `understanding` (no AI → `failed: noAi`); back → `intro` after speaking, `choose` after typing |
| `understanding` (round 1 or 2) | A spinner, "Understanding what you said…", Cancel | Answer valid → follow-ups or `review`; invalid / error → `failed`; Cancel → `transcript` |
| `followUp n` | A chat: Qutai's question bubbles, the user's answers; under the current question: suggested chips, a text field with a microphone, "Skip"; a speaker toggle (off by default) reads questions aloud | Answer or Skip → next question, then round 2 (only when an answer was free text) or `review`; back → previous question, or `transcript` (`choose` when asked) |
| `review` | "Here's what I understood": one row per item (category icon, the text as it will be saved, edit, delete; for age, gender, allergy and health a "Hide from the AI" switch); the answer-style line for custom instructions | "Save" → `saving` → `saved`; back → last question or `transcript` |
| `saved` | How many were saved, and where to change them | Done → step done |
| `failed` | What went wrong in one plain sentence, the transcript (selectable, so it can be copied) | "Continue with questions" → typed questions with the transcript shown above them; "Try again" (request errors only) → `understanding` |

**"Ask me questions"** (owner's request of 19 Nov 2026; the details were left open, this is the default built): the same
`followUp` pages, but all five fixed questions in conversation order: what to call you, your city, food (diet,
allergies), shopping and delivery, how you like answers (`askMeQuestions` in `src/intro/followUps.ts`). They are
translated text on the screen, read aloud only with the speaker toggle; each is answered with a chip, by typing, or with
the small microphone (asking for the microphone permission on that tap), or skipped. No AI is needed to ask them. Free-
text answers then go through the same round-2 request as follow-up answers (`answersTurn`), and everything ends on the
same review page and is saved the same way (memory notes, the answer-style line in custom instructions). Without an AI
(or if round 2 fails) the typed and spoken answers are listed as given, one row per question's main topic, with a
notice; chips need no request. Back from the first question returns to the choices. Asked cold, the food question uses
the typed questions' wording ("Any food preferences or restrictions?", `profile.foodTitle`) instead of the follow-up's
"You didn't mention food…". Each new question scrolls the page to its end, so the current question stays in view
under the earlier ones.

App backgrounded while listening: voice input already stops the microphone (`device/voiceInput.ts`); the session's
`onEnd` arrives as interrupted and the flow keeps what was heard (`transcript`). Back from `listening` stops first.

## The extraction request

One request, a separate small system prompt (not the assistant's; `npm run profile:check` unchanged), no tools, recorded
in "What was sent to the AI" as conversation `memory:introduce`. The user turn is the transcript (round 1) or the
follow-up answers, each with its topic (round 2). The prompt asks for values in the interface language, names, brands
and addresses kept as said.

Qutai Credits: the relay only serves the registered agent profile (its system prompt and tools replace the app's
`system`), so in credits mode the same instructions travel at the start of the user turn instead; see "Cost" for what
that costs and the owner question it leaves.

Answer schema (JSON only; `src/intro/extract.ts` `parseExtraction`):

```json
{
  "items": [
    { "topic": "allergy", "value": "peanuts", "quote": "I'm allergic to peanuts", "stated": true }
  ],
  "none": ["health"],
  "declined": ["age"]
}
```

- `topic`: `name` | `city` | `age` | `gender` | `diet` | `allergy` | `health` | `payment` | `delivery` | `shopping` |
  `style` | `other`.
- `value`: string, 1–120 characters after trimming. `choice` (optional): `payment` `cod` | `card`; `style` `short` |
  `detailed`; no other topic may carry one.
- `quote`: the user's own words that say it, ≤ 200 characters; `stated`: `true` only when the user said it.
- `none`: topics the user said do not apply ("no allergies"); `declined`: topics they would rather not share.

Validation and normalisation (anything else is dropped; a reply that is not such an object fails the round):

- The first JSON object in the reply is read (a ```json fence is allowed); at most 20 items are looked at.
- An item with an unknown key, a wrong type, an unknown topic, an empty value or a `choice` its topic cannot take is
  dropped. Values and quotes are cut at their limits, whitespace collapsed.
- `stated` must be `true`, and the quote must occur in the text sent (case, punctuation and spacing ignored; Turkish
  İ/ı folded). This is how an inferred value is refused: the model has to point at the words, and Qutai checks them.
- Age: a whole number 1–120. Gender: the quote must be more than the name (never a gender guessed from a name).
- Values that memory would refuse (passwords, card or bank numbers, ID numbers; `agent/memory.ts sensitiveReason`)
  are dropped.
- Duplicates (same topic and value, ignoring case) are dropped; `name`, `city`, `age`, `gender`, `payment` and `style`
  keep their first item only.
- `none` / `declined`: only known topics, duplicates removed.

## Follow-up rules (`src/intro/followUps.ts`)

Fixed, translated questions chosen by code; the model only understands answers. At most three, in this order, each
only when its topic group has no item and was neither said not to apply nor declined:

1. food (diet, allergy, health) — "You didn't mention food. Any allergies, a diet, or things you don't eat?" Chips:
   No allergies, Vegetarian, Vegan, Halal, Gluten-free, Lactose-free, Nut allergy.
2. name — "What should I call you?" (no chips)
3. shopping (payment, delivery, shopping) — "How do you like to pay and receive deliveries?" Chips: Cash on delivery,
   Card, Don't ring the doorbell, Call before you come, Leave it at the door.
4. city — "Which city do you live in?" (no chips)
5. style — "Do you prefer short answers or detailed ones?" Chips: Short and to the point, Detailed.

Age and gender are never asked (only saved when volunteered; an owner decision, see the report). A chip answer becomes
an item directly (its label as the value, no request); "No allergies" marks the topic as not applying. Free-text or
spoken answers are sent together in one round-2 request after the last question, with the topic of each; if that fails,
each such answer is kept as the user said it, as one row of its topic ("Food: …"), so nothing they said is invented or
lost.

## Mapping to memory and custom instructions (`src/intro/items.ts`)

Saved with `addMemory`, in the same one-fact lines the typed questions write:

| Topic | Category | Text | Hide switch |
| --- | --- | --- | --- |
| name | identity | `profile.fact.name` "Preferred name: …" | |
| city | addresses | `profile.fact.city` "City: …" | |
| age | identity | `voiceIntro.fact.age` "Age: …" | yes |
| gender | identity | `voiceIntro.fact.gender` "Gender: …" | yes |
| diet | food | all diet items in one `profile.fact.food` "Food: a, b" | |
| allergy | food | one row each, `voiceIntro.fact.allergy` "Food allergy: …" | yes |
| health | food | one row each, `voiceIntro.fact.health` "Health condition that affects food: …" | yes |
| payment | shopping | `profile.fact.paymentCod` / `profile.fact.paymentCard`, else `voiceIntro.fact.payment` | |
| delivery | shopping | all in one `profile.fact.delivery` "Delivery note: a. b" | |
| shopping | shopping | one row each, `voiceIntro.fact.shopping` "Shopping: …" | |
| style | custom instructions | `profile.style.shortLine` / `detailedLine` (replaces the line set before, as the typed question does); no choice: dropped | |
| other | general | the value as said | |

Name, city, age, gender and payment take one note each: a row of one of these replaces the earlier note of its
kind (found by the start of its line, "Preferred name:", in the interface language; `withReplacements`), and the
review row says which ("Replaces “Preferred name: Sam”"; a hidden note only by its label). Saving updates that note
(a hidden one stays hidden) and deletes any further ones of the kind; deleting the row keeps them. Other kinds
(allergies, health, shopping notes, other) add up.

A hidden row is saved with a label in the interface language ("Age", "Food allergy", …) that never contains the value
(`hiddenLabelProblem`). A row memory refuses (full, sensitive) is reported after saving; the others are kept.

## Privacy text (intro page, before the microphone)

> Speech is turned into text on this phone, or by your phone's speech service (Apple's or Google's) when the phone
> can't do it itself; Qutai asks before that is used. No audio is stored or sent by Qutai. The text goes to your AI
> provider [credits: to Qutai's AI service] to be understood: once, and once more if you answer follow-up questions.
> What you confirm is stored only on this phone, as the assistant's memory. Everything is optional, and you can change
> or delete it in Settings › Assistant › Memory.

Without an AI set up, the page says so instead and offers the questions. Incognito: unchanged (the Memory screen offers
the step only while no incognito tab is open; voice input's own incognito rule still applies).

## Failure paths

| What | Said | Then |
| --- | --- | --- |
| No AI set up (skipped "Choose your AI") | "No AI is set up yet, so I can't understand free speech. The questions work without one." | Questions offered on the intro page |
| Microphone / speech recognition refused, unavailable, language missing | voice input's own messages | "I'd rather type" stays available |
| Nothing heard | "Didn't hear anything." | `intro` |
| Request failed (network, key, credits) | "I couldn't reach the AI: …" (the provider's plain error) | `failed`, Try again or questions |
| Reply not valid / nothing usable | "I couldn't make sense of the answer. Your words are below, so you can copy them." | `failed` → questions with the transcript shown |
| Round 2 failed | "I couldn't understand your answers, so they are listed as you said them." | `review` with verbatim rows |
| A row refused when saving | memory's own reason | the rest saved |

## Cost (`npm run measure:intro`)

Estimated with the project's token estimator (`scripts/token-tests/tokens.ts`, ±10–20 %) for an 84-word introduction
that yields 12 notes, and a round 2 with two short answers; list prices of `src/ai/prices.ts` (16 Nov 2026), no
caching.

| | Input tokens | Output tokens |
| --- | --- | --- |
| Round 1, own key (prompt ~320 + transcript) | ~445 | ~390 |
| Round 2, own key (only when a follow-up is answered in words) | ~350 | ~60 |
| Round 1, Qutai Credits (the relay adds the agent prompt and 49 core tools, ~13,500) | ~13,900 | ~390 |

| Model | Round 1 | Rounds 1 + 2 | Both rounds through the relay, same list price |
| --- | --- | --- | --- |
| Claude Haiku 5.5 | $0.0002 | $0.0003 | $0.0030 |
| Claude Sonnet 5.5 | $0.0048 | $0.0061 | $0.0601 |
| Claude Opus 5.5 | $0.0095 | $0.0122 | $0.1201 |
| GPT-5.6 Luna | $0.0006 | $0.0007 | $0.0061 |
| GPT-5.6 Terra | $0.0055 | $0.0070 | $0.0610 |
| GPT-6 Astra | $0.0238 | $0.0304 | $0.3003 |
| Gemini 3.8 Flash | $0.0018 | $0.0023 | $0.0225 |
| Gemini 4 Hydrogen | $0.0036 | $0.0046 | $0.0450 |
| Gemini 4 Carbon | $0.0048 | $0.0061 | $0.0601 |

Qutai Credits: the relay only serves the registered agent profile (`backend/apps/api/src/relay/relay.ts`: the system
prompt and tools come from the profile; the app's `system` is never sent, `src/credits/provider.ts`). So the
introduction's instructions travel in the user turn, and every such request also carries the agent's prompt and
tools: about ten times the tokens, less where the server's provider caches that prefix. The same holds for the Memory
screen's "Organise for me" (`src/agent/organiseMemory.ts`), which sends its instructions as `system` and so loses
them in credits mode. A server-registered "side request" profile (small system prompt, no tools) would fix both; that
is server work and an owner decision.

## Verified

- Server-free tests (`npm run test:intro`, 40): schema reading and every rejection rule, quote matching, follow-up
  choice, chip answers, review rows and what saving writes (hidden rows with their label), the whole reducer
  including back, cancel, skip, retry, round-2 failure, refused microphone and an interrupted session; the request
  with a stand-in provider in own-key and credits form; both rounds end to end through the real custom-endpoint
  adapter against `scripts/fake-ai/server.mjs`.
- iOS simulator (iPhone 17 Pro, iOS 27, a release build with this JavaScript bundle placed in it; no native rebuild
  needed), Settings › Assistant › Memory › "Introduce yourself", custom endpoint at the fake AI server:
  intro page (`docs/voice-introduction/1-intro.png`), typed introduction (`2-typed-introduction.png`), the follow-ups
  as a chat with a typed answer and a chip (`3-follow-up.png`), round 2, review (`4-review.png`), saving, and the
  hidden allergy on the Memory screen (`5-memory-hidden.png`); the answer-style line in Settings › Assistant › Custom
  instructions; the microphone up to the system's speech-recognition and microphone prompts, refused, ending in voice
  input's own message and back on the intro page. Requests at the fake server: two with an answered follow-up, one
  with chips and skips only.
- Not verified on a device: real speech (the simulator has no microphone input; the same code path was driven by
  typing), the read-aloud toggle, Android, TalkBack / VoiceOver, the largest text size, dark mode, landscape, the
  onboarding entry (same component; reached on the simulator only from Settings), and Qutai Credits mode against a
  server. They are in `docs/test-checklist.md` § 14.
