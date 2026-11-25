# 20. Page scripts

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

When reading the page isn't enough ("how many links are on this page", "collect this table"), the assistant can run a small piece of JavaScript on the page. The user approves every run, after seeing the code, unless they chose to let scripts run on that site without asking (`SCR-36`). The user can also keep a script so it runs on every visit to a site. This is the riskiest thing the assistant can do, so it is off by default and fenced by app-side checks.

## How it works

1. Scripts are off until the user turns on Settings › Assistant › "Let the assistant run scripts on pages". Turning it on asks once more, in plain words. While it is off, the assistant can't run scripts and kept scripts don't run either.
2. The model calls `run_script` with the body of an async function, a one-sentence description, and `where`: `copy` (the default) or `page`.
3. Before asking anything, the app refuses in these cases:
   - the setting is off;
   - the site is "Read only", "Blocked" or has scripts switched off;
   - a publish or pay approval is waiting in the tab;
   - the static check refuses the code;
   - the page is sensitive: a password, one-time-code or card field, or a sign-in, payment or bank address, unless the user allowed scripts on that site;
   - the code doesn't parse.

   Every refusal goes back to the model; the user sees nothing.
4. Then Qutai's dialog appears, unless the user chose "Run scripts on {site} without asking" for that site (`SCR-36`): then only the step line "Ran without the dialog: you allowed scripts on {site}" shows, and steps 5 and 6 are the same. The dialog shows the description, the site, where the code runs, flags in red ("Changes the page", "Loads pages from this site as you"…), what an approved live-page script can do, and the exact code under Details, and a box, off: "Run scripts on {site} without asking from now on" (not in incognito).
5. `copy` runs on a sealed copy of the page in a hidden WebView, with no internet, no sign-in, no cookies or storage and no navigation. `page` runs on the live page, in the page's own JavaScript world, with the user's sign-in on that site.
6. Exactly the approved code runs once, in that tab, while the tab shows that page, with a 10-second limit. The result (at most 16 KB for the model) comes back marked as untrusted page data.
7. After a successful live-page run, the chat card offers **Keep for this site…** (not in incognito). The user picks where: this page, pages under this path, this site, or this site and subdomains, never everywhere. The user also picks when: when the page is ready (the default), or after it has loaded.
8. Kept scripts run by themselves once per page load. They are listed in Settings › Privacy and security › Filter lists › My rules › Scripts, with a switch, view and edit code, where, when, last run, rename and delete.
9. The page menu has **Scripts off for this page**.
10. Per-site exceptions are in Settings › Assistant › (scripts switch) › "Sites with their own setting". A site can have scripts off, or be allowed on its sensitive pages.

## The rules

- **`SCR-1`** Scripts are off by default. Turning them on asks once more. The assistant's `settings` tool can't change this setting, and it is never restored from a backup.
  Status: Default (manager or implementing session; open to change) · Why: page content can try to instruct the model (prompt injection), and a live-page script runs with the user's sign-in; treated like the payments switch · Enforced: In the app: src/storage/settings.ts (assistantScripts: false); src/components/SettingsModal.tsx (second confirmation); not in the allowlist of src/agent/settingsTool.ts; not in BackupSettings in src/backup/payload.ts · Source: docs/page-customisation.md › Scripts rule 1; 0aecab6, 2c4302d
- **`SCR-2`** While the setting is off, no script runs at all, one-off or kept.
  Status: Default (manager or implementing session; open to change) · Why: "the switch is the whole capability" · Enforced: In the app: src/agent/scriptTool.ts (scriptTool checks enabled); src/browser/keptScripts.ts (ready, the shipped list) · Source: docs/page-customisation.md › Scripts rule 1
- **`SCR-3`** Every run is approved in Qutai's dialog, every time, unless the user chose "Run scripts on {site} without asking" for that site (`SCR-36`). The dialog shows the description, site, where it runs, the flags in red, what an approved script can do, and the exact code under Details. Its only "don't ask again" is that per-site box. An approval is single use and bound to the tab and the page. Changed 23 Nov 2026 (owner): before, there was no box at all.
  Status: Default (manager or implementing session; open to change); the per-site exception is the owner's, 2026-11-23 · Why: the user must see exactly what runs; a page can't approve anything · Enforced: In the app: src/components/pageScripts.tsx (askScript), called from src/agent/scriptTool.ts (scriptTool); run_script confirms itself in src/agent/toolTable.ts (TOOL_TABLE) and is not a kind in src/agent/alwaysAllow.ts · Source: docs/page-customisation.md › Scripts rule 2; owner, 23 Nov 2026
- **`SCR-4`** The code that runs is the code that was shown, checked against its hash right before the run. Nothing runs if the tab moved to another page or the setting was switched off while the user decided.
  Status: Default (manager or implementing session; open to change) · Why: the approval is "for this code, in this tab, on this page, now" · Enforced: In the app: src/agent/scriptTool.ts (codeHash checks after approval) · Source: docs/page-customisation.md › Scripts rule 2
- **`SCR-5`** Sites set to "Read only" or "Blocked", or with scripts switched off, never run scripts, one-off or kept.
  Status: Default (manager or implementing session; open to change) · Why: site modes rule · Enforced: In the app: src/agent/sitePolicy.ts (run_script in WRITE_ACTIONS; decide); src/agent/scriptTool.ts (siteSetting off); src/browser/keptScripts.ts (ready) · Source: docs/page-customisation.md › Scripts rule 4
- **`SCR-6`** Sensitive pages are refused by default, in both modes. A page is sensitive if it has any of these:
  - a password, one-time-code or card field;
  - a path word such as login, signin, oauth, auth, checkout, payment, pay, billing, password, 2fa, mfa, otp, verify, security, wallet, kasa, odeme or giris;
  - a payment or identity-provider host (PayPal, Stripe, iyzico, Apple ID, Google accounts, Microsoft sign-in, e-Devlet…);
  - a bank host (a list including Turkish banks, plus any host label containing bank, banka, banco or banque).

  Status: Default (manager or implementing session; open to change) · Why: a live-page script runs with the user's sign-in; posting, buying and changing account settings must stay out of reach · Enforced: In the app: src/content/userScripts.ts (sensitivePage, PAYMENT_HOSTS, SIGN_IN_HOSTS, BANK_HOSTS, SENSITIVE_PATH); facts from src/content/scriptPage.ts (scriptFacts); checked in src/agent/scriptTool.ts and src/browser/keptScripts.ts · Source: docs/page-customisation.md › Sensitive pages
- **`SCR-7`** The sensitive-page lists are a first version.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today the lists are as in SCR-6, and the owner may extend them for the target markets · Why: "a start" · Source: TODO.md › Page customisation, step two — owner decisions
- **`SCR-8`** Scripts can run on one sensitive site only if the user sets that site to "Allowed on sensitive pages" in Settings › Assistant › "Sites with their own setting". The dialog, the chat and the assistant can't do it. Since 25 Nov 2026 "Sites with their own setting" travels in backups, so restoring one restores them (`DATA-32`); the scripts switch itself does not (`DATA-5`).
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/scriptTool.ts (siteSetting === 'sensitive'); src/components/ScriptSitesSection.tsx · Source: docs/page-customisation.md › Sensitive pages
- **`SCR-9`** No script runs while a publish or pay approval is waiting in the tab.
  Status: Default (manager or implementing session; open to change) · Why: a script could press or change what the user just approved · Enforced: In the app: src/agent/scriptTool.ts (ApprovalGrants.hasTab, checked before and after the dialog) · Source: docs/page-customisation.md › Sensitive pages (other refusals)
- **`SCR-10`** A static check (a JavaScript tokenizer plus rules) refuses code that does any of these, with the reason sent to the model:
  - loads or makes code: `eval`, `Function`, `import()`, script, iframe or object elements, `srcdoc`, workers, WebAssembly, Blob URLs;
  - uses other network channels: XHR, `sendBeacon`, WebSocket, EventSource, WebTransport, RTCPeerConnection;
  - touches cookies, `cookieStore`, or strings naming password or one-time-code;
  - uses the clipboard;
  - leaves the page or frame: location changes, `open`, history, `contentWindow`, `top`, `parent`, `opener`, `postMessage`;
  - acts as the user: `submit`, `requestSubmit`, `.click()`, `dispatchEvent`, synthetic events;
  - touches Qutai's own objects;
  - can't be checked: computed access on `window` or `document`, `Reflect`, `Proxy`, `with`, `atob`, `fromCharCode`, escapes spelling plain letters;
  - could break out of its wrapper function.

  Status: Default (manager or implementing session; open to change) · Why: pressing and sending stay with the click and type tools, where the publish and pay approvals apply; honest limit: a static check is a filter, not a sandbox, so read-only work goes to the copy, where the sandbox enforces "no network, no session" · Enforced: In the app: src/content/scriptCheck.ts (checkScript), called in src/agent/scriptTool.ts · Source: docs/page-customisation.md › The static check
- **`SCR-12`** Scripts may not press buttons, submit forms, navigate or open windows. One-off live-page scripts may not touch site storage (`localStorage`, `sessionStorage`, `indexedDB`, `caches`). Kept scripts may use storage (shown in red) but may not press, submit or navigate either, so there are no "auto-click Load more" or redirect userscripts.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today these are refused as stated; the question is whether to loosen any of them for kept scripts · Why: site storage holds sign-in tokens and a one-off script's result goes to the AI; pressing and sending belong to the tools with approvals · Enforced: In the app: src/content/scriptCheck.ts (checkScript, STORAGE, mode "page") · Source: TODO.md › Page customisation, step two — owner decisions; docs/page-customisation.md › The static check
- **`SCR-14`** Inside a script, `fetch` is Qutai's guarded version: same origin as the page only, GET or HEAD only, no body, redirects not followed. In a copy there is no network at all.
  Status: Default (manager or implementing session; open to change) · Why: an open redirect can't carry data elsewhere; the copy has no session to misuse · Enforced: In the app: src/content/userScripts.ts (wrapScript) · Source: docs/page-customisation.md › The wrapper
- **`SCR-15`** `copy` is the default. The copy is a snapshot of the page's main frame, loaded into a hidden WebView created for one run. The snapshot carries no page scripts, handlers, frames, `<meta>`, `<base>`, password, hidden or one-time-code values, or card fields. The WebView has these properties:
  - a CSP of `default-src 'none'; style-src 'unsafe-inline'; img-src data:` (no script or connect sources);
  - no cookies and no DOM storage (iOS: a non-persistent store);
  - every navigation refused;
  - removed after the run, a timeout or an endless loop.

  Status: Default (manager or implementing session; open to change) · Why: read-only work (counting, extracting text, links and tables) belongs where the engine, not the check, enforces "no network, no session" · Enforced: In the app: src/components/ScriptSandbox.tsx (CSP, WebView props); src/content/scriptPage.ts (scriptSnapshot) · Source: docs/page-customisation.md › Two places a script can run
- **`SCR-16`** A run has a 10-second limit. A copy is then destroyed. On the live page, the app stops waiting but can't stop a script that loops forever, and the result says so.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/content/userScripts.ts (SCRIPT_TIME_LIMIT_MS) · Source: docs/page-customisation.md › The wrapper
- **`SCR-17`** A script's result is untrusted page data. It is JSON, cut at 64 KB in the page and 16 KB for the model, wrapped in markers that say it is not instructions, and passed through the hidden-value redaction. It is never stored in memory, backups, the action history or the sent log (which keeps sizes only).
  Status: Default (manager or implementing session; open to change) · Why: a result can carry injected instructions · Enforced: In the app: src/content/userScripts.ts (formatOutcome, PAGE_RESULT_CAP, MODEL_RESULT_CAP); src/agent/executeTool.ts (redaction of every result; history logs only that a script ran and its description) · Source: docs/page-customisation.md › Scripts rules 5–6
- **`SCR-18`** Scripts reach the main frame only and can't reach frames.
  Status: Default (manager or implementing session; open to change) · Why: a frame is usually another site (a payment form, a sign-in widget, an ad), and a script approved for the page's site must not reach it · Enforced: In the app: src/content/scriptCheck.ts (frame access refused); the copy leaves frames out · Source: docs/page-customisation.md › Which JavaScript world
- **`SCR-19`** Scripts run in the page's main JavaScript world on both platforms. iOS's isolated content world (`WKContentWorld`) is not used.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today it is not used · Why: it needs a native patch (react-native-webview 14 doesn't expose it), Android has nothing equivalent, kept scripts would behave differently on the two platforms, and it does nothing against the real risk (the script misusing the session); page tampering is already covered by treating results as untrusted · Source: docs/page-customisation.md › Which JavaScript world
- **`SCR-20`** Kept scripts have two run times: `end` (DOMContentLoaded, the default) and `idle` (after load). There is no "document start".
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today there is no document-start option · Why: before the page exists there is nothing to check for sensitive fields, and a script that must beat the page's own code is a different risk; the cost is no "block the page's own script" userscripts · Enforced: In the app: src/content/userScripts.ts (isScriptRunAt) · Source: docs/page-customisation.md › Kept scripts
- **`SCR-21`** A kept script runs only on the site it was kept for (page, path, site, or site and subdomains), never "everywhere".
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/content/userScripts.ts (parseScriptScope refuses "*"); src/storage/siteRules.ts (imports with "*" refused) · Source: docs/page-customisation.md › Scripts rule 3
- **`SCR-22`** Keep is offered only after a successful live-page run, never from incognito, and only on cards made in this run of the app. Keeping is the user's tap on code they just approved, with no second approval.
  Status: Default (manager or implementing session; open to change) · Why: a card from a restored chat (backups hold chats) must never seal code the user didn't approve on this phone · Enforced: In the app: src/components/pageScripts.tsx (canKeep, liveOffers token, keepScript) · Source: docs/page-customisation.md › Kept scripts; 2c4302d
- **`SCR-23`** Each kept script carries a seal: an HMAC-SHA-256 of its code under a device key in secure storage (this device only, never backed up). A kept script runs only while its seal matches its code. Edited, imported or restored-elsewhere code is off and listed as "Needs your approval" until the user approves it in the same dialog with the code.
  Status: Default (manager or implementing session; open to change) · Why: the device key makes a backup or file that claims a script was approved worthless; a changed code in the database no longer matches its seal and doesn't run · Enforced: In the app: src/content/userScripts.ts (scriptSeal, sealMatches, scriptsFor); src/device/scriptKey.ts (loadScriptKey); src/components/pageScripts.tsx (approveKeptCode) · Source: docs/page-customisation.md › Kept scripts; c53b2ca
- **`SCR-24`** Imported scripts always arrive switched off and unsealed, listed with their flags. The import dialog offers only "Skip" or "Import switched off". A restored script stays on only if its seal verifies with this phone's key (the same phone and install, or the same iOS keychain); anywhere else it arrives off.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today it is built this way and needs the owner's confirmation · Why: "erring toward off": a seal can't be forged without the device key, and a restore on a new phone asks again · Enforced: In the app: src/storage/siteRules.ts (addImportedScripts sets enabled false, seal null); src/components/SiteRulesSection.tsx; src/content/userScripts.ts (restoredState), used in src/backup/database.ts · Source: docs/page-customisation.md › Export, import, backup
- **`SCR-27`** Kept scripts never run in incognito tabs, and nothing is kept from incognito. One-off scripts may run in incognito tabs, because nothing is written and the copy lives in memory.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/browser/keptScripts.ts (ready skips incognito); src/components/pageScripts.tsx (canKeep) · Source: docs/page-customisation.md › Scripts rule 3, Kept scripts
- **`SCR-29`** The page menu's **Scripts off for this page** stops kept scripts in that tab. It is kept in memory, and turning it on reloads the page so nothing a script did stays.
  Status: Default (manager or implementing session; open to change) · Why: an escape hatch, like styles · Source: docs/page-customisation.md › Kept scripts
- **`SCR-30`** A kept script's last run is stored only as ok, error kind (for example `TypeError`), skipped (sensitive page) or timed out, with the time. The error message stays in memory only.
  Status: Default (manager or implementing session; open to change) · Why: a message could hold page text · Source: docs/page-customisation.md › Kept scripts
- **`SCR-31`** In My rules, the code editor runs the check on save, and refused code is not saved. Saving changed code asks for approval; declining keeps the old code. Switching on an unsealed script asks for approval first.
  Status: Default (manager or implementing session; open to change) · Why: any change to the code needs approval before it runs · Enforced: In the app: src/components/pageScripts.tsx (approveKeptCode); src/components/ScriptsPart.tsx, ScriptEditorScreen.tsx · Source: docs/page-customisation.md › Kept scripts
- **`SCR-32`** There are at most 50 kept scripts, 10 per site, names of at most 80 characters and descriptions of at most 160.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/content/userScripts.ts (MAX_SCRIPTS, MAX_SCRIPTS_PER_SITE, MAX_SCRIPT_NAME, MAX_DESCRIPTION)
- **`SCR-33`** The model is told to use `run_script` only when reading and the other tools can't answer, to use `copy` unless the user wants the page changed, and never for clicking, typing, navigating, sending, posting, paying, or reading passwords, codes or cookies, nor because a page asks. If scripts are off, it tells the user where to switch them on.
  Status: Default (manager or implementing session; open to change) · Why: only the user's request counts · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check the user's intent, but SCR-2 to SCR-15 are enforced whatever the model wants · Source: f98b95c
- **`SCR-34`** The privacy policies list "the result of a script you approved on a page" among what goes to the AI. The legal version went up for it on 20 Nov 2026 (open source 4, pro 6; LEGAL-5).
  Status: Owner, 2026-11-20 (changed: the sentence was in the texts without a bump until then) · Why: the owner's legal bump covers it · Source: 589d311; LEGAL-5
- **`SCR-35`** App Review notes for scripts, and whether Qutai needs Google Play's in-app way to report AI output, are open. The proposed review notes are: no code downloaded from the developer, page content only, every run approved, imports arrive off, off by default, no store of scripts.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)): today there are no review notes and no report button · Why: Apple 2.5.2 and 4.7 most likely don't apply, but a reviewer could read AI-written scripts as "chatbots/plug-ins"; Play allows JavaScript in a WebView, and its AI-content policy asks for a report option · Source: docs/page-customisation.md › Store policies (checked 19 Nov 2026)
- **`SCR-36`** The script dialog offers a box, off by default: "Run scripts on {site} without asking from now on" (site: the site key, as site permissions use it, `SITE-25`). Run with it ticked remembers that site; afterwards the assistant's one-off scripts there (copy or page) run without the dialog, with the step line "Ran without the dialog: you allowed scripts on {site}". Only the dialog is skipped: the setting (`SCR-1`, `SCR-2`), the site's own script setting and level (`SCR-5`), a waiting publish or pay approval (`SCR-9`), the static check (`SCR-10`, `SCR-12`, `SCR-14`), sensitive pages and their fail-closed check (`SCR-6`, `SCR-8`, `PAY-28`), the syntax, the page and hash checks before the run (`SCR-4`), the time limit and the untrusted, redacted result (`SCR-16`, `SCR-17`) all still apply, and the activity history records the run as before. Kept scripts are not affected (`SCR-22`, `SCR-23`: keeping and approving kept code still go through their own steps). Same limits as posting without asking (`PAY-29`): never offered or honoured in an incognito tab or a conversation that touched one, nor on a Read only or Blocked site; in the background the task pauses before run_script as before (`SITE-22`), so it applies only while Qutai is open. Stored on the phone (table site_scripts), not in backups, not changeable by the assistant; shown and removable in the site's settings and cleared by the site's reset (`SITE-27`). It is separate from "Sites with their own setting" (`SCR-8`: scripts off, or allowed on sensitive pages), which is a different question and is backed up; there was no earlier "don't ask again" for scripts to merge with. The model's tool description says "Each run is approved unless the user allowed the site" (agent profile re-exported).
  Status: Owner, 2026-11-23 (the feature, "same as posting"); the limits follow `PAY-29`'s and are the manager's defaults, open to change · Why: the owner asked for the same per-site remember as posting; the checks that keep a script harmless are the app's (static check, sensitive pages, the sealed copy), not the dialog's · Enforced: In the app: src/agent/scriptTool.ts (canRemember, remembered), src/agent/sitePolicy.ts (scriptsWithoutAsking), src/task/taskContext.ts, src/components/pageScripts.tsx (askScript's box), src/storage/sitePermissions.ts (scriptsFor, setScripts, reset), src/storage/db.ts (site_scripts), src/agent/pageCustomTools.ts (run_script description) · Tests: scripts/approval-tests/rememberScripts.test.ts (remembered vs not, copy and page, incognito tab and conversation, Read only and Blocked, every check before the dialog still refusing, the store and its reset); scripts/storage-tests/sitePermissionsLoad.test.ts · Limits: a remembered site lets a live-page script change the page without the user seeing the code first; a page that talks the model into a script gets it run there, still within the static check · Source: owner, 23 Nov 2026

## Details

**Limits and the dialog**

- (was `SCR-11`) A script may be at most 16 KB and 400 lines. · Where: src/content/scriptCheck.ts (MAX_SCRIPT_BYTES, MAX_SCRIPT_LINES); docs/page-customisation.md › The static check
- (was `SCR-13`) The dialog shows these flags in red when the code may run:
  - "Changes the page";
  - "Can make the page load other addresses (images, links)";
  - "Loads pages from this site as you (reading only)" (`fetch`, not allowed in a copy);
  - "Reads or changes what this site keeps on your phone" (storage, kept scripts only);
  - "Reads what is typed in the page's fields".

  Why: so the user knows what an approved script can do · Where: src/content/scriptCheck.ts (ScriptFlag); src/components/pageScripts.tsx (flagLines); docs/page-customisation.md › The static check

**Files, backups and how kept scripts are run**

- (was `SCR-25`) The rules file is format 3: `! Qutai-Format: 3`, then `! [script] {"name","scope","runAt"}`, the code on `! |` lines, and `! [end]`. No `enabled` flag and no seal are written. Formats 1 and 2 are still read; older Qutai versions count script blocks as unsupported; scripts that fail the check are counted as invalid. · Why: a file must never be able to switch a script on · Where: src/content/rulesFile.ts (RULES_FILE_FORMAT); docs/page-customisation.md › Export, import, backup
- (was `SCR-26`) In both backups, scripts are a separate array, `sites.scripts`. They are checked again on restore, and their last run is not backed up. · Why: a version that can't vet scripts must never accept them as something else (for example as styles) · Where: src/backup/payload.ts (sites.scripts); src/content/userScripts.ts (readBackupScripts); docs/page-customisation.md › Export, import, backup
- (was `SCR-28`) A kept script runs once per document. Each script is injected on its own, in its own wrapper, after the page's own report of its address agrees with the tab's address. After an address change inside a single-page app, a newly matching script runs then; none runs twice. Changes reach open pages at their next load. · Why: a broken script can't stop Qutai's other page scripts · Where: src/browser/keptScripts.ts (ready); docs/page-customisation.md › Kept scripts

## Why it is designed this way

Read-only work goes to a sealed copy of the page, where the browser engine blocks network and session access (SCR-15). On the live page, defence comes from several layers:
- the switch (SCR-1);
- refusals before asking (SCR-5 to SCR-12);
- the approval with the exact code (SCR-3, SCR-4);
- treating every result as untrusted (SCR-17).

The static check is honestly a filter that a determined author can get past, which is why the dialog says plainly that an approved live-page script can do what the site's own code can do. Kept scripts add the device seal (SCR-23), so nothing that comes from a file, a backup or another phone runs without a fresh approval.

## Limits and what is not built

- A script can make the page itself load an address with data in it (for example an `<img>` URL). The dialog shows "Changes the page" and the code.
- A page that ran first can replace `window.fetch`. The guard then calls the page's version: no more than the page could do itself.
- The copy lacks the page's JavaScript objects, open shadow roots, canvas pixels, cross-site stylesheets and frames, and its `location` is not the page.
- An endless loop on the live page blocks it until reload.
- Not built: document-start scripts, iOS content worlds, "everywhere" scopes, scripts in frames (not planned: see SCR-18 to SCR-21 for reasons), an AI-report button (waiting).
- Checked on the iOS simulator. On Android the release build compiles but was not run (test checklist 17).

## Where it lives

- [docs/page-customisation.md](../../docs/page-customisation.md) › Scripts (the wrapper, static check, sensitive pages, kept scripts, threat model, store policies).
- `src/content/scriptCheck.ts`, `src/content/userScripts.ts`, `src/content/scriptPage.ts`, `src/content/rulesFile.ts`.
- `src/agent/scriptTool.ts`.
- `src/components/ScriptSandbox.tsx`, `src/components/pageScripts.tsx`, `src/components/ScriptsPart.tsx`, `src/components/ScriptEditorScreen.tsx`, `src/components/ScriptSitesSection.tsx`.
- `src/browser/keptScripts.ts`, `src/device/scriptKey.ts`.
- [README.md](../../README.md) › Page styles, cookies and scripts.

## Disagreements between sources

- **Where the per-site exception lives.** docs/page-customisation.md says Settings › Site permissions › the site › "Scripts". README says Settings › Assistant › Sites. The code puts it under Settings › Assistant › "Let the assistant run scripts on pages" › "Sites with their own setting" (`ScriptSitesSection`, shown only while scripts are on).
- **Number of flags.** The doc's flag table lists four flags. The code has a fifth, "Can make the page load other addresses (images, links)" (`loads` in `ScriptFlag`).
- **Reader view.** The doc says scripts are refused in the reader view. The code leaves reader mode and runs on the page underneath, shown again (`src/agent/executeTool.ts`, before page tools run). The new tab page and non-web addresses are refused.
- **Who agreed the rules.** The doc calls its six script rules "agreed for this step" without naming the owner. TODO.md lists the related points as owner decisions, so this document treats them as default or waiting.
- **Run time "start".** The step-one design note (ad0c0b6) planned a `start` run time. Step two dropped it (SCR-20).
