// The notes app the fake AI server "writes" for the owner's scenario ("bana bir uygulama oluştur, burada notlarımı
// tutabileyim"), and the tests' reference app: a list, add, edit, delete with Qutai's confirmation, search, data in
// qutai.db (survives restarts), the theme's colours, rem-based text (large text), and labels, headings and a live
// status line for screen readers. Written against contract 1 the way docs/mini-apps.md's guide asks.

export const NOTES_HTML = `<!doctype html>
<html>
<head>
<title>Notes</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="bar">
  <h1 id="heading"></h1>
  <button id="new" type="button" class="primary"></button>
</header>
<main>
  <div class="search">
    <label for="q" id="qLabel" class="visually-hidden"></label>
    <input id="q" type="search" autocomplete="off">
  </div>
  <p id="status" class="status" role="status" aria-live="polite"></p>
  <ul id="list" class="list"></ul>
  <p id="empty" class="empty" hidden></p>
</main>
<section id="editor" class="editor" hidden aria-labelledby="editorHeading">
  <h2 id="editorHeading"></h2>
  <label for="noteTitle" id="titleLabel"></label>
  <input id="noteTitle" maxlength="200" autocomplete="off">
  <label for="noteBody" id="bodyLabel"></label>
  <textarea id="noteBody" rows="10"></textarea>
  <div class="actions">
    <button id="save" type="button" class="primary"></button>
    <button id="cancel" type="button" class="secondary"></button>
    <button id="delete" type="button" class="danger"></button>
  </div>
</section>
<script src="app.js"></script>
</body>
</html>
`;

export const NOTES_CSS = `.bar { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem 1rem; }
h1 { font-size: 1.5rem; margin: 0; }
h2 { font-size: 1.25rem; margin: 0 0 0.5rem; }
main { padding: 0 1rem 1rem; }
.search input { width: 100%; }
.status { min-height: 1.2em; margin: 0.25rem 0; color: var(--qutai-text-secondary); font-size: 0.875rem; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.list button { width: 100%; text-align: start; background: var(--qutai-surface); color: var(--qutai-text);
  border: 1px solid var(--qutai-border); border-radius: 12px; padding: 0.75rem 1rem; display: block; }
.list .t { display: block; font-weight: 600; overflow-wrap: anywhere; }
.list .b { display: block; color: var(--qutai-text-secondary); font-size: 0.875rem; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.empty { color: var(--qutai-text-secondary); text-align: center; padding: 2rem 1rem; }
.editor { padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
.editor input, .editor textarea { width: 100%; }
.editor textarea { min-height: 12rem; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
.secondary { background: var(--qutai-sunken); color: var(--qutai-text); }
.danger { background: transparent; color: var(--qutai-danger); border: 1px solid var(--qutai-danger); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

export const NOTES_JS = `const T = {
  heading: { en: 'My notes', tr: 'Notlarım' },
  add: { en: 'New note', tr: 'Yeni not' },
  search: { en: 'Search notes', tr: 'Notlarda ara' },
  empty: { en: 'No notes yet. Tap "New note" to write one.', tr: 'Henüz not yok. Yazmak için "Yeni not"a dokunun.' },
  none: { en: 'No note matches your search.', tr: 'Aramanızla eşleşen not yok.' },
  newNote: { en: 'New note', tr: 'Yeni not' },
  edit: { en: 'Edit note', tr: 'Notu düzenle' },
  title: { en: 'Title', tr: 'Başlık' },
  body: { en: 'Note', tr: 'Not' },
  save: { en: 'Save', tr: 'Kaydet' },
  cancel: { en: 'Cancel', tr: 'Vazgeç' },
  del: { en: 'Delete', tr: 'Sil' },
  untitled: { en: 'Untitled', tr: 'Başlıksız' },
  saved: { en: 'Note saved', tr: 'Not kaydedildi' },
  deleted: { en: 'Note deleted', tr: 'Not silindi' },
  confirmDelete: { en: 'Delete this note?', tr: 'Bu not silinsin mi?' },
  confirmBody: { en: 'This cannot be undone.', tr: 'Bu işlem geri alınamaz.' },
  count: { en: (n) => n + (n === 1 ? ' note' : ' notes'), tr: (n) => n + ' not' },
  failed: { en: 'Could not save: ', tr: 'Kaydedilemedi: ' },
};
const t = (key) => qutai.t(T[key]);
const $ = (id) => document.getElementById(id);
const notes = qutai.db('notes');
let editing = null;
let query = '';

function setTexts() {
  document.title = t('heading');
  $('heading').textContent = t('heading');
  $('new').textContent = t('add');
  $('qLabel').textContent = t('search');
  $('q').placeholder = t('search');
  $('titleLabel').textContent = t('title');
  $('bodyLabel').textContent = t('body');
  $('save').textContent = t('save');
  $('cancel').textContent = t('cancel');
  $('delete').textContent = t('del');
}

async function render() {
  const search = query.trim() ? { text: query, fields: ['title', 'body'] } : undefined;
  const { docs, total } = await notes.query({ search, orderBy: [{ field: 'updatedAt', dir: 'desc' }] });
  const list = $('list');
  list.textContent = '';
  for (const note of docs) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    const title = document.createElement('span');
    title.className = 't';
    title.textContent = note.title || t('untitled');
    const body = document.createElement('span');
    body.className = 'b';
    body.textContent = note.body || '';
    button.append(title, body);
    button.addEventListener('click', () => openEditor(note));
    li.append(button);
    list.append(li);
  }
  const empty = $('empty');
  empty.hidden = total > 0;
  empty.textContent = query.trim() ? t('none') : t('empty');
  $('status').textContent = qutai.t(T.count)(total);
}

function show(editor) {
  $('editor').hidden = !editor;
  document.querySelector('main').hidden = editor;
  document.querySelector('.bar').hidden = editor;
  qutai.ui.setBackHandler(editor);
}

function openEditor(note) {
  editing = note;
  $('editorHeading').textContent = note ? t('edit') : t('newNote');
  $('noteTitle').value = note ? note.title || '' : '';
  $('noteBody').value = note ? note.body || '' : '';
  $('delete').hidden = !note;
  show(true);
  (note ? $('noteBody') : $('noteTitle')).focus();
}

function closeEditor() {
  editing = null;
  show(false);
  $('new').focus();
}

async function save() {
  const title = $('noteTitle').value.trim();
  const body = $('noteBody').value;
  if (!title && !body.trim()) return closeEditor();
  try {
    if (editing) await notes.update(editing.id, { title, body });
    else await notes.add({ title, body });
    qutai.ui.haptic('success');
    qutai.ui.toast(t('saved'));
    closeEditor();
    await render();
  } catch (e) {
    $('status').textContent = t('failed') + e.message;
  }
}

async function remove() {
  if (!editing) return;
  const ok = await qutai.ui.confirm({ title: t('confirmDelete'), message: t('confirmBody'), confirmText: t('del'), destructive: true });
  if (!ok) return;
  await notes.delete(editing.id);
  qutai.ui.toast(t('deleted'));
  closeEditor();
  await render();
}

let timer = null;
$('q').addEventListener('input', (e) => {
  query = e.target.value;
  clearTimeout(timer);
  timer = setTimeout(render, 150);
});
$('new').addEventListener('click', () => openEditor(null));
$('save').addEventListener('click', save);
$('cancel').addEventListener('click', closeEditor);
$('delete').addEventListener('click', remove);
qutai.on('back', closeEditor);

setTexts();
render();
`;

export function notesFiles() {
  return { 'index.html': NOTES_HTML, 'style.css': NOTES_CSS, 'app.js': NOTES_JS };
}

/** The apps tool's create input for the notes app, in Turkish or English. */
export function notesCreateInput(language) {
  const tr = language === 'tr';
  return {
    action: 'create',
    name: tr ? 'Notlarım' : 'My notes',
    description: tr ? 'Notlarınızı yazın, düzenleyin, arayın ve silin.' : 'Write, edit, search and delete your notes.',
    icon: { name: 'notes', color: '#ef6c00' },
    language: tr ? 'tr' : 'en',
    files: notesFiles(),
  };
}

/** An edit that breaks the app on load (a misspelt function), and the one that mends it. */
export const BREAK_EDIT = { file: 'app.js', find: 'setTexts();\nrender();', replace: 'setTexts();\nrendr();' };
export const FIX_EDIT = { file: 'app.js', find: 'setTexts();\nrendr();', replace: 'setTexts();\nrender();' };
