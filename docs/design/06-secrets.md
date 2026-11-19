# 6. Passwords, card numbers and one-time codes

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

What the assistant does with secrets: passwords, one-time codes, card numbers and security codes, bank checks, and
sign-in pages. Read the "Enforced" field carefully: only card numbers are blocked by the app; the rest is a rule the
model is told.

## How it works

1. The assistant is told never to type passwords, one-time codes, card numbers or security codes, never to change a
   payment method or delivery address on its own, and to leave sign-ins and bank checks (3-D Secure) to the user: it
   asks the user to do them and to say when they are done.
2. The app blocks one of these for certain: if the assistant tries to type text containing a payment card number,
   Qutai refuses and types nothing ("That looks like a payment card number. Qutai never types card numbers…").
3. Password values never reach the model: the page text shows a password field only as "(filled)", and the posting
   dialog shows passwords as "(filled)" and refuses a password field as the text to send.
4. Memory never stores passwords, PINs, one-time codes, card numbers, card security codes, card expiry dates or bank
   account numbers (IBAN), even if the user asks. An ID or passport number is stored as a hidden value that Qutai
   types itself after asking ([section 5](05-site-permissions.md)).
5. On a sign-in page, the assistant hands the login to the user. Scripts are refused on sign-in, payment and bank pages
   unless the user allowed scripts there.
6. Example: "log in to my bank and pay this bill" → the assistant opens the page and asks the user to sign in and
   confirm with their bank; it never types the password or the SMS code.

## The rules

- **`SEC-1`** Typing text that contains a payment card number (13 to 19 digits, spaced or dashed, passing the Luhn check) is refused and nothing is typed.
  Status: Default (manager or implementing session; open to change) · Why: "Qutai never types a payment card number, whatever the model was told" · Enforced: In the app: src/agent/executeTool.ts (executeUnredacted); src/agent/outwardApproval.ts (containsCardNumber, CARD_NUMBER_TEXT) · Source: 4d97c4d; README › Posting and paying
- **`SEC-2`** The assistant never types passwords, one-time codes, card numbers or security codes, never changes a payment method or delivery address on its own, and leaves sign-ins and bank checks (3-D Secure) to the user. Since 19 Nov 2026 the app refuses `type` into such a field, whatever the text and also for hidden values, and tells the model to ask the user to fill it in themselves (never for the value). A field counts as secret by its type (`password`), autocomplete (`current-password`, `new-password`, `one-time-code`, `cc-number`, `cc-csc`), a masking style (`-webkit-text-security`), the words around it in the ten languages (name, id, placeholder, label, aria-label, and those of custom elements and shadow hosts around it), split code boxes (four or more one-character boxes), or a short numeric field named a code (4–8 characters); promo, postal, phone, quantity, order and similar fields never count. Changing a payment method or a delivery address is covered by the app's change approval (`UNTR-19`) where Qutai recognises it.
  Status: Default (manager or implementing session; open to change); the 18 Nov frame explained to the owner said card data and verification codes never go to the assistant · Why: the AI gets labels, never secrets (owner principle) · Enforced: In the app: src/browser/pageScript.ts (secretKind, secretFacts, secretField), src/agent/executeTool.ts (executeUnredacted, before any typing), src/agent/outwardApproval.ts (secretFieldText); tested in scripts/approval-tests/secretFields.test.ts and scripts/page-tests/guards.html. Limits: a field with no type, autocomplete, words or code shape (an unlabelled box) is not recognised, and the model's own wording then remains the guard; sign-ins and 3-D Secure stay prompt-only (the model cannot type the password anyway) · Source: f575c25; docs/test-checklist.md (18 Nov payment request); 19 Nov 2026 security pass
- **`SEC-3`** The value of a secret field (`SEC-2`: password, one-time code, card number, security code) is never shown to the model: page text shows "(… field: only the user fills it in) (filled)", typing echoes nothing back, form values in an approval show "(filled)", the copy a script runs on has no value, and a screenshot makes filled code, card and security-code fields transparent (the browser masks passwords itself). Extended 19 Nov 2026 from password fields only.
  Status: Default (manager or implementing session; open to change) · Why: the AI gets labels, never secrets · Enforced: In the app: src/browser/pageScript.ts (describe, type, fieldText, formValues, snapshotHtml, secretFieldIndices), src/agent/executeTool.ts (maskHiddenForCapture) · Source: 4d97c4d; 19 Nov 2026 security pass
- **`SEC-4`** A password field can never be the text of a posting approval.
  Status: Default (manager or implementing session; open to change) · Why: "it is never sent with an approval" · Enforced: In the app: src/agent/approvalTool.ts (requestApprovalTool, fieldText secret) · Source: 4d97c4d
- **`SEC-5`** The payment method named in a payment approval may never be a card number.
  Status: Default (manager or implementing session; open to change) · Why: the dialog names the method as the page does ("Visa ending 4242") · Enforced: In the app: src/agent/outwardApproval.ts (parseApprovalInput) · Source: 4d97c4d
- **`SEC-6`** Memory refuses passwords, passcodes and PINs, card security codes, one-time codes, card expiry dates, card numbers and IBANs in every category, and ID or passport numbers outside the identity and travel categories, even if the user asks.
  Status: Default (manager or implementing session; open to change) · Why: "shopping never needs" a bank account number "and a leak of it is costly" · Enforced: In the app: src/agent/memory.ts (sensitiveReason) · Source: 09f1190
- **`SEC-7`** ID and passport numbers the user saves become hidden values: the model sees only a label and Qutai types the value itself, on https only, after a question per value, site and task.
  Status: Default (manager or implementing session; open to change) · Why: the AI never sees the value · Enforced: In the app: src/agent/executeTool.ts (hiddenGate); src/agent/hiddenValues.ts · Source: 530b106
- **`SEC-8`** Scripts are refused on pages with a password, one-time-code or card field, and on sign-in, payment and bank addresses, unless the user allowed scripts on that site's sensitive pages.
  Status: Default (manager or implementing session; open to change) · Why: scripts there could read secrets or act as the user · Enforced: In the app: src/content/userScripts.ts (sensitivePage); src/agent/scriptTool.ts · Source: 0aecab6; docs/page-customisation.md › Sensitive pages
- **`SEC-9`** Today the sensitive-page lists are a starting set: payment and sign-in hosts, a short bank list (banks in Türkiye included), any host label containing bank/banka/banco/banque, and path words such as login, checkout, otp.
  Status: Waiting for the owner ([TODO.md](../../TODO.md#decisions-waiting-for-the-owner-collected-17-nov-2026)) · Why: the lists "are a start: extend for the markets you target" · Enforced: In the app: src/content/userScripts.ts (PAYMENT_HOSTS, SIGN_IN_HOSTS, BANK_HOSTS, SENSITIVE_PATH) · Source: TODO.md › Page customisation, step two (scripts) — owner decisions
- **`SEC-10`** Scripts may not read cookies, storage or passwords.
  Status: Default (manager or implementing session; open to change) · Why: session cookies leaking was named the main risk of scripts · Enforced: In the app: src/content/scriptCheck.ts (static check) · Source: 0aecab6
- **`SEC-11`** Cookie values never go to the AI: the assistant gets cookie names, domains, paths, expiry, size and flags only.
  Status: Default (manager or implementing session; open to change) · Why: values can be sign-in sessions · Enforced: In the app: src/content/cookieInfo.ts (cookieMetadata) · Source: 496320b; docs/page-customisation.md › Cookies
- **`SEC-12`** An email sign-in link opened inside Qutai is never loaded as a page, so its token never becomes a tab, a history entry, page text for the assistant or a line in "What was sent to the AI".
  Status: Default (manager or implementing session; open to change) · Why: keep the token out of history, logs and the AI · Enforced: In the app: src/components/AccountLinks.tsx (takeSignInLink); src/device/entryPoints.ts (entryFromAppLink skips sign-in links) · Source: docs/app-links.md › How the token stays out of history, logs and the AI
- **`SEC-13`** Qutai has no password manager of its own; the phone's own autofill is relied on.
  Status: Default (manager or implementing session; open to change) · Why: "The security risk and responsibility are too great; iOS and Android system autofill works in the WebView" · Source: ROADMAP.md › 3. Things we recommend not doing

## Details

None: every item in this area stays a rule.

## Limits and what is not built

- Only card numbers are blocked in code. Passwords, one-time codes, security codes, addresses and payment-method
  changes depend on the model following the prompt (planned: not recorded).
- A card number typed in pieces across several fields is not caught (each piece is too short).
- Sign-in pages have no app-level block for clicking and typing; only scripts are refused there.

## Where it lives

- `src/agent/outwardApproval.ts` (card numbers), `src/agent/executeTool.ts`, `src/agent/memory.ts`,
  `src/agent/hiddenValues.ts`, `src/content/userScripts.ts`, `src/browser/pageScript.ts`, `src/agent/systemPrompt.ts`.
- Read next: [docs/page-customisation.md](../../docs/page-customisation.md) › Scripts, [docs/app-links.md](../../docs/app-links.md).

## Disagreements between sources

