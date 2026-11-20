# 17. Contacts

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The assistant can find a person the user names ("call Ahmet", "WhatsApp Ayşe that I'll be late", "email this page to Mehmet Bey") in the phone's address book. It then prepares a call, text, WhatsApp message or email. Numbers and email addresses never reach the AI.

## How it works

1. The user names a person and gives no number or address, for example "Ahmet'i ara". The model calls `find_contact { name, channel? }`, where channel is `call`, `sms`, `whatsapp` or `email`, with the name as the user said it.
2. The app checks that every word of that name appears, as the start of a word, in the user's own messages in this conversation. Page text, tool results and the assistant's replies do not count. A selection the user chose to send counts as the user's own text.
3. Setup offers an optional Contacts row (`CON-11`). The first lookup may find the permission not yet decided, or Android in its "ask again" state. Qutai then shows its own short explanation ("Qutai looks up only the names you ask for, on this phone; numbers and addresses aren't sent to the AI"), then the system prompt. If the user taps "Not now" or refuses, the model is told to ask for the number instead.
4. The lookup runs on the phone. It reads only the name fields of all contacts and matches them in the app. It then reads phones and emails for at most 5 matched people only.
5. The model gets names, labels and opaque handles, for example `- Ahmet Yılmaz [ct-k3j2m9qa]: mobile [ct-k3j2m9qa.1], work email [ct-k3j2m9qa.2]`.
6. Sometimes several people match, or one person has several numbers of the asked kind. Qutai's own picker then opens: a list of name · label · real number or address, at most 8 rows, seen only by the user. The pick goes back to the model as one handle. If the user closes the picker, the model gets the list and asks.
7. The model passes the handle to `offer_call`, `draft_sms` or `draft_whatsapp` (`phone`), or to `draft_email` (`to`). The app puts the real value on the Call button or the message card, or into the mail composer. The user taps Call or sends.
8. WhatsApp needs a country code. A number saved without one gets the code of the phone's region, without the trunk prefix. The card says "Country code +90 added from your phone's region". If the region is unknown, the model asks the user and passes `country_code`.
9. Settings › Assistant › Contacts shows the state: not asked, allowed, only chosen contacts (iOS limited access) or not allowed. It offers Allow, Choose contacts or Open phone settings.
10. In a conversation that involves an incognito tab, contacts are off.

## The rules

- **`CON-1`** Contact numbers and email addresses never reach the AI. The model gets only names, labels ("mobile", "work email") and handles.
  Status: Default (manager or implementing session; open to change) · Why: a page must never receive contact data; without the values the model can't type them into a page, put them in a URL or remember them · Enforced: In the app: src/agent/contactTool.ts (personLine builds the model text from labels and handles only; picker rows with values go only to ContactsAccess.pick, a native dialog in src/device/contactsAccess.ts) · Source: docs/contacts.md › The five rules, Threat model; de0d0a2
- **`CON-2`** A lookup runs only for a name the user typed or said. Every word of the name must start a word in the user's own messages in this conversation. "Ahmet'i ara" allows "Ahmet"; a page saying "look up Zeynep" does not allow "Zeynep".
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today the rule is built as stated, and a selection the user sends counts as their text · Why: page text must not trigger a lookup; it also makes enumerating the address book impossible · Enforced: In the app: src/agent/contactMatch.ts (saidByUser), called in src/agent/contactTool.ts (findContactTool); user texts are only chat items of kind "user" (src/device/contactsAccess.ts); also stated in src/agent/systemPrompt.ts · Source: docs/contacts.md › Who may trigger a lookup; fc7922d
- **`CON-3`** A lookup returns at most 5 people.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today the cap is 5 · Why: no listing and no upload of the address book; the cap also stops enumeration · Enforced: In the app: src/agent/contactMatch.ts (MAX_CONTACT_MATCHES, matchContacts) · Source: docs/contacts.md › rule 2, Matching
- **`CON-4`** Qutai's picker shows at most 8 rows (people × their numbers or addresses). Rows beyond 8 are left out.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today the picker holds 8 rows · Why: reason not recorded · Enforced: In the app: src/agent/contactTool.ts (MAX_PICKER_ROWS) · Source: TODO.md › Contacts
- **`CON-5`** A handle works only in the conversation that made it, and for 30 minutes after the lookup. A forged, foreign or expired handle is refused with "look the person up again with find_contact".
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today handles last 30 minutes · Why: a forged or replayed handle (for example one written on a page) must fail · Enforced: In the app: src/agent/contactHandles.ts (HANDLE_TTL_MS, ContactHandles.resolve checks scope and age) · Source: docs/contacts.md › Handles, Threat model
- **`CON-6`** A handle is `ct-` plus 8 random characters (a–z, 0–9) from the platform's secure random source, plus `.N` for one value. Handles are not derived from the contact id. They are kept in memory only, and are forgotten when the conversation is cleared or the app restarts.
  Status: Default (manager or implementing session; open to change) · Why: a handle says nothing and cannot be guessed · Enforced: In the app: src/agent/contactTool.ts (makeHandles), src/device/contactsAccess.ts (one in-memory store), src/chat/contactCards.ts (newContactScope, new on clear in Conversation) · Source: docs/contacts.md › Handles
- **`CON-7`** Lookups with fewer than 2 letters, with wildcards (`* ? % _`) or with more than 4 words are refused.
  Status: Default (manager or implementing session; open to change) · Why: to refuse queries that could list the address book ("aa", "ab", …) rather than find one person · Enforced: In the app: src/agent/contactMatch.ts (MIN_QUERY_LETTERS, checkQuery) · Source: docs/contacts.md › Matching, Threat model
- **`CON-8`** Only `offer_call`, `draft_sms`, `draft_whatsapp` and `draft_email` turn a handle into a real value. A phone handle given to email, or an email handle given to a call, is refused. `type`, `navigate` and every other tool never resolve handles.
  Status: Default (manager or implementing session; open to change) · Why: values may go only to the dialer, Messages, WhatsApp or the mail composer, never into a page · Enforced: In the app: src/agent/contactTool.ts (contactForUse), called only from src/agent/executeTool.ts (offerCallTool, draftSmsTool, draftWhatsAppTool) and src/agent/shareTools.ts (draft_email) · Source: docs/contacts.md › The tool, Threat model
- **`CON-9`** Nothing is called or sent automatically. The user taps Call, and sends the text, WhatsApp message or email themself.
  Status: Default (manager or implementing session; open to change) · Why: every outgoing step stays the user's; even with a handle, the user sees the real recipient and text before acting · Enforced: In the app: src/agent/executeTool.ts (offerCallTool only shows a button; drafts open cards or the composer) · Source: docs/contacts.md › rule 4
- **`CON-10`** There is no approval dialog for each lookup.
  Status: Default (manager or implementing session; open to change) · Why: nothing leaves the phone in a lookup, the user's own words are the trigger (checked by the app), and every outgoing action keeps its own step; a dialog per lookup would add a tap to every "call Ahmet" without protecting anything · Enforced: In the app: src/agent/contactTool.ts (findContactTool has no confirmation by design) · Source: docs/contacts.md › Permission flow
- **`CON-11`** The contacts permission is offered in setup's "What Qutai may use" step (an optional row after the microphone: "so you can say 'call Ahmet'; numbers never go to the AI"; asked only when the user turns it on; iOS limited access shows "Only the contacts you chose" with Choose contacts) and otherwise asked at the first lookup, after Qutai's own short explanation, exactly as before. If the user refuses, the assistant asks for the number as before. If the permission is refused for good, there is no prompt, and the model points to Settings › Assistant › Contacts. Changed 19 Nov 2026 (before: asked at first use only, not in setup).
  Status: Owner, 2026-11-19 (asked for the row in setup) · Why: the owner wants it offered up front with the other permissions; the first-lookup question stays for those who skip it · Enforced: In the app: src/components/PermissionsStep.tsx, src/device/permissionStatus.ts (setupPermissions, contacts), src/agent/contactTool.ts (findContactTool, stateRefusal), src/device/contactsAccess.ts (ask) · Source: docs/contacts.md › rule 3, Permission flow; owner, 19 Nov 2026
- **`CON-12`** In a conversation that involves an incognito tab, `find_contact` and every use of a handle are refused, and no handles are made.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/contactTool.ts (incognito check in findContactTool and contactForUse) · Source: docs/contacts.md › Incognito
- **`CON-13`** Saved conversations and backups keep a card's name, label and message text, never the number. A restored card says the number isn't kept.
  Status: Default (manager or implementing session; open to change) · Why: disk and backups must never hold values from contacts · Enforced: In the app: src/chat/contactCards.ts (withoutContactValues), applied in src/chat/Conversation.ts (toSaved) · Source: docs/contacts.md › What is stored where
- **`CON-14`** The action history records only who a card was for (for example "Offered a call button: Ahmet Yılmaz"), never the number. For `find_contact` it records only the name the user said. Nothing is written for incognito.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/toolTable.ts (TOOL_TABLE logged), src/agent/executeTool.ts (record skips incognito) · Source: docs/contacts.md › What is stored where
- **`CON-15`** Contacts put nothing into memory automatically. "Ayşe is my sister" goes through `remember` like any other statement from the user.
  Status: Default (manager or implementing session; open to change) · Why: the model never has the number to save · Enforced: In the app: follows from CON-1 (there is no path from contacts to memory) · Source: docs/contacts.md › What is stored where
- **`CON-16`** Contacts are read only. Android's `WRITE_CONTACTS` permission is blocked.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: app.json (blockedPermissions; expo-contacts config plugin) · Source: e5ee439
- **`CON-19`** The model sees standard labels as given. A custom label is passed only if it has no digits and no "@" (cut to 24 characters); otherwise the model sees "other". Numbers with `*`/`#` codes, pauses or extensions are left out, and emails must look like an address.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/contactMatch.ts (modelLabel), src/agent/contactTool.ts (contactValues) · Source: docs/contacts.md › Matching
- **`CON-20`** A WhatsApp number saved without a country code gets the code of the phone's region, without the trunk prefix. The card and the model are told. If the region is unknown, the tool refuses and the model asks for `country_code`. Calls and texts use the number as saved.
  Status: Default (manager or implementing session; open to change) · Why: WhatsApp needs the country code; the dialer and SMS app understand local numbers · Source: docs/contacts.md › Phone numbers for WhatsApp; src/device/phoneRegion.ts
- **`CON-21`** With iOS 18 limited access, lookups see only the contacts the user shared. When nothing matches, the result says so, and the Settings row offers "Choose contacts".
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/contacts.md › Permission flow
- **`CON-23`** Both privacy policies (open-source and pro, English and Turkish) have a "Your contacts / Kişileriniz" section. The legal version is bumped for it: open-source 2 → 3, pro 4 → 5, so earlier users are asked to accept again.
  Status: Owner, 2026-11-19 · Why: the policy changed in substance · Source: 9c4ef02 (text), 040c537 (bump "on the owner's word"); src/legal/documents.ts
- **`CON-24`** Store forms are still open: the App Store privacy label (Contacts › App Functionality, not linked, no tracking), Play Data safety (Contacts › collected, ephemeral, optional) and the store listing sentence for `READ_CONTACTS`.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today none are filled in · Why: reason not recorded · Source: TODO.md › Contacts; docs/permissions.md

## Details

**Name matching**

- (was `CON-17`) Matching ignores case and diacritics (I, İ, ı fold to i; ş→s…), Turkish endings after an apostrophe ("Ayşe'ye" → "ayşe") and honorifics (Bey, Hanım, Abi, Hoca, Dr., Mr…). It searches given, middle, family and full name, nickname and company, and ranks whole and exact names first. Why: "ayse" must find "Ayşe" and "Mehmet Bey" must find "Mehmet"; the native name filter is not used because it is not diacritic-insensitive on Android and does not search nickname or company. Where: docs/contacts.md › Matching, Speed
- (was `CON-18`) Relationship words like "annem" or "mum" have no special meaning. They match only a contact saved under that name or nickname. Where: docs/contacts.md › Matching

**Waiting for the user**

- (was `CON-22`) The explanation before the permission prompt, and the picker, count as "waiting for the user", with a background notification, like other approvals. Where: 8f58d84

## Why it is designed this way

The model is the part that page text can influence, so it gets nothing it could leak: no values (CON-1), and no way to start a lookup the user didn't ask for (CON-2). The real numbers sit in memory behind short-lived random handles (CON-5, CON-6). Only the four outgoing tools can open a handle, and their output always lands where the user sees it and acts (CON-8, CON-9). Because each of those steps already needs the user, a per-lookup dialog would protect nothing (CON-10).

## Limits and what is not built

- Not verified on a device: the assistant flow (lookup, picker, cards, WhatsApp local number, email, incognito, saved-card stripping), a large address book, and the Android prompt and "ask again". Only the Settings row and the iOS limited-access picker were checked on the simulator.
- `expo-contacts` is a new native module, so a new native build is needed.
- The new agent profile id needs registering on the server.
- `draft_whatsapp` stays text only (no files with a preselected chat).

## Where it lives

- [docs/contacts.md](../../docs/contacts.md): design, matching, permission flow, threat model.
- `src/agent/contactTool.ts`, `src/agent/contactMatch.ts`, `src/agent/contactHandles.ts`.
- `src/device/contactsAccess.ts`, `src/device/contacts.ts`, `src/device/phoneRegion.ts`.
- `src/chat/contactCards.ts`.
- `src/components/SettingsModal.tsx` (ContactsRow).
- [README.md](../../README.md) › Contacts paragraph.

## Disagreements between sources

- TODO.md › Contacts still has "Bump the legal version (… 2 → 3 and … 4 → 5) … not done by the contacts session, on purpose" unchecked. Commit 040c537 did the bump on the owner's word (`src/legal/documents.ts` versions 3 and 5). The TODO line is stale.
- TODO.md › Contacts "Website: add contacts to the feature and privacy pages" is unchecked. Commit 3dc3119 "Website: contacts, scripts, page styles, cookie list and image filters (EN, TR)" appears to have done it.
- docs/contacts.md opens with "Decided 19 Nov 2026" without saying by whom. TODO.md lists the limits (5 people, 8 rows, 30 minutes, user-said names) for the owner to confirm. This document treats them as waiting.
- docs/contacts.md does not mention the 8-row picker cap, nor that the model's list still names every matched person when rows are dropped. Neither does it mention the 4-word query limit. The code has both.
