# History before the design document

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md)

The main design decisions and features in the order they landed, from `git log` (each commit message has the details). Changes after 19 Nov 2026 are in the changelog at the top of [DESIGN.md](../../DESIGN.md).

| Date | Commit | What was decided or added |
|---|---|---|
| 2026-11-13 | f575c25 | First browser agent: read, navigate, click and type tools; page content treated as untrusted data; asks before sensitive actions; never enters passwords; API key in secure storage |
| 2026-11-13 | d1223b4, 843b394 | Provider layer for Anthropic, OpenAI and Gemini; provider choice in settings |
| 2026-11-13 | 1b663ee | App named ALPAI (renamed Kutai in c632c8d, then Qutai in 949070c on 14 Nov) |
| 2026-11-13 | c407851 | To-do list with the security architecture for a paid credit system |
| 2026-11-13 | aafe153 | Decision: voice commands will use the phone's own speech recognition once on a custom build |
| 2026-11-14 | 941f140, b86129c, f7f6bfb | Roadmap in five phases; owner decisions: start with Phase 1, search suggestions on (off in private tabs), Turkish and English interface, AI search on by default |
| 2026-11-14 | 97af904 | Screenshots and screen recording blocked while private tabs are on screen |
| 2026-11-14 | 0df7b0e | Each tab has its own chat; one assistant task at a time; private chats never saved |
| 2026-11-14 | 09f1190 | Memory about the user: refuses passwords, PINs, one-time codes, CVVs and card numbers; at most 100 entries; on by default |
| 2026-11-14 | 7cab11d | AI search through the providers' own web search tools (at most 5 searches per task on Anthropic) |
| 2026-11-14 | 647fbd5 | Per-site assistant permissions (default, always allow, ask every action, read only, blocked) and activity history (30 days, 2000 entries, typed text never recorded) |
| 2026-11-14 | 07db6cc | Deep research mode (80 steps, 20 searches) and answers shared as PDF |
| 2026-11-14 | 4fb6a89 | Clear browsing data, HTTPS-only (off by default at first), third-party cookies blocked |
| 2026-11-14 | a365175 | App lock and private-tab lock with biometrics; QR code scanning and generation |
| 2026-11-14 | 72302a6 | Privacy Policy and Terms of Use in Turkish and English, legal version 1, marked as drafts for legal review |
| 2026-11-14 | 414e965 | First-run setup: intro, accept terms, AI, protection, default browser |
| 2026-11-14 | a7884fd, e966c69 | Apache-2.0 licence; TRADEMARKS.md (the licence does not cover the name and logo) |
| 2026-11-14 | 7d65220 | Pro mode switch: official builds use Qutai's servers, builds from the repository use the user's own key; `.env` git-ignored |
| 2026-11-14 | 7df4849 | Move to development builds (app ids, dev client); native folders git-ignored |
| 2026-11-14 | 7eae6a1 | Password-encrypted backup file (XChaCha20-Poly1305, scrypt); AI keys only on explicit opt-in |
| 2026-11-14 | ee5960d | "What was sent to the AI": every request logged in one place; the API key is never read into the log |
| 2026-11-14 | dc01c39 | The app declares exactly the permissions it uses; docs/permissions.md |
| 2026-11-14 | 1d5f0d5 | EAS build profiles, all with pro mode off, and a submit skeleton (version numbers then kept by EAS) |
| 2026-11-14 | 1dccda2 | Server platform decided: Cloudflare Workers, one Durable Object per user, D1, R2 later |
| 2026-11-14 | 86eace5 | Android incognito tabs get their own WebView profile, cleared when the last one closes |
| 2026-11-14 | e677bac | Network-level ad and tracker blocking from filter lists the user picks, downloaded only after the terms are accepted |
| 2026-11-14 | e090b66 | Page media keeps playing in the background; Android picture-in-picture |
| 2026-11-14 | 0b5f332 | Android "Keep working in the background" for assistant tasks (opt-in, off by default) |
| 2026-11-14 | 849029b, e7414e3 | Custom instructions placed below the safety rules; per-site question before personal details are typed |
| 2026-11-14 | 821b40d, a74e1b5, d09f015 | OpenRouter and custom OpenAI-compatible endpoints as providers; model chosen per conversation |
| 2026-11-14 | 530b106 | Hidden memories (ID and passport numbers) reach the AI only as a label |
| 2026-11-14 | 4d149d4, 33e911e, 670c6dd | Website in webpage/ with a sourced comparison of eight mobile browsers |
| 2026-11-15 | febcdb4 | The assistant may change appearance and browsing settings from the chat, never the protections |
| 2026-11-15 | 06b61bb | Local-network http pages work in release builds; certificate errors offer a session-only "Continue anyway" |
| 2026-11-15 | c4777c7, 2c54eb1 | Qutai's own downloads engine on Android instead of the system DownloadManager |
| 2026-11-15 | 2275af2 | Open source licences screen (Settings › About) |
| 2026-11-15 | d3395ba, e4f1bae | The server moves to its own repository, a submodule at backend/ |
| 2026-11-15 | 4184785 | Address bar at the bottom by default |
| 2026-11-15 | 2d44e7b | Owner decision: payments through RevenueCat behind a verifier interface (pricing and packs left open) |
| 2026-11-15 | d95ab3e | Pro accounts in the app: Sign in with Apple and Google |
| 2026-11-16 | 3d6b3f7 | Qutai Credits provider through the server relay, only in pro mode with a server address |
| 2026-11-16 | 0d0c889 | Pro setup leads with Qutai Credits; credits only while signed in |
| 2026-11-16 | 1e08428 | Pro mode gets its own privacy policy and terms (pro legal version 2) |
| 2026-11-16 | 19fdd63 | Turkish phone test checklist introduced |
| 2026-11-16 | 9cea977, ab94093 | Owner decision: Turkish text uses "siz"; the old "Always reply in Turkish" instruction removed once |
| 2026-11-16 | d9e446b | Open-source privacy policy corrected to what actually leaves the phone; legal version 2 |
| 2026-11-16 | c6ad335, 289a687 | "Don't ask again" for device-permission confirmations (six kinds); Deny is never remembered |
| 2026-11-16 | 8c04c18, 7695fc8, 987a196 | Site rules ("My rules"): hiding and blocking rules, proposed by the assistant with approval, in the backup, import and export |
| 2026-11-16 | e267272 | Step lines shown in the app's language; the model keeps the English result |
| 2026-11-16 | f4c7860, dd4c1a5 | Ten interface languages; Settings › Language |
| 2026-11-16 | bc2a261 | expo-dev-launcher patch for Xcode 27.0 |
| 2026-11-16 | 740ac38 | Android release signing with Qutai's own upload key through a config plugin |
| 2026-11-16 | 3e19603 | Owner's pro-mode test build commands; the tunnel address stays a placeholder |
| 2026-11-16 | bee158c, 2136951 | Sign-in by email on the server, with Mailjet as the sender |
| 2026-11-17 | e521581, c382a28 | Fake purchases as a temporary stand-in; "Before launch: remove fake purchases" checklist |
| 2026-11-17 | 488c3e0 | Own-key requests kept alive up to 3 minutes after leaving the app, so they are not billed twice |
| 2026-11-17 | bd6743e, d5c0f05 | Backups to the Qutai account; pro legal version 3 |
| 2026-11-17 | 94f9391 | Pro policy: who is responsible, contact, processors, retention, security; pro legal version 4 |
| 2026-11-17 | 06b800c | Website shows the app's privacy policy as its own page |
| 2026-11-17 | 784567b, bf46838 | Version rule (build = major*10000 + minor*100 + patch, bumped only on the owner's word); Version 0.1.0 (100); EAS takes numbers from app.json |
| 2026-11-17 | b563215, 9c5e1d8 | Server minimum app version seeded 0.1.0 after the 1.0.0 lock-out |
| 2026-11-17 | cdb3c1e | TODO "Decisions waiting for the owner" collected |
| 2026-11-17 | d83b3ef | Working mode: action marker, step strip with Stop, glow |
| 2026-11-17 | 0474a9d | Rotation unlocked (landscape); no in-app rotation lock |
| 2026-11-17 | 1c50bc1, 233f602 | Account sign-in methods: add, remove, merge accounts |
| 2026-11-17 | e971db7 | Trial assistant-look switch; the owner chose "curtain" as the default |
| 2026-11-17 | 68c58e7, 05fb72d | Local store package script (AAB and IPA, `-pro-mode` suffix) |
| 2026-11-17 | 8a128a4 | Version 0.1.1 (101) |
| 2026-11-18 | 370b877 … 78ff2fb | Owner's 18 Nov reports and feature requests noted in the checklist; fixes wait for "düzelt" |
| 2026-11-18 | ba63602 | Step lines name the element by its label and kind, never "ref 1" |
| 2026-11-19 | 291174a, 3fc70c0 | Faster Android listening; read-aloud uses the most natural installed voice ("level 1" chosen by the owner) |
| 2026-11-19 | 4d97c4d, 67a7b4b, cfd0f29 | Posting and paying through Qutai's own approval; "Let the assistant complete payments" off by default; sending assistant-typed text needs approval |
| 2026-11-19 | 2cc1a3d | Image filters on the phone; video editing postponed by the owner |
| 2026-11-19 | de0d0a2 | Contacts: find_contact; numbers and addresses never reach the AI |
| 2026-11-19 | 08b4da8, 496320b | User styles and the cookie list (cookie values never go to the AI) |
| 2026-11-19 | 040c537 | Owner raises legal versions: open source 3, pro 5 |
| 2026-11-19 | 2c4302d, 589d311 | User scripts (run_script, sealed kept scripts, off by default); policy wording added, legal version not raised |
| 2026-11-19 | 649a542, 394655f, 453107e | Apps inside Qutai, phase 1: own WebView, no network, each app on its own origin |
| 2026-11-19 | 3ed42cd | Design note for apps phase 2 (.qutaiapp import and export, backup) |
