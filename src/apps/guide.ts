import { LIMITS } from './contract';
import { APP_ICONS, AVAILABLE_PERMISSIONS, PACKAGE_LIMITS } from './manifest';

/**
 * What `apps guide` returns (docs/mini-apps.md › How the assistant builds an app): the contract and how to write a
 * good small app against it. Only fetched when the assistant is about to build or change an app, so other
 * conversations don't carry it. Plain English for the model; keep it tight.
 */
export const APP_GUIDE = `Qutai apps: guide and contract 1

WHAT AN APP IS
- Files: index.html (required), plus .css and .js files (flat names, lowercase, at most ${PACKAGE_LIMITS.files} files, ${PACKAGE_LIMITS.fileBytes / 1024} KB each, ${PACKAGE_LIMITS.totalBytes / 1024} KB in all). Use exactly index.html + style.css + app.js unless there is a reason. Link them with <link rel="stylesheet" href="style.css"> and <script src="app.js"></script> at the end of <body>; Qutai puts them inline.
- It runs offline in its own sandboxed WebView: NO network (fetch, XHR, WebSocket, CDNs, web fonts, external images all fail), no navigation or links to websites, no iframes, object or embed, no document.write, no forms that submit, no eval/new Function, no localStorage/IndexedDB/cookies. Images: inline SVG or data: URLs only. Plain JavaScript (modern syntax is fine), no frameworks, no imports or modules.
- The global object \`qutai\` (injected before your code) is the only way to the phone. Every call returns a Promise; failures reject with an Error that has .code.

STORAGE (all data must go here; it survives restarts; ${LIMITS.quotaBytes / 1024 / 1024} MB per app, one value or document at most ${LIMITS.valueBytes / 1024} KB)
- const notes = qutai.db('notes');  // a collection of documents (name: letters, digits, _ or -)
  await notes.add({ title, body })          → the document with id, createdAt, updatedAt (ms) added by Qutai
  await notes.get(id)                       → document or null
  await notes.update(id, { body })          → merged document (a field set to null is removed); E_NOT_FOUND if missing
  await notes.put(id, doc)                  → create or replace with your own id
  await notes.delete(id)                    → true/false
  await notes.query({ where, search, orderBy, limit, offset }) → { docs, total }
  await notes.all(query) → docs;  await notes.count(query);  await notes.clear()
  where: { done: false, prio: { gte: 2 }, tags: { contains: 'home' }, title: { startsWith: 'a' }, due: { exists: true } } (ops: eq ne lt lte gt gte in contains startsWith exists; an object value is always operators; dotted fields allowed)
  search: { text: 'milk bread', fields: ['title', 'body'] }  (every word must appear; case- and accent-insensitive, Turkish İ/ı handled)
  orderBy: 'title' or [{ field: 'updatedAt', dir: 'desc' }];  limit 1-500 (default 100)
- Key-value: await qutai.storage.get(key) / set(key, value) / remove(key) / keys(prefix) / getMany(keys) / setMany(obj) / usage()
- Atomic: await qutai.storage.batch([{ op: 'set', key, value }, { op: 'add', collection, doc }, { op: 'update', collection, id, patch }, { op: 'delete', collection, id }, { op: 'remove', key }]) - all or nothing.
- Always await writes before saying "saved". Data belongs to the app, not the version: a new version must read old documents (use defaults for missing fields, never rename stored fields).

UI
- Theme CSS variables (light/dark follow the phone): --qutai-bg --qutai-surface --qutai-sunken --qutai-text --qutai-text-secondary --qutai-tint --qutai-on-tint --qutai-danger --qutai-separator --qutai-border; safe areas --qutai-safe-bottom etc. Qutai's base CSS already sets body colours, a system font, 44px buttons and inputs, focus outlines. Use these variables, never fixed colours for text/background.
- Sizes in rem (the root size follows the phone's text size), layouts that wrap (flex-wrap, no fixed heights), long words wrap (overflow-wrap: anywhere). Works from 320px wide to tablets and landscape.
- qutai.ui.toast(text) (short), await qutai.ui.confirm({ title, message, confirmText, destructive: true }) → boolean, await qutai.ui.prompt({ title, label, initial }) → string or null, await qutai.ui.alert({ title, message }), qutai.ui.haptic('success'|'warning'|'error'|'selection'|'light'|'medium'|'heavy'), qutai.ui.setTitle(text).
- Back button: when a screen inside the app is open (an editor), call qutai.ui.setBackHandler(true) and qutai.on('back', close); set it false when back on the main screen.
- qutai.on('theme', fn), qutai.on('pause', fn), qutai.on('resume', fn).
- Never use alert(), confirm() or prompt() of the browser.

CLIPBOARD (declare in permissions)
- 'clipboard-write': await qutai.clipboard.write(text). 'clipboard-read': await qutai.clipboard.read() (Qutai asks the user the first time).
- Permissions available now: ${AVAILABLE_PERMISSIONS.join(', ')}. Storage, ui and app need no declaration. Anything else is not available yet (no location, camera, notifications, network, files).

TEXT, LANGUAGE, ACCESSIBILITY
- Write all visible text in the user's language (the language they wrote in; set "language" to its code). For apps that should follow the interface language use qutai.t({ en: '...', tr: '...' }).
- User text into the page: element.textContent, or qutai.escape(text) inside HTML strings. Never put user text into innerHTML unescaped.
- Semantic HTML: <button> for actions (type="button"), <label for> on every input, headings (h1 for the app title), lists with <ul>/<li>, a role="status" aria-live="polite" element for messages like "Saved" or counts. Don't use colour alone to show meaning. Visible text on icon-only buttons or an aria-label.
- Empty states that say what to do ("No notes yet. Tap New note."), confirmations before deleting.

OTHER
- qutai.ready (a Promise, already resolved), qutai.info { id, name, version }, qutai.language, qutai.id() (random id), await qutai.app.close().
- Errors: uncaught errors, console output and blocked things are captured; Qutai shows the user an error screen and gives them to you in preview. Catch errors around storage calls and show a sentence in the app.
- Keep apps small and readable (aim under 30 KB): one screen with an editor view is usually enough.

ICONS for "icon": { "name": one of ${APP_ICONS.join(', ')}, "color": "#rrggbb" }.

WORKFLOW
1. create with name (short, in the user's language), description (one sentence), icon, language, permissions (usually []), files.
2. preview: read the result. If it lists errors or blocked things, fix with update (edits: [{ file, find, replace }] where find occurs exactly once; or whole files) and preview again. At most 3 fix rounds, then tell the user what is wrong.
3. Answer briefly: what the app does and that it is in "My apps" on the new tab page. Don't paste the code.
4. Later changes: read (if you don't have the current files), update with a short note, preview. The user can undo a version.
`;
