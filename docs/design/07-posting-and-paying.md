# 7. Posting and paying

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

How the assistant posts, comments, sends messages on a site and completes a payment: always through Qutai's own
approval dialog, one press at a time, and payments only when the user switched them on.

## How it works

1. The user asks: "comment 'Great video' on this video". The assistant types the text into the comment box, then asks
   for approval (`request_approval`, kind "publish") right before pressing the site's button.
2. Qutai reads the comment box itself. If what the box shows differs from what the model says it typed, nothing is
   asked. Otherwise Qutai's dialog appears: "Comment on youtube.com?", the exact text (or a form's filled values),
   which button on the page Qutai will press once, and that only this dialog can approve. Buttons: Cancel / Approve.
3. Approve allows ONE press of that button, in that tab, on that page, during this task. Just before the press Qutai
   reads the page again; if the page or the text changed, nothing is pressed and the assistant must ask again. No
   second "are you sure?" in the chat.
4. If the assistant tries to press "Post" or Enter after typing its own text without an approval, Qutai refuses the
   press and tells it to ask first. This is judged by context (the button belongs to the field's form or composer),
   not by the button's words, so searches, filters, sign-in, codes and quantities are not affected.
5. Payments: Settings › Assistant › "Let the assistant complete payments" is off by default. Off: the assistant fills
   the cart and checkout, then stops and tells the user which button to press ("Place your order"); pressing a final
   payment button is refused in the app. On (turning it on asks once more, "Let the assistant pay?"): the final step
   needs the pay dialog: "Pay €24.99 on shop.example?", the total and the page line it was found on ("Order total:
   €24.99"), the order, the payment method as the page names it ("Visa ending 4242"), and any subscription or renewal.
   Approve allows one press; if the total changed, nothing is pressed.

## The rules

- **`PAY-1`** Posting, commenting, replying, reviewing, sending a message or an email on a site, or submitting a public form needs Qutai's publish dialog right before the site's button is pressed; that dialog is the confirmation, with no extra question in the chat.
  Status: Default (manager or implementing session; open to change); built on the owner's request of 2026-11-18 that the assistant actually post after approval · Why: a "yes" given in the chat arrived as an ordinary user message, "indistinguishable from page text", and "Ask before every action" asked a second time · Enforced: In the app: src/agent/approvalTool.ts (requestApprovalTool); App.tsx (askOutward) · Source: 4d97c4d; README › Posting and paying; docs/test-checklist.md (18 Nov)
- **`PAY-2`** The publish dialog shows what Qutai reads on the page (the field's exact text, or the form's filled values), never only the model's claim; if the model's text differs from the field, nothing is asked.
  Status: Default (manager or implementing session; open to change) · Why: the user must approve what will really be sent · Enforced: In the app: src/agent/approvalTool.ts (requestApprovalTool); src/agent/outwardApproval.ts (sameText) · Source: 4d97c4d
- **`PAY-3`** An approval allows one press of one button, in one tab, on one page address (without its #fragment), during one task; a newer approval in the same tab replaces the older one; the press uses it up.
  Status: Default (manager or implementing session; open to change) · Why: "Nothing a page says can create one: only the dialog does" · Enforced: In the app: src/agent/outwardApproval.ts (ApprovalGrants); src/agent/runAgent.ts (one set of grants per message) · Source: 4d97c4d
- **`PAY-4`** Just before an approved press, Qutai checks the page again: same page, same text or form values, the total still on its line, payments still on; otherwise nothing is pressed and the assistant must ask again.
  Status: Default (manager or implementing session; open to change) · Why: the page could change between the dialog and the press · Enforced: In the app: src/agent/outwardApproval.ts (checkPress); src/agent/approvalTool.ts (pressGate) · Source: 4d97c4d
- **`PAY-5`** Settings › Assistant › "Let the assistant complete payments" is off by default.
  Status: Owner, 2026-11-19 · Why: it is "the only feature that spends real money"; the frame explained to the owner on 18 Nov: Qutai's own dialog for every payment, no "don't ask again", card data and codes never to the assistant, off by default · Enforced: In the app: src/storage/settings.ts (DEFAULT_SETTINGS.assistantPayments) · Source: TODO.md › Assistant posting and paying; docs/test-checklist.md (18 Nov)
- **`PAY-6`** Turning payments on asks once more; turning them off never asks.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/components/SettingsModal.tsx (payments switch) · Source: 4d97c4d
- **`PAY-7`** The payments setting is not restored from a backup and can't be changed by the assistant.
  Status: Default (manager or implementing session; open to change) · Why: the assistant, or an old file, must not give the right to spend money · Enforced: In the app: absent from src/backup/backup.ts and from src/agent/settingsTool.ts (CHANGEABLE) · Source: 4d97c4d
- **`PAY-8`** With payments off, pressing a final payment button is refused and the assistant tells the user the order is ready and which button to press; it does not ask in the chat for permission to pay.
  Status: Default (manager or implementing session; open to change) · Why: a chat "yes" can't let it pay · Enforced: In the app: src/agent/approvalTool.ts (pressGate, paymentsOff); src/agent/outwardApproval.ts (paymentsOffText) · Source: 4d97c4d
- **`PAY-9`** Pressing the final payment button without an approval is refused in the app, whatever the prompt said; tapping it by screen position is always refused. Qutai recognises it by its label ("Pay", "Pay €24.99", "Place your order", "Siparişi onayla", "注文を確定する"…, ten languages) or, since 19 Nov 2026, by context, so a relabelled or icon-only button is caught too: on a payment step (card or security-code fields, a payment provider's frame, or a payment method choice in the form) it submits the form with the payment details; or it is that step's forward button ("Continue", "Devam et", an icon, an amount) and the page shows a total; or its label is an amount on a checkout address with a total. A checkout step without payment details ("Continue to delivery"), coupon, back and edit buttons, links and menu openers don't count. Limits: a payment button inside a payment provider's frame can't be pressed by Qutai anyway; a one-tap buy on a product page with an unusual label and no total or payment form is caught only by the prompt.
  Status: Default (manager or implementing session; open to change) · Why: only a press by element reference can carry an approval; a page can relabel its button, so the label alone was not enough · Enforced: In the app: src/agent/approvalTool.ts (pressGate), src/agent/pressContext.ts (payPress), src/browser/pageScript.ts (pressContext), src/agent/outwardApproval.ts (isFinalPaymentLabel, PAY_BY_POINT_TEXT); tested in scripts/approval-tests/pressContext.test.ts and scripts/page-tests/guards.html · Source: 4d97c4d; 19 Nov 2026 security pass
- **`PAY-11`** The pay dialog shows the site, the total exactly as found on the page and the line it is on, the order, the payment method as the page names it, and any subscription or renewal; a total not on the page as written is refused.
  Status: Default (manager or implementing session; open to change) · Why: what the user approves is read by Qutai, not taken from the model · Enforced: In the app: src/agent/approvalTool.ts (requestApprovalTool); App.tsx (askOutward) · Source: 4d97c4d
- **`PAY-12`** The payments setting is read again when the dialog closes and before the press; turned off meanwhile, nothing is paid.
  Status: Default (manager or implementing session; open to change) · Why: the user may turn it off during a task · Enforced: In the app: src/agent/approvalTool.ts; src/agent/outwardApproval.ts (checkPress) · Source: 4d97c4d
- **`PAY-13`** Both dialogs are shown every time: never "Don't ask again", whatever the site's permission.
  Status: Default (manager or implementing session; open to change) · Why: part of the frame explained to the owner on 18 Nov · Enforced: In the app: App.tsx (askOutward has no box) · Source: 4d97c4d; docs/test-checklist.md (18 Nov)
- **`PAY-14`** Read only and Blocked sites never reach the dialog.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/sitePolicy.ts (WRITE_ACTIONS includes request_approval) · Source: 4d97c4d
- **`PAY-15`** There is no spending limit per payment or per currency.
  Status: Owner, 2026-11-19 · Why: "totals come in any currency and Qutai has no exchange rates" · Enforced: Designed, not built (deliberately) · Source: TODO.md › Assistant posting and paying; README › Posting and paying
- **`PAY-16`** The pay dialog shows no picture of the order summary.
  Status: Owner, 2026-11-19 · Why: "not asked for, left out" · Source: TODO.md › Assistant posting and paying
- **`PAY-17`** A press that would send free text the assistant typed during the task (a comment, reply, review, message, a contact form's message), or Enter in that field, is refused until a publish approval covers it; recognised by context, not by the button's words.
  Status: Default (manager or implementing session; open to change); TODO records it as "decided 19 Nov 2026 (by the manager, for the owner)" · Why: words mislead ("Send code", "Post" in a menu) · Enforced: In the app: src/agent/approvalTool.ts (pressGate, enterGate); src/agent/outwardApproval.ts (contentToApprove) · Source: 67a7b4b; cfd0f29
- **`PAY-23`** Scripts are refused in a tab while a publish or pay approval waits there.
  Status: Default (manager or implementing session; open to change) · Why: a script must not act between the approval and the press · Enforced: In the app: src/agent/outwardApproval.ts (ApprovalGrants.hasTab); src/agent/scriptTool.ts · Source: 0aecab6
- **`PAY-24`** Before a purchase or sign-up the assistant names any subscription, automatic renewal, free trial turning paid, minimum term or cancellation condition, and never leaves a pre-ticked paid add-on, insurance, donation or marketing consent ticked without telling the user; it mentions a coupon field and tries at most three codes, never in bulk.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: Prompt only: src/agent/systemPrompt.ts; the app does not check it (page text marks "(checked, pre-ticked)" boxes) · Source: README
- **`PAY-25`** The activity history records only what was asked (post, comment, pay), never the text or the total.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/agent/executeTool.ts (LOGGED_TOOLS) · Source: 4d97c4d

- **`PAY-26`** Deleting something, or changing account or security settings on a site, needs Qutai's own approval: `request_approval` kind "change" with an action (`delete`; `account`: email, phone, payment methods, privacy, other settings; `security`: password, two-factor, signing out everywhere, closing the account). The dialog shows what Qutai reads on the page (the button, the page's or dialog's heading, the page's own confirm dialog text, the list row or card the button is in, the form's values with secrets as "(filled)"), never "Don't ask again". The approval is one press of that button, in that tab, on that page, in that task, refused when the page, the button's label, the dialog's text or the form changed. A press Qutai recognises as such without an approval is refused, by ref or by screen position: its label says delete (remove only with a destructive style, in a dialog or on an account page); it confirms a dialog on the page that says delete or "can't be undone"; it is the destructive button of a warning dialog; its label or the dialog names a password, two-factor, signing out everywhere or closing the account; it submits a form that sets a new password (not a sign-up); or, on an account or settings address, it saves a form with an email, phone, card or password field, flips a switch, or saves privacy settings. Cancel buttons, menu openers, links, a cart's Remove, sign-in and sign-up don't count. With "Ask before every action" on, the approved press is not asked again. Limits: a change that saves by itself with no label, dialog, style, form or address that says what it does (a select menu that saves on change, an unlabelled icon) is caught only by the prompt, which tells the model to use this approval.
  Status: Default (19 Nov 2026 security pass; the owner asked for app approval instead of a chat question) · Why: nothing irreversible without the app's own approval; page content can never grant approval · Enforced: In the app: src/agent/approvalTool.ts (requestApprovalTool, pressGate), src/agent/pressContext.ts (changePress), src/agent/outwardApproval.ts (checkPress, changeNeedsApprovalText), src/browser/pageScript.ts (pressContext, changeInfo), App.tsx (askOutward); tested in scripts/approval-tests/pressContext.test.ts and scripts/page-tests/guards.html (34/34 in Chromium) · Source: 19 Nov 2026 security pass

## Details

**How a final payment button is recognised**

- (was `PAY-10`) Final payment labels are recognised in the ten app languages as a whole-label match (amounts and currency signs or codes around them ignored); Japanese and Korean labels are found inside the text. · Where: In the app: src/agent/outwardApproval.ts (PAY_WORDS, PAY_PARTS) · 4d97c4d

**How sending free text is recognised**

- (was `PAY-18`) A press counts as sending when the button is in the field's form, or joins the field at most six levels up in a box with at most three text fields; Enter is refused before anything is typed. · Where: In the app: src/browser/pageScript.ts (typedFields, pressComposed, enterFacts) · 67a7b4b
- (was `PAY-19`) Free text means a text area or editor, or a one-line text field with at least two words and twelve characters and no length limit of 40 or less. · Why: "Errs towards not asking" · Where: In the app: src/agent/outwardApproval.ts (isPublicText) · 67a7b4b
- (was `PAY-20`) Never counted as free text: non-text fields, search boxes and lists, anything in a search area or a GET form, forms with a password field, fields marked for names, addresses, sign-in, codes or card data, non-text keyboards, and fields whose name or label says search, filter, code, coupon, quantity, login, email, phone or delivery/order note (ten languages). · Why: these send nothing to an audience · Where: In the app: src/agent/outwardApproval.ts (PRIVATE_AUTOCOMPLETE, NOT_PUBLIC_HINT, NOT_PUBLIC_PARTS) · 67a7b4b
- (was `PAY-21`) Presses that send nothing are left alone: links, toggles and menus, the field itself, reset, and buttons starting with cancel, close, delete, attach, emoji, bold, preview, edit, more… (ten languages). · Where: In the app: src/agent/outwardApproval.ts (NOT_SEND_LABEL, contentToApprove) · 67a7b4b
- (was `PAY-22`) When Enter is the only way to send, the approval names the field itself as the button; the assistant then types the same text again with Enter. · Where: In the app: src/agent/approvalTool.ts (enterGate) · 67a7b4b

## Why it is designed this way

On 18 Nov the owner asked that the assistant really post and really pay after approval. The cause was partly the page
script (seven of ten test cases failed to type or tap) and partly that approval was a chat question. The fix makes the
approval a dialog Qutai draws with what it read on the page, and makes the app, not the model, refuse the risky
presses. Payments stay off unless the user turns them on, and are approved one by one.

## Limits and what is not built

- Final payment buttons are recognised by their label only; a final button labelled "Continue", "Submit" or an icon is
  not caught by the app, and only the prompt applies there (publish-button recognition by label: not built).
- Payment forms inside frames from another site can't be read at all.
- A form sent without free text is not treated as publishing. Fields the assistant typed into are remembered for the
  page's life, not only the task.
- A button that checks that the tap came from a real finger (`isTrusted`) can't be pressed by any page script.
- Not checked on a phone with real models yet (manual test list in [docs/test-checklist.md](../../docs/test-checklist.md)).

## Where it lives

- `src/agent/outwardApproval.ts`, `src/agent/approvalTool.ts`, `src/agent/executeTool.ts`, `App.tsx` (`askOutward`),
  `src/components/SettingsModal.tsx`, `src/browser/pageScript.ts`, `scripts/page-tests/`.
- Read next: README › Posting and paying.

## Disagreements between sources

- TODO.md lists the send-by-context rule (`PAY-17`) with the owner's decisions but says it was decided "by the
  manager, for the owner"; the other four 19 Nov items are recorded as decided without the owner's own words.
