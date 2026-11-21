# 46. Reporting answers and apps

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

A user can report an assistant answer or an app made in Qutai from its ⋮ menu (Report). Google Play's AI-generated content policy asks for a way to report offensive AI output without leaving the app, and Apple's guidelines 1.2 and 4.7 ask apps with generated content and mini apps for a way to report content and a timely response (docs/store-review-risks.md › 1.1 and 2.2). Reports go to Qutai's server, and the owner reads and resolves them in the admin panel.

## How it works

1. **Where.** The ⋮ menu under an assistant answer (and the long-press menu) has Report. So do an app's menu in My apps and the ⋮ menu of a running app.
2. **The dialog.** One dialog: a title, one sentence saying the report goes to Qutai's team (with the account when signed in), the reason as radio rows (Offensive or hateful, Sexual content, Dangerous or harmful, Wrong or misleading, Other), and a box "Include the answer's text (it is sent to Qutai)" or, for an app, "Include the app's name and code (never its data; sent to Qutai)", ticked. Cancel or Send. "Other" then asks what is wrong (required). Nothing is sent before Send. Afterwards a dialog says it was sent, or why it failed.
3. **What is sent** (`POST /reports`): the kind (answer or app), the reason, the note (only for Other), the text only when the box was ticked (an answer as written, cut to 20 000 characters; an app's name and the files of its current version, never its data), whether the answer came from Qutai Credits or the user's own key, the app version, the platform and the interface language. Signed in, the request carries the access token and the report the account; signed out, it is anonymous.
4. **The server** (backend README › Reports) keeps reports in D1 table `reports` for 180 days. It checks every field, takes at most 20 reports a day per account and per sender address (the address only as a keyed hash), never logs the note or the text, and keeps a deleted account's reports without the account.
5. **The admin panel** has a Reports screen: open reports first, with the reason, the note, the text behind "Show reported text", the account and the facts above. Resolve asks for a reason and is written to the audit log (`report.resolve`).

## The rules

- **`SAFE-1`** Every assistant answer and every app has ⋮ › Report in builds with Qutai's server (pro mode with a server address). Builds without a server show no Report, because no one would receive it.
  Status: Owner, 2026-11-21 ("bildirim … planla ve uygula", after the store review report) · Why: Google Play AI-Generated Content (in-app reporting of offensive output), Apple 1.2 and 4.7.1 · Enforced: In the app: src/report/report.ts (`reportsAvailable`), src/components/AssistantPanel.tsx (`menuActions`), src/components/MyApps.tsx, src/components/AppRunner.tsx
- **`SAFE-2`** Reporting is one dialog with the reason and an "Include the text" box, ticked, that says the text goes to Qutai; "Other" asks for a note; nothing is sent before Send.
  Status: Default (manager or implementing session; open to change) · Why: the reported text is what the team needs to act, but it leaves the phone, so the box says so and can be unticked · Enforced: In the app: src/components/reportFlow.ts
- **`SAFE-3`** An app's report includes, when ticked, its name and the files of its current version, never its data.
  Status: Default (manager or implementing session; open to change) · Why: the code is what may be harmful; the data is the user's own · Enforced: In the app: src/components/reportFlow.ts (`reportApp`)
- **`SAFE-4`** A report carries only the kind, reason, note (Other only), the text when ticked (at most 20 000 characters), Qutai Credits or own key, app version, platform and interface language; signed in also the account, signed out nothing that names the user. A token that is sent must be live.
  Status: Default (manager or implementing session; open to change) · Why: own-key users may never sign in and must still be able to report; nothing else from the conversation or page is needed · Enforced: In the app: src/report/body.ts (`reportBody`) · Server: backend apps/api/src/routes/reports.ts · Tests: scripts/credits-tests/report-body.test.ts; backend apps/api/test/reports.test.ts
- **`SAFE-5`** The server takes at most 20 reports a day per account and per sender address (stored only as a keyed hash), keeps reports 180 days, never logs the note or the text, and keeps a deleted account's reports without the account.
  Status: Default (manager or implementing session; open to change) · Why: a report form open to signed-out users needs a cap; the text can be personal · Enforced: Server: backend apps/api/src/routes/reports.ts, apps/api/migrations/0014_reports.sql (`ON DELETE SET NULL`), apps/api/src/index.ts (cron) · Tests: backend apps/api/test/reports.test.ts
- **`SAFE-6`** The admin panel lists reports (open first) and resolving one asks for a reason and is audited.
  Status: Default (manager or implementing session; open to change) · Why: Apple 1.2 asks for timely responses; the audit says who handled what · Enforced: Server: backend apps/admin/worker/api/reports.ts, apps/admin/src/screens/Reports.tsx · Tests: backend apps/admin/test/actions.test.ts › reports
- **`SAFE-7`** Today nobody is alerted when a report arrives; the owner reads the panel's Reports screen.
  Status: Default (manager or implementing session; open to change) · Why: few reports are expected before launch; an alert (the existing alert webhook) can follow

## Limits and what is not built

- No blocking of other users: Qutai has no content shared between users (apps are shared only as files the user sends).
- No reply to the reporter in the app; signed-in reporters can be reached through their account's address.

## Where it lives

- App: src/report/report.ts, src/report/body.ts, src/components/reportFlow.ts; strings `report.*` in src/i18n/*.ts
- Server: backend apps/api/src/routes/reports.ts, apps/api/migrations/0014_reports.sql, packages/shared/src/reports.ts; admin apps/admin/worker/api/reports.ts, apps/admin/src/screens/Reports.tsx
- Privacy policy (pro, ten languages): "What leaves your phone" › reports (`LEGAL-20`)
