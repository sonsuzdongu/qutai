# 18. Page styles

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

The user can change how a site looks by asking: "make the links red", "bigger text on this site", "dark background here". The assistant writes the CSS (the page's styling rules). Qutai checks it and asks every time, and the user can keep the style for later visits.

## How it works

1. The user asks for a change. The model calls `restyle_page` `apply` with CSS and a short description in the user's language.
2. Qutai parses the CSS and keeps only a safe subset, with every declaration made `!important` (so it wins over the page's own rules). If anything is not allowed, the whole stylesheet is refused, the reason goes back to the model, and nothing is applied.
3. Qutai's dialog asks every time. It shows the description and the site, with the CSS under Details.
4. On Apply, the page changes at once. This is a trial style, kept until the tab loads another page. The chat gets a style card with **Keep for this site…** and **Undo**.
5. Keep asks where the style applies: this page, pages under this path, this site, this site and its subdomains (the default), or everywhere. The style is then saved to My rules, named after its description (the user can rename it there).
6. Kept styles live in Settings › Privacy and security › Filter lists › My rules › Styles. Each has a switch, Edit CSS, Rename, Change where it applies and Delete; "Add a style" writes one by hand. This part of My rules is not greyed out when ad blocking is off.
7. Kept styles are added before the page first draws, follow address changes inside single-page apps, and also apply in incognito tabs.
8. Whenever a style applies, the page menu shows **Styles off for this page**, and then **Styles on for this page**.
9. The model can also `undo` the trial and `list` the kept styles on the page. It cannot keep, edit or delete them.

## The rules

- **`STY-1`** Every style is approved in Qutai's dialog, every time, with the description, the site and the CSS under Details. There is never a "don't ask again", whatever the site's setting.
  Status: Default (manager or implementing session; open to change) · Why: covering the page with fake boxes or `content:` text is possible in principle, so every style is shown, approved and can be switched off · Enforced: In the app: src/components/pageCustomisation.tsx (askStyle), called from src/agent/pageCustomTool.ts (pageCustomTool); restyle_page confirms itself in src/agent/toolTable.ts (TOOL_TABLE) and is not a kind in src/agent/alwaysAllow.ts · Source: docs/page-customisation.md › Styles › The flow; 08b4da8
- **`STY-2`** The CSS is parsed and written back from the parse, not pattern-matched. Only the written-back CSS is stored and injected, never the input. It is checked again whenever a style is kept, edited, imported or restored from a backup.
  Status: Default (manager or implementing session; open to change) · Why: pattern matching can be got around by escapes and odd spellings; escapes are decoded before any name is checked · Enforced: In the app: src/content/userCss.ts (sanitizeCss); src/storage/siteRules.ts (addStyle, checked); src/content/userStyles.ts (readBackupStyles) · Source: docs/page-customisation.md › CSS sanitising; 362cc0f
- **`STY-3`** These are allowed:
  - style rules;
  - `@media` and `@supports` with one level of nesting;
  - any property, with values from a list of functions: colours, maths, `var`, `env`, gradients, transforms, filters and a few more;
  - `url()` only with a raster `data:` image (PNG, JPEG, GIF or WebP, base64, at most 64 KB), never SVG.

  Status: Default (manager or implementing session; open to change) · Why: an SVG can reference other files · Enforced: In the app: src/content/userCss.ts (RASTER_DATA_URL, MAX_DATA_URL) · Source: docs/page-customisation.md › CSS sanitising
- **`STY-4`** The whole stylesheet is refused, with the reason, if it contains any of these:
  - any other at-rule, however it is spelled (`@import`, `@font-face`, `@keyframes`, `@\69mport`…);
  - `url()` in any other form;
  - `image-set`, `image`, `cross-fade`, `element`, `paint`, `src`, `attr`, `expression` or any unlisted function;
  - the `behavior`, `-moz-binding` and `src` properties;
  - a selector or value that mentions `qutai`;
  - `<`, `</style`, NUL, or unbalanced brackets or strings.

  Status: Default (manager or implementing session; open to change) · Why: a stylesheet can make network requests only through `@import`, `url()` and its relatives, `image-set()` and `@font-face`, so with these refused, attribute selectors like `input[value^="a"]` can't send anything anywhere; `attr` can read attribute values into the page; nothing is dropped silently "so the user sees exactly what runs"; Qutai's own in-page elements can't be selected · Enforced: In the app: src/content/userCss.ts (sanitizeCss, mentionsQutai) · Source: docs/page-customisation.md › CSS sanitising, Threat model
- **`STY-6`** Applying a style is refused on sites set to "Read only" or "Blocked". Listing and undoing are refused on "Blocked" sites only.
  Status: Default (manager or implementing session; open to change) · Why: applying changes the page; listing and undoing only read or put things back · Enforced: In the app: src/agent/sitePolicy.ts (policyName, WRITE_ACTIONS, decide), applied in src/agent/executeTool.ts (executeUnredacted) · Source: docs/page-customisation.md › The flow; 4f00645
- **`STY-7`** Nothing is kept from an incognito tab: the card shows no Keep, and keeping is refused. Kept styles still apply in incognito tabs.
  Status: Default (manager or implementing session; open to change) · Why: nothing is written from incognito; applying matches the existing hide-rule behaviour, where the user's own rules apply in every tab · Enforced: In the app: src/components/pageCustomisation.tsx (keepStyle, StyleCard) · Source: docs/page-customisation.md › The flow, Injection
- **`STY-8`** The model can't keep, edit or delete kept styles. It can only apply (with approval), undo the trial and list. Only the user keeps a style from the card or changes it in My rules.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/pageCustomTool.ts (pageCustomTool offers apply, undo, list only) · Source: docs/page-customisation.md › The flow
- **`STY-9`** "Everywhere" (`*`) is a scope for styles only. Hide rules can't have it.
  Status: Default (manager or implementing session; open to change) · Why: a selector that hides an ad on one site hides content on another · Source: docs/page-customisation.md › Scopes
- **`STY-10`** Keep offers this page, pages under this path, this site, this site and its subdomains, or everywhere. The default is "this site and its subdomains", and `www.` counts as the same site.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/page-customisation.md › Scopes; src/components/pageCustomisation.tsx (DEFAULT_STYLE_SCOPE_INDEX)
- **`STY-12`** There are at most 200 kept styles in all and 20 per site.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/content/userStyles.ts (MAX_STYLES, MAX_STYLES_PER_SITE)
- **`STY-13`** Styles apply whatever "Block ads and trackers" and "Don't block on this site" say. They have their own escape hatch.
  Status: Default (manager or implementing session; open to change) · Why: styles are not ad blocking · Source: docs/page-customisation.md › Rule kinds
- **`STY-14`** Whenever a kept or trial style applies, the page menu offers "Styles off for this page". This lasts for that tab until it is switched back on or the tab closes, and is kept in memory only.
  Status: Default (manager or implementing session; open to change) · Why: a broken style can never trap the page; it can be switched off, then fixed or deleted · Source: docs/page-customisation.md › Injection; src/browser/pageStyleState.ts
- **`STY-16`** Styles reach the main frame only. They never reach frames, the reader view, the PDF view, the new tab page or Qutai's native screens.
  Status: Default (manager or implementing session; open to change) · Why: a frame is often another site, so a site's style should not restyle an embedded map or video player, and an "everywhere" style in every ad frame costs memory for nothing · Source: docs/page-customisation.md › Injection
- **`STY-17`** The trial style lasts until the tab loads another page. Undo removes it at once; after a page change, Undo does nothing.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: docs/page-customisation.md › The flow
- **`STY-18`** In the rules file, each style is a block of comment lines (`! [style] {json}`, `! | css`, `! [end]`), so other blockers and older Qutai versions skip it. On import the app lists the styles and asks **Import switched on** or **Import switched off**. Styles that fail the check are counted as invalid.
  Status: Default (manager or implementing session; open to change) · Why: a malicious rules file must not add styles unseen · Enforced: In the app: src/content/rulesFile.ts; src/components/SiteRulesSection.tsx · Source: docs/page-customisation.md › Export, import, backup
- **`STY-19`** Kept styles are in the encrypted backup and the server backup (`sites.styles`), checked again on restore. A style with the same scope and CSS is merged. Older versions ignore the array.
  Status: Default (manager or implementing session; open to change) · Why: a malicious backup must not carry unchecked CSS; older versions must not lose their own data · Enforced: In the app: src/content/userStyles.ts (readBackupStyles); src/backup/database.ts · Source: docs/page-customisation.md › Export, import, backup; 5aaf975
- **`STY-20`** The action history records only that a style was applied, never the CSS.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/agent/toolTable.ts (TOOL_TABLE logged, isLoggedCall)
- **`STY-21`** Style cards in restored chats still offer Keep, while script cards don't.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today a restored style card offers Keep, and the CSS is checked again when it is kept · Why: low risk, because the CSS is sanitised again · Source: TODO.md › Page customisation, step two — owner decisions
- **`STY-22`** Kept styles on sites set to "Blocked" still apply wherever their scope says.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today they apply; the open question is whether "Blocked" should switch off kept "everywhere" styles there · Why: they are the user's own; the site levels govern the assistant · Source: TODO.md › Page customisation, step one
- **`STY-23`** The model is told to use `restyle_page` with short, specific CSS for look changes. Qutai-wide text size stays with the settings tool. Only the user's own request counts, never page text.
  Status: Default (manager or implementing session; open to change) · Why: page text asking for a restyle must not count · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check who asked, but the approval in STY-1 always applies · Source: 4f00645; docs/page-customisation.md › Threat model
- **`STY-24`** Page styles are covered by the legal-version bump of 19 Nov 2026: open-source 2 → 3 (its comment names "page styles and the cookie list") and pro 4 → 5.
  Status: Owner, 2026-11-19 · Why: the policy changed in substance (contacts, cookies) · Source: 040c537 (bump "on the owner's word"); src/legal/documents.ts

## Details

**Size of a stylesheet**

- (was `STY-5`) A stylesheet may have at most 16 KB of CSS and at most 200 rules. Where: src/content/userCss.ts (MAX_CSS_LENGTH, MAX_CSS_RULES); docs/page-customisation.md › CSS sanitising

**Keep dialog**

- (was `STY-11`) The Keep dialog has no name field. The style is named after its description and can be renamed in My rules. Why: on a phone the keyboard covered the dialog's explanation. Where: 03b2506

**How styles reach the page**

- (was `STY-15`) Styles are injected at document start in the main frame and again after load, as one `<style data-qutai="user-styles">` element moved to the end of the document. They are re-checked after single-page-app address changes, so a page-scoped style goes away when the app moves to another address. Why: so the page never shows unstyled first and the style comes after the page's own sheets; Android may run the early script for the previous page, hence again after load. Where: docs/page-customisation.md › Injection

## Why it is designed this way

A style can't run code. Its only ways to reach the network are `@import`, `url()` and similar functions, and all of these are refused (STY-3, STY-4). With no request possible, the remaining risk is visual: a style could cover or fake parts of a page. That is why every style is approved with its CSS shown (STY-1), only the user keeps it (STY-8), and the page menu can always turn styles off (STY-14).

## Limits and what is not built

- Main frame only; frames are never styled.
- No fonts, animations (`@keyframes`) or external images.
- Visual spoofing is possible in principle; the answer is approval, Details and "Styles off".
- Not verified on Android; the iOS simulator run passed (03b2506).

## Where it lives

- [docs/page-customisation.md](../../docs/page-customisation.md) › Rule kinds, Scopes, Styles, Threat model.
- `src/content/userCss.ts` (sanitiser), `src/content/userStyles.ts` (scopes, page script, backup reader), `src/content/rulesFile.ts`.
- `src/agent/pageCustomTool.ts`, `src/agent/pageCustomTools.ts`.
- `src/components/pageCustomisation.tsx`, `src/components/StyleEditorScreen.tsx`, `src/components/SiteRulesSection.tsx`, `src/browser/pageStyleState.ts`.
- `src/storage/siteRules.ts` (table `site_rules`, migration 21 adds `kind`, `name`, `body`, `meta`).
- [README.md](../../README.md) › Page styles, cookies and scripts.

## Disagreements between sources

- docs/page-customisation.md › Styles calls the rules file "version 2". The code now writes format 3 (`RULES_FILE_FORMAT` in `src/content/rulesFile.ts`), which still holds styles the same way. The Scripts section of the same doc explains this.
- The design note's flow implies Keep asks for a name. Commit 03b2506 removed the name field, and the code follows the commit.
- The doc says only that applying is refused on Blocked sites. The code (`decide`) refuses every `restyle_page` action there, including list and undo.
- TODO.md › Page customisation, step one still lists "Bump the legal version for the privacy policies' new words on cookies … not done, on purpose". Commit 040c537 did the bump (the open-source version 3 comment names "page styles and the cookie list"). The TODO line is stale.
