/**
 * The Netscape bookmark file format that Chrome, Firefox, Safari and Edge export and import:
 *
 *   <DL><p>
 *     <DT><H3 ADD_DATE="1700000000">Folder</H3>
 *     <DL><p>
 *       <DT><A HREF="https://example.com/" ADD_DATE="1700000000">Title</A>
 *     </DL><p>
 *   </DL><p>
 *
 * It is "HTML" written by hand, never well formed (<DT> and <p> are never closed), so this is a small
 * tolerant tokenizer rather than an HTML parser. Pure functions only, no app imports, so it runs as is
 * in Node too.
 */

export type ParsedBookmark = { kind: 'bookmark'; url: string; title: string; addDate: number | null };
export type ParsedFolder = { kind: 'folder'; title: string; addDate: number | null; children: ParsedNode[] };
export type ParsedNode = ParsedBookmark | ParsedFolder;

export class BookmarkFileError extends Error {
  readonly reason: 'notBookmarkFile' | 'empty';
  constructor(reason: 'notBookmarkFile' | 'empty') {
    super(reason);
    this.reason = reason;
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
};

// Accented letters (U+00C0–U+00FF, case-sensitive names) and the Turkish letters outside Latin-1.
const LATIN1 =
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde ' +
  'Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc ' +
  'atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc ' +
  'otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml';
const LETTERS: Record<string, string> = {
  ...Object.fromEntries(LATIN1.split(' ').map((name, i) => [name, String.fromCharCode(0xc0 + i)])),
  Gbreve: 'Ğ',
  gbreve: 'ğ',
  Scedil: 'Ş',
  scedil: 'ş',
  Idot: 'İ',
  imath: 'ı',
  inodot: 'ı',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return LETTERS[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? match;
  });
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

/** ADD_DATE is seconds since 1970 in every browser's export; some tools write milliseconds or microseconds. */
function parseDate(value: string | undefined): number | null {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n <= 0) return null;
  if (n > 1e14) return Math.round(n / 1000); // microseconds
  if (n > 1e11) return Math.round(n); // milliseconds
  return Math.round(n * 1000);
}

const cleanText = (text: string) => decodeEntities(text).replace(/\s+/g, ' ').trim();

/**
 * Parses a bookmark file into a tree under an unnamed root. Every link is kept (filtering is up to the
 * caller). Throws `BookmarkFileError` when the text is not a bookmark file or holds nothing.
 */
export function parseBookmarkFile(html: string): ParsedFolder {
  const root: ParsedFolder = { kind: 'folder', title: '', addDate: null, children: [] };
  const looksLikeOne = /<!DOCTYPE\s+NETSCAPE-Bookmark-file/i.test(html) || /<DL[\s>]/i.test(html);
  if (!looksLikeOne || !/<(A|H3)[\s>]/i.test(html)) {
    if (looksLikeOne) throw new BookmarkFileError('empty');
    throw new BookmarkFileError('notBookmarkFile');
  }

  const stack: ParsedFolder[] = [root];
  // A folder whose heading was just read: the next <DL> holds its children.
  let pendingFolder: ParsedFolder | null = null;
  // The heading or link whose text is being collected, ended by its closing tag or by the next structural tag.
  let open: { node: ParsedNode; text: string } | null = null;
  let sawDl = false;

  const finishOpen = () => {
    if (!open) return;
    open.node.title = cleanText(open.text);
    open = null;
  };
  const current = () => stack[stack.length - 1];

  const tokens = /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+|<)/g;
  for (let m = tokens.exec(html); m; m = tokens.exec(html)) {
    const [, slash, rawName, attrSource, text] = m;
    if (text !== undefined) {
      if (open) open.text += text;
      continue;
    }
    if (!rawName) continue; // comment or doctype
    const name = rawName.toUpperCase();
    const closing = slash === '/';

    if (closing) {
      if ((name === 'A' && open?.node.kind === 'bookmark') || (name === 'H3' && open?.node.kind === 'folder')) {
        finishOpen();
      } else if (name === 'DL') {
        finishOpen();
        pendingFolder = null;
        if (stack.length > 1) stack.pop();
      }
      continue;
    }

    switch (name) {
      case 'H3': {
        finishOpen();
        const folder: ParsedFolder = {
          kind: 'folder',
          title: '',
          addDate: parseDate(parseAttributes(attrSource).add_date),
          children: [],
        };
        current().children.push(folder);
        pendingFolder = folder;
        open = { node: folder, text: '' };
        break;
      }
      case 'A': {
        finishOpen();
        pendingFolder = null;
        const attrs = parseAttributes(attrSource);
        const bookmark: ParsedBookmark = {
          kind: 'bookmark',
          url: (attrs.href ?? '').trim(),
          title: '',
          addDate: parseDate(attrs.add_date),
        };
        current().children.push(bookmark);
        open = { node: bookmark, text: '' };
        break;
      }
      case 'DL':
        finishOpen();
        // The first list is the file's root; a list right after a heading is that folder's contents; any
        // other stray list is read as part of the folder it sits in (the stack stays balanced either way).
        if (pendingFolder) stack.push(pendingFolder);
        else if (sawDl) stack.push(current());
        sawDl = true;
        pendingFolder = null;
        break;
      case 'DT':
        finishOpen();
        // A heading followed by another entry instead of a list: an empty folder.
        pendingFolder = null;
        break;
      case 'DD': // a description (Firefox), which may sit between a folder's heading and its list
      case 'H1': // the file's own title
        finishOpen();
        break;
      default:
        // <p>, <HR>, <META>, <TITLE>…: ignored; text inside an open title keeps flowing.
        break;
    }
  }
  finishOpen();

  if (!root.children.length) throw new BookmarkFileError('empty');
  return root;
}

/** Only web addresses are imported; bookmarklets (javascript:), Firefox queries (place:), chrome://, file: are not. */
export function isImportableUrl(url: string): boolean {
  return /^https?:\/\/[^\s/]/i.test(url);
}

export type ImportPlan = {
  /** Folders in creation order; `parent` indexes this list, -1 for the import's own top folder. */
  folders: { title: string; parent: number; createdAt: number }[];
  /** `folder` indexes `folders`, -1 for the top folder. */
  bookmarks: { url: string; title: string; folder: number; createdAt: number }[];
  duplicates: number;
  unsupported: number;
};

/**
 * Flattens a parsed tree for inserting: skips addresses already bookmarked (or seen earlier in the
 * file) and unsupported ones, and leaves out folders that end up with nothing in them.
 */
export function planImport(
  root: ParsedFolder,
  existingUrls: ReadonlySet<string>,
  { untitledFolder = 'Folder', now = Date.now() }: { untitledFolder?: string; now?: number } = {},
): ImportPlan {
  const plan: ImportPlan = { folders: [], bookmarks: [], duplicates: 0, unsupported: 0 };
  const seen = new Set(existingUrls);

  const visit = (folder: ParsedFolder, index: number) => {
    for (const node of folder.children) {
      if (node.kind === 'bookmark') {
        if (!isImportableUrl(node.url)) plan.unsupported++;
        else if (seen.has(node.url)) plan.duplicates++;
        else {
          seen.add(node.url);
          plan.bookmarks.push({ url: node.url, title: node.title, folder: index, createdAt: node.addDate ?? now });
        }
        continue;
      }
      const folderCount = plan.folders.length;
      const bookmarkCount = plan.bookmarks.length;
      plan.folders.push({ title: node.title || untitledFolder, parent: index, createdAt: node.addDate ?? now });
      visit(node, folderCount);
      // Nothing was added inside: drop it (its subfolders were dropped already, so it is the last one).
      if (plan.bookmarks.length === bookmarkCount) plan.folders.length = folderCount;
    }
  };
  visit(root, -1);
  return plan;
}

export type ExportFolder = { id: number; parentId: number | null; title: string; createdAt: number };
export type ExportBookmark = { url: string; title: string; folderId: number | null; createdAt: number };

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const seconds = (ms: number) => String(Math.floor(ms / 1000));

/** Writes bookmarks and folders in the same format, readable by any browser's "Import bookmarks". */
export function serializeBookmarkFile(folders: ExportFolder[], bookmarks: ExportBookmark[]): string {
  const known = new Set(folders.map((f) => f.id));
  const parentOf = (id: number | null) => (id !== null && known.has(id) ? id : null);
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It will be read and overwritten.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
  ];
  const visited = new Set<number>();
  const writeList = (parentId: number | null, depth: number) => {
    const pad = '    '.repeat(depth);
    lines.push(`${pad}<DL><p>`);
    for (const folder of folders) {
      if (parentOf(folder.parentId) !== parentId || visited.has(folder.id)) continue;
      visited.add(folder.id);
      lines.push(`${pad}    <DT><H3 ADD_DATE="${seconds(folder.createdAt)}">${escapeHtml(folder.title)}</H3>`);
      writeList(folder.id, depth + 1);
    }
    for (const b of bookmarks) {
      if (parentOf(b.folderId) !== parentId) continue;
      const attrs = `HREF="${escapeHtml(b.url)}" ADD_DATE="${seconds(b.createdAt)}"`;
      lines.push(`${pad}    <DT><A ${attrs}>${escapeHtml(b.title || b.url)}</A>`);
    }
    lines.push(`${pad}</DL><p>`);
  };
  writeList(null, 0);
  return lines.join('\n') + '\n';
}
