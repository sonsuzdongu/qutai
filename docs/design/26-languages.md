# 26. Languages

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The languages of Qutai's interface, how the interface language is chosen, and which language the assistant answers in.

## How it works

1. The interface is in ten languages: English, Turkish, German, Spanish, Portuguese (Brazil), French, Japanese, Korean, Russian and Indonesian.
2. By default Qutai follows the phone's language. Region variants map to the language (Mexican Spanish → Spanish, European Portuguese → Portuguese (Brazil)). A phone in a language Qutai doesn't have gets English.
3. Settings › Language offers "System default" or one of the ten:
   - Android 13 and newer: this is the system's per-app language, the same setting as the phone's Settings › Apps › Qutai › Language; changing either changes both, and the widget follows.
   - Older Android: Qutai keeps the choice itself and applies it to its screens, notifications and widget.
   - iOS: the row opens Qutai's page in the iOS Settings app, where iOS keeps the per-app language (and restarts the app).
   - Setup's first step offers the same choice (since 19 Nov 2026, `LANG-21`): the ten languages, preselected to the one Qutai is already in.
4. The interface switches at once without a restart; tabs and conversations stay.
5. The assistant answers in the language the user writes in. Example: the interface is English, the user writes "Bu sayfayı özetle", the answer comes in Turkish. Names of Qutai's buttons and screens stay as they appear on screen.
6. The assistant addresses the user formally where the language has a formal form (Turkish "siz", German "Sie", French "vous", Spanish "usted", Russian "вы"), unless the user asks otherwise.
7. Turkish interface text addresses the user as "siz" everywhere.
8. Steps of a task show in the chat in the interface language ("“Sepete ekle” düğmesine dokunuluyor"); the AI still reads English tool results.
9. The privacy policy and terms exist in English and Turkish; other languages show the English text with a translated note above it.
10. Android launcher shortcuts (long-press the icon) are in the phone's language, even when Qutai's own language differs.

## The rules

- **`LANG-1`** The interface ships in exactly ten languages; English is the source and the fallback for any missing text.
  Status: Owner, date not recorded · Why: reason not recorded · Source: ROADMAP.md › 5. Decisions; f4c7860, dd4c1a5, 312cdb0 (2026-11-16); src/i18n/index.ts (t)
- **`LANG-2`** The default interface language is the first of the phone's languages that Qutai has, otherwise English.
  Status: Owner, date not recorded · Why: reason not recorded · Source: ROADMAP.md › 5. Decisions; src/i18n/index.ts (detectLanguage)
- **`LANG-3`** Settings › Language uses the system's per-app language on Android 13+ (both ways), Qutai's own stored choice on older Android (applied before the first screen draws), and opens the iOS Settings app on iOS.
  Status: Default (manager or implementing session; open to change) · Why: on Android 13+ the two settings stay in step and the widget follows; iOS keeps the per-app language itself · Source: README (interface languages paragraph); dd4c1a5; src/i18n/appLanguage.ts, src/i18n/startup.ts
- **`LANG-21`** Setup starts with the language: the ten languages, each named in itself, preselected to the language Qutai already shows (the phone's nearest, English if none). A pick switches setup at once and is stored where Settings › Language keeps it: on Android through the same per-app setting (going back to the preselected language restores "System default"); on iOS as the app's own `AppleLanguages` value, the one Settings › Qutai › Language writes, so iOS applies it to permission requests and quick actions from the next launch. Left out on an Android build without the native function, and when only the legal texts are asked again.
  Status: Owner, 2026-11-19 · Why: the owner asked for a language choice as setup's first step, defaulting to the phone's language; one setting, not a second copy · Enforced: In the app: src/i18n/appLanguage.ts (chooseSetupLanguage), src/components/Onboarding.tsx · Source: docs/test-checklist.md › 19 Kasım'da bildirilenler
- **`LANG-5`** Turkish interface text addresses the user as "siz", including the setup questions, legal texts, iOS permission texts and Android notification and widget texts.
  Status: Owner, 2026-11-16 · Why: the app mixed "sen" and "siz"; the owner picked one · Source: TODO.md › Assistant › Onboarding; 33f5d6b, 9cea977; owner's memory note on Turkish "siz"
- **`LANG-6`** Exceptions to "siz": texts the user sends to the assistant (suggestion prompts, custom-instruction examples such as "Kısa yanıt ver") and short bare-imperative buttons ("Kaydet", "Kabul et ve devam et") keep their form.
  Status: Default (manager or implementing session; open to change) · Why: the user-sent lines are the user's own words to the assistant and are matched when replaced; reason for buttons not recorded · Source: TODO.md › Assistant › Onboarding; siz-legal-retired-instruction note
- **`LANG-7`** The assistant replies in the language the user writes in, even when it differs from the interface language; only quoted names of on-screen controls stay as shown.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check it · Source: b65d4de; src/agent/systemPrompt.ts
- **`LANG-8`** The assistant addresses the user formally where the language distinguishes (siz, Sie, vous, usted, вы; Brazilian Portuguese "você") unless asked to be informal.
  Status: Default (manager or implementing session; open to change) · Why: follows the owner's "siz" decision for the interface · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check it · Source: 20ac063 (2026-11-17)
- **`LANG-9`** Every user message carries the interface language, and tool results name Qutai's buttons, screens and settings by their on-screen labels; the model must use them verbatim and never translate or invent them. The system prompt and tool descriptions contain no labels.
  Status: Default (manager or implementing session; open to change) · Why: so the assistant says "tap ‘Ayarlar’" exactly as the user sees it; a static prompt keeps the agent profile unchanged · Source: b65d4de; src/agent/uiLabels.ts (interfaceLanguageNote, uiLabel, uiPath)
- **`LANG-10`** What the AI reads stays English (tool results, prompts); the user sees a translated step line, and a failed step without its own note shows the translated "This step didn't work" with the English text under Details.
  Status: Default (manager or implementing session; open to change) · Why: the model's text stays unchanged while the user never sees raw English · Source: e267272, cd114f8; src/agent/stepLine.ts
- **`LANG-16`** Today the privacy policy and terms exist only in English and Turkish, and other languages show English with a translated note.
  Status: Waiting for the owner (owner's open question 25: keep, or commission human translations and in which languages first) · Why: reason not recorded · Source: ten-languages note; src/legal/documents.ts (legalDocument)
- **`LANG-17`** Today the eight newer translations are unreviewed by native speakers; brand names "Qutai Credits" / "Qutai Fast" / "Qutai Pro" stay in English (Turkish says "Hızlı").
  Status: Waiting for the owner (owner's open questions 26 and 27; [ROADMAP.md](../../ROADMAP.md#5-decisions)) · Why: long German and Russian labels, regional Spanish, Korean particles and informal AI prompts are the most likely issues · Source: ROADMAP.md › User experience; README
- **`LANG-18`** Today translate prompts say "into <interface language>" and examples use local cities.
  Status: Waiting for the owner (owner's open question 28) · Why: reason not recorded · Source: owner's open-questions memory note
- **`LANG-19`** Android launcher shortcuts are static and stay in the phone's language when Qutai's language differs; dynamic copies from earlier builds are removed; the widget follows Qutai's language.
  Status: Default (manager or implementing session; open to change) · Why: Android lets an app neither change nor hide manifest shortcuts, launchers show static and dynamic side by side (duplicates), and dynamic-only shortcuts were missing right after install · Source: e38c806 (2026-11-17), cc84a36; TODO.md › Device integrations
- **`LANG-20`** The custom-instruction line "Always reply in Turkish" / "Her zaman Türkçe yanıt ver" added by older builds is removed once, only on an exact match, also when restoring an older backup.
  Status: Owner, 2026-11-16 · Why: the answer language now follows the user's message · Enforced: In the app: src/agent/retiredInstructions.ts · Source: ab94093; owner's open-questions memory note (answered item 19)

## Details

**Switching**

- (was `LANG-4`) Switching language changes the interface live, without restarting the app. · Why: tabs and conversations stay · Where: README; app-language-shortcuts note

**Translation files and formatting**

- (was `LANG-11`) Only English and the active language are loaded at runtime. · Why: the app starts with English plus the one language it shows, not ten dictionaries in memory · Where: src/i18n/index.ts; ten-languages note
- (was `LANG-12`) Every new text key is added to English and all nine other files; values identical to English are listed in `scripts/i18n-tests/same-as-english/<code>.json`; `npm run test:i18n` fails otherwise. · Why: a missing key would show English at runtime · Where: ten-languages note; i18n-step-lines-audit note
- (was `LANG-13`) Plural forms are written inside the text (`{count|one:…|few:…|many:…|other:…}`); Android download notifications use Android plurals. · Why: Hermes has no Intl.PluralRules; Russian needs several forms that agree with the number · Where: f4c7860, c136325
- (was `LANG-14`) Numbers, percentages, dollar amounts, lists and the first day of the week are formatted through `src/i18n/format.ts`, never by checking for one language. · Why: each language has its own formats · Where: 4cb46fa; ten-languages note

**Turkish wording**

- (was `LANG-15`) Turkish uses one term per concept: yapay zekâ (not AI), bağlantı (not link), işlem (not eylem), hafıza, İndirilenler, anımsatıcı (calendar) vs hatırlatma (task reminder), çevrim dışı/içi; no suffix is attached directly to a placeholder ("Ara: {name}"). · Why: one term per concept · Where: 33f5d6b; fix3-ui-labels-turkish-copy note

## Limits and what is not built

- The widget picker's name and description and the app's name stay in the phone's language (the system resolves them).
- On the iOS simulator Settings › Language opened the iOS Settings app at its main page, not at Qutai's page (O4 in [docs/performance-2026-11.md](../../docs/performance-2026-11.md)); check on a phone.
- The scroll step's line still shows the English direction word ("Scrolling: down"): a small translation fix, listed in TODO.
- Language checks of all ten languages at the largest text size on a narrow phone are still to do.

## Where it lives

- `src/i18n/` (index, languages, format, appLanguage, startup, one file per language)
- `src/agent/uiLabels.ts`, `src/agent/stepLine.ts`, `src/agent/retiredInstructions.ts`, `src/legal/documents.ts`
- `modules/qutai-entry` (per-app language, shortcuts, widget texts)
- [README.md](../../README.md) (interface languages paragraph)

## Disagreements between sources

- An older hand-over note (fix 3) says the Turkish setup questions keep the owner's deliberate "sen" (2ad000d); the owner changed this to "siz" on 2026-11-16 (9cea977). The app uses "siz".
- The 17 Nov hand-over note on fixes A–G calls the shortcut-language outcome an "owner decision pending"; TODO.md does not list it as waiting.
