import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import {
  addBookmark,
  allFolders,
  Bookmark,
  BookmarkFolder,
  createFolder,
  deleteFolder,
  folderContents,
  getBookmark,
  listBookmarks,
  listFolders,
  moveFolder,
  notifyBookmarksChanged,
  removeBookmark,
  renameFolder,
  updateBookmark,
} from '../storage/bookmarks';
import type { Db } from '../storage/db';
import type { ToolContext, ToolOutput } from './executeTool';
import { declinedNotice, incognitoNotice } from './stepLine';
import { uiLabel, uiPath } from './uiLabels';
import { cutText } from '../utils/wellFormed';

/**
 * The assistant's bookmarks tool. Adding, renaming, moving and new folders are visible in the Library and easily
 * undone, so they run without asking; removing a bookmark runs too, with "Undo" offered on screen; deleting a folder
 * with contents, or removing more than a few bookmarks in one task, asks the user once with the count and names.
 * Reading the list is device data: refused in conversations that touched an incognito tab, where only what the page
 * menu allows there (bookmarking or un-bookmarking a page, at the top level) is possible.
 */

export const BOOKMARK_ACTIONS = [
  'add',
  'remove',
  'list',
  'search',
  'move',
  'rename',
  'create_folder',
  'delete_folder',
] as const;
export type BookmarkAction = (typeof BOOKMARK_ACTIONS)[number];

/** Read-only actions: not written to the action history. */
export const BOOKMARK_READS: ReadonlySet<string> = new Set(['list', 'search']);

/** Removals in one task up to this many run without asking; the next one asks once for the rest of the task. */
const REMOVALS_WITHOUT_ASKING = 3;
const LIST_LIMIT = 60;
const SEARCH_LIMIT = 30;

/** This task's removals, keyed by its agentTab object (one per task). */
const removalsByTask = new WeakMap<object, { count: number; approved: boolean }>();

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const isWebUrl = (url: string) => /^https?:\/\/[^\s/]+/i.test(url);

/** Whether a call needs the user while the app is in the background (it would ask). */
export function bookmarkNeedsUser(input: Record<string, unknown>, agentTab: object): boolean {
  if (input.action === 'delete_folder') return true;
  if (input.action !== 'remove') return false;
  const state = removalsByTask.get(agentTab) ?? { count: 0, approved: false };
  const asked = Array.isArray(input.urls) ? input.urls.length : 1;
  return !state.approved && state.count + asked > REMOVALS_WITHOUT_ASKING;
}

/** The chat's action line for a call. */
export function describeBookmarkCall(input: Record<string, unknown>): string {
  const what = cutText(str(input.title) || str(input.url) || t('action.bookmarkThisPage'), 60);
  const folder = cutText(str(input.folder), 60);
  switch (input.action) {
    case 'add':
      return folder ? t('action.bookmarkAddTo', { what, folder }) : t('action.bookmarkAdd', { what });
    case 'remove': {
      const urls: unknown[] = Array.isArray(input.urls) ? input.urls : [];
      if (urls.length > 1) return t('action.bookmarkRemoveMany', { count: urls.length });
      const which = str(input.url) || str(urls[0]) || t('action.bookmarkThisPage');
      return t('action.bookmarkRemove', { what: cutText(which, 60) });
    }
    case 'list':
      return folder ? t('action.bookmarkListFolder', { folder }) : t('action.bookmarkList');
    case 'search':
      return t('action.bookmarkSearch', { query: cutText(str(input.query), 60) });
    case 'move':
      return t('action.bookmarkMove', {
        what: cutText(str(input.url) || folder, 60),
        folder: cutText(str(input.to_folder), 60) || t('library.bookmarks'),
      });
    case 'rename':
      return t('action.bookmarkRename', { what: cutText(str(input.url) || folder, 60), title: cutText(str(input.title), 60) });
    case 'create_folder':
      return t('action.bookmarkCreateFolder', { folder });
    case 'delete_folder':
      return t('action.bookmarkDeleteFolder', { folder });
    default:
      return t('action.bookmarkList');
  }
}

// ---------- Folders by name or path ----------

type Tree = { all: BookmarkFolder[]; byId: Map<number, BookmarkFolder> };

async function loadTree(db: Db): Promise<Tree> {
  const all = await allFolders(db);
  return { all, byId: new Map(all.map((f) => [f.id, f])) };
}

const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
/** The top level's names: "Bookmarks" in the interface language, and in English. */
const isTopName = (name: string) => same(name, t('library.bookmarks')) || same(name, 'Bookmarks');

/** A folder's place as the Library shows it: "Bookmarks" › "Travel" › "Italy". */
function pathOf(tree: Tree, id: number | null): string {
  const names: string[] = [];
  const seen = new Set<number>();
  for (let at = id; at !== null && !seen.has(at); ) {
    seen.add(at);
    const folder = tree.byId.get(at);
    if (!folder) break;
    names.unshift(`"${folder.title}"`);
    at = folder.parentId;
  }
  return [uiLabel('library.bookmarks'), ...names].join(' › ');
}

type Found =
  | { kind: 'found'; id: number | null }
  | { kind: 'ambiguous'; folders: BookmarkFolder[] }
  | { kind: 'missing'; parentId: number | null; rest: string[] };

/** Finds a folder by its name ("Travel") or path ("Travel/Italy", "Bookmarks › Travel"); "" or "/" is the top level. */
function findFolder(tree: Tree, spec: string): Found {
  const whole = spec.trim().replace(/^["“]|["”]$/g, '');
  if (!whole || whole === '/' || isTopName(whole)) return { kind: 'found', id: null };
  // A folder whose own name holds a separator.
  const exact = tree.all.filter((f) => same(f.title, whole));
  if (exact.length === 1) return { kind: 'found', id: exact[0].id };
  const parts = whole
    .split(/\s*(?:\/|›|>)\s*/)
    .map((p) => p.trim().replace(/^["“]|["”]$/g, ''))
    .filter(Boolean);
  if (parts.length && isTopName(parts[0])) parts.shift();
  if (!parts.length) return { kind: 'found', id: null };
  if (parts.length === 1) {
    if (exact.length > 1) return { kind: 'ambiguous', folders: exact };
    return { kind: 'missing', parentId: null, rest: parts };
  }
  // The first name: a top-level folder, else a folder anywhere with that name (when only one has it).
  const first = parts[0];
  const top = tree.all.filter((f) => f.parentId === null && same(f.title, first));
  const anywhere = tree.all.filter((f) => same(f.title, first));
  const start = top.length === 1 ? top[0] : top.length === 0 && anywhere.length === 1 ? anywhere[0] : null;
  if (!start) {
    if (top.length > 1 || anywhere.length > 1) return { kind: 'ambiguous', folders: top.length ? top : anywhere };
    return { kind: 'missing', parentId: null, rest: parts };
  }
  let current = start.id;
  for (let i = 1; i < parts.length; i++) {
    const children = tree.all.filter((f) => f.parentId === current && same(f.title, parts[i]));
    if (children.length > 1) return { kind: 'ambiguous', folders: children };
    if (!children.length) return { kind: 'missing', parentId: current, rest: parts.slice(i) };
    current = children[0].id;
  }
  return { kind: 'found', id: current };
}

function folderProblem(tree: Tree, spec: string, found: Exclude<Found, { kind: 'found' }>): string {
  if (found.kind === 'ambiguous') {
    return (
      `Several folders match "${spec}":\n${found.folders.map((f) => `- ${pathOf(tree, f.id)}`).join('\n')}\n` +
      'Give the path, e.g. "Parent/Folder". Nothing was changed.'
    );
  }
  return `There is no bookmark folder "${spec}". Folders: ${folderOverview(tree)}. Nothing was changed.`;
}

/** Every folder's path, for the model to pick from (at most 40). */
function folderOverview(tree: Tree): string {
  if (!tree.all.length) return `none (everything is at the top level, ${uiLabel('library.bookmarks')})`;
  const paths = tree.all.slice(0, 40).map((f) => pathOf(tree, f.id));
  return paths.join('; ') + (tree.all.length > 40 ? `; and ${tree.all.length - 40} more` : '');
}

/** Creates the missing folders of a path under `parentId`; returns the last one's id. */
async function createPath(db: Db, parentId: number | null, rest: string[]): Promise<number> {
  let id = parentId;
  for (const name of rest) id = await createFolder(db, cutText(name, 200), id);
  return id as number;
}

/** A bookmark by URL, allowing for a trailing slash, http/https and "www." written differently. */
async function findBookmark(db: Db, url: string): Promise<Bookmark | null> {
  const exact = await getBookmark(db, url);
  if (exact) return exact;
  const base = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  for (const scheme of ['https://', 'http://'])
    for (const www of ['', 'www.'])
      for (const slash of ['', '/']) {
        const found = await getBookmark(db, `${scheme}${www}${base}${slash}`);
        if (found) return found;
      }
  return null;
}

const bookmarkLine = (b: Bookmark) => `"${b.title || b.url}" — ${b.url}`;
const libraryPlace = () => uiPath('address.menu', 'menu.bookmarks');

// ---------- The tool ----------

export async function bookmarksTool(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  if (!ctx.bookmarks) return { content: 'Bookmarks are not available here.', isError: true };
  const action = input.action as BookmarkAction;
  if (!BOOKMARK_ACTIONS.includes(action))
    return { content: `action must be one of: ${BOOKMARK_ACTIONS.join(', ')}.`, isError: true };
  const tab = ctx.browser.getTab(ctx.agentTab.id) ?? ctx.browser.active;
  if (tab?.incognito && ctx.privacy) ctx.privacy.touchedIncognito = true;
  const incognito = !!(ctx.privacy?.touchedIncognito || tab?.incognito);
  if (incognito && action !== 'add' && action !== 'remove') {
    return {
      content:
        'Not allowed: this conversation involves incognito tabs, so the user\'s bookmarks are not read or ' +
        'reorganised here. From an incognito tab you can only bookmark a page (at the top level) or remove one by ' +
        'its address, as the page menu allows. Tell the user they can ask again from a normal tab.',
      isError: true,
      notice: incognitoNotice(),
    };
  }
  const db = await ctx.bookmarks.db();
  try {
    const result = await run(action, input, ctx, db, tab, incognito);
    if (!result.isError && !BOOKMARK_READS.has(action)) notifyBookmarksChanged();
    return result;
  } catch (e) {
    return { content: `Bookmarks error: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}

async function run(
  action: BookmarkAction,
  input: Record<string, unknown>,
  ctx: ToolContext,
  db: Db,
  tab: Tab | undefined,
  incognito: boolean,
): Promise<ToolOutput> {
  const tree = await loadTree(db);
  const folderSpec = str(input.folder);
  switch (action) {
    case 'add': {
      let url = str(input.url);
      let title = str(input.title);
      if (!url) {
        if (!tab || tab.isNewTab || !isWebUrl(tab.url))
          return {
            content: 'The current tab shows no web page (only http and https pages can be bookmarked). Give url.',
            isError: true,
          };
        url = tab.url;
        title = title || tab.title;
      }
      if (!isWebUrl(url))
        return { content: 'Only http and https addresses can be bookmarked. Nothing was saved.', isError: true };
      if (!title) title = tab && tab.url === url && tab.title ? tab.title : url;
      title = cutText(title.replace(/\s+/g, ' '), 300);
      if (incognito && folderSpec && !findIsTop(tree, folderSpec))
        return {
          content:
            'From an incognito conversation a page can only be bookmarked at the top level (as the page menu does). ' +
            `Call again without folder; the user can move it later in ${libraryPlace()}.`,
          isError: true,
        };
      let folderId: number | null | undefined;
      if (folderSpec) {
        const found = findFolder(tree, folderSpec);
        if (found.kind === 'ambiguous') return { content: folderProblem(tree, folderSpec, found), isError: true };
        if (found.kind === 'missing') {
          if (input.create_folder !== true)
            return {
              content:
                `There is no bookmark folder "${folderSpec}". Folders: ${folderOverview(tree)}. Nothing was saved. ` +
                'Pick one of these, or call again with create_folder true if the user wants a new folder.',
              isError: true,
            };
          folderId = await createPath(db, found.parentId, found.rest);
        } else folderId = found.id;
      }
      const before = await getBookmark(db, url);
      await addBookmark(db, url, title);
      if (folderId !== undefined) await updateBookmark(db, url, { folderId });
      const after = await getBookmark(db, url);
      const where = incognito ? uiLabel('library.bookmarks') : pathOf(await loadTree(db), after?.folderId ?? null);
      const lead = before
        ? `It was already bookmarked; its title is now "${title}"${folderId !== undefined && folderId !== before.folderId ? ' and it was moved' : ''}.`
        : `Bookmarked "${title}" (${url}).`;
      return {
        content:
          `${lead} It is in ${where}. The user finds bookmarks in ${libraryPlace()}` +
          (after?.folderId === null ? ' and on the new tab page' : '') +
          '; it can be removed with the page menu\'s bookmark button or with bookmarks remove.',
        isError: false,
      };
    }

    case 'remove': {
      const asked: string[] = Array.isArray(input.urls)
        ? input.urls.map((u) => String(u).trim()).filter(Boolean)
        : str(input.url)
          ? [str(input.url)]
          : tab && !tab.isNewTab && isWebUrl(tab.url)
            ? [tab.url]
            : [];
      if (!asked.length) return { content: 'Give url (or urls) of the bookmark to remove.', isError: true };
      const found: Bookmark[] = [];
      const missing: string[] = [];
      for (const url of asked) {
        const b = await findBookmark(db, url);
        if (b && !found.some((x) => x.url === b.url)) found.push(b);
        else if (!b) missing.push(url);
      }
      const notFound = missing.length ? `Not bookmarked (nothing to remove): ${missing.join(', ')}.` : '';
      if (!found.length) return { content: notFound || 'Nothing to remove.', isError: true };
      const state = removalsByTask.get(ctx.agentTab) ?? { count: 0, approved: false };
      removalsByTask.set(ctx.agentTab, state);
      if (!state.approved && state.count + found.length > REMOVALS_WITHOUT_ASKING) {
        if (!ctx.confirm)
          return { content: 'Removing this many bookmarks needs the user\'s confirmation, which is not available here.', isError: true };
        const names = found.slice(0, 10).map((b) => `• ${b.title || b.url}`);
        if (found.length > 10) names.push('…');
        const allowed = await ctx.confirm(
          t('bookmarksTool.confirmRemove', { count: found.length, names: names.join('\n') }),
          null,
        );
        if (!allowed)
          return {
            content: 'The user declined removing these bookmarks. Nothing was removed; ask them how to proceed.',
            isError: true,
            notice: declinedNotice(),
          };
        state.approved = true;
      }
      for (const b of found) await removeBookmark(db, b.url);
      state.count += found.length;
      ctx.bookmarks?.removed(found);
      const lines = found.map((b) => `- ${bookmarkLine(b)}${incognito ? '' : ` (was in ${pathOf(tree, b.folderId)})`}`);
      return {
        content:
          `Removed ${found.length} bookmark${found.length === 1 ? '' : 's'}:\n${lines.join('\n')}\n` +
          (notFound ? `${notFound}\n` : '') +
          `The user can tap ${uiLabel('common.undo')} in the message at the bottom of the screen for a few seconds to ` +
          'put them back; mention that, and that you can add them back with bookmarks add (url, title, folder).',
        isError: false,
      };
    }

    case 'list': {
      const found = findFolder(tree, folderSpec);
      if (found.kind !== 'found') return { content: folderProblem(tree, folderSpec, found), isError: true };
      const [folders, bookmarks] = await Promise.all([
        listFolders(db, found.id),
        listBookmarks(db, { folderId: found.id }),
      ]);
      const head =
        `${pathOf(tree, found.id)}: ${folders.length} folder${folders.length === 1 ? '' : 's'}, ` +
        `${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'} (newest first).`;
      const folderLines = folders.map((f) => `- 📁 "${f.title}" (${f.items} item${f.items === 1 ? '' : 's'})`);
      const bookmarkLines = bookmarks.slice(0, LIST_LIMIT).map((b) => `- ${bookmarkLine(b)}`);
      const more =
        bookmarks.length > LIST_LIMIT ? `\n[${bookmarks.length - LIST_LIMIT} more; use search to find one.]` : '';
      const body = [
        folderLines.length ? `Folders:\n${folderLines.join('\n')}` : '',
        bookmarkLines.length ? `Bookmarks:\n${bookmarkLines.join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return {
        content: `${head}\n${body || '(empty)'}${more}\nThe user sees the same in ${libraryPlace()}.`,
        isError: false,
      };
    }

    case 'search': {
      const query = str(input.query);
      if (!query) return { content: 'Give query (words of the title or address).', isError: true };
      const matches = await listBookmarks(db, { query });
      const folders = tree.all.filter((f) => f.title.toLowerCase().includes(query.toLowerCase()));
      const lines = matches.slice(0, SEARCH_LIMIT).map((b) => `- ${bookmarkLine(b)} (in ${pathOf(tree, b.folderId)})`);
      const folderLines = folders.slice(0, 10).map((f) => `- 📁 ${pathOf(tree, f.id)}`);
      if (!lines.length && !folderLines.length)
        return {
          content: `No bookmarks match "${query}". Try other words, or list a folder. To open a page, navigate to its url.`,
          isError: false,
        };
      return {
        content:
          `Bookmarks matching "${query}": ${matches.length}${matches.length > SEARCH_LIMIT ? ` (first ${SEARCH_LIMIT} shown)` : ''}.\n` +
          lines.join('\n') +
          (folderLines.length ? `\nFolders:\n${folderLines.join('\n')}` : '') +
          '\nTo open one, navigate to its url.',
        isError: false,
      };
    }

    case 'move': {
      const toSpec = str(input.to_folder);
      if (input.to_folder === undefined) return { content: 'Give to_folder ("" for the top level).', isError: true };
      const dest = findFolder(tree, toSpec);
      let destId: number | null;
      if (dest.kind === 'ambiguous') return { content: folderProblem(tree, toSpec, dest), isError: true };
      if (dest.kind === 'missing') {
        if (input.create_folder !== true)
          return {
            content:
              `There is no bookmark folder "${toSpec}". Folders: ${folderOverview(tree)}. Nothing was moved. ` +
              'Call again with create_folder true if the user wants a new folder.',
            isError: true,
          };
        destId = await createPath(db, dest.parentId, dest.rest);
      } else destId = dest.id;
      const after = () => loadTree(db);
      if (str(input.url)) {
        const b = await findBookmark(db, str(input.url));
        if (!b) return { content: `${str(input.url)} is not bookmarked. Nothing was moved.`, isError: true };
        await updateBookmark(db, b.url, { folderId: destId });
        return {
          content: `Moved ${bookmarkLine(b)} from ${pathOf(tree, b.folderId)} to ${pathOf(await after(), destId)}.`,
          isError: false,
        };
      }
      if (!folderSpec) return { content: 'Give url (a bookmark) or folder (a folder) to move.', isError: true };
      const source = findFolder(tree, folderSpec);
      if (source.kind !== 'found') return { content: folderProblem(tree, folderSpec, source), isError: true };
      if (source.id === null) return { content: 'The top level cannot be moved.', isError: true };
      const from = pathOf(tree, source.id);
      if (!(await moveFolder(db, source.id, destId)))
        return { content: 'A folder cannot be moved into itself or one of its own folders. Nothing was moved.', isError: true };
      return { content: `Moved the folder ${from} to ${pathOf(await after(), source.id)}.`, isError: false };
    }

    case 'rename': {
      const title = cutText(str(input.title).replace(/\s+/g, ' '), 300);
      if (!title) return { content: 'Give title: the new name.', isError: true };
      if (str(input.url)) {
        const b = await findBookmark(db, str(input.url));
        if (!b) return { content: `${str(input.url)} is not bookmarked. Nothing was renamed.`, isError: true };
        await updateBookmark(db, b.url, { title });
        return { content: `Renamed the bookmark "${b.title}" to "${title}" (${b.url}).`, isError: false };
      }
      if (!folderSpec) return { content: 'Give url (a bookmark) or folder (a folder) to rename.', isError: true };
      const found = findFolder(tree, folderSpec);
      if (found.kind !== 'found') return { content: folderProblem(tree, folderSpec, found), isError: true };
      if (found.id === null) return { content: 'The top level cannot be renamed.', isError: true };
      const from = pathOf(tree, found.id);
      await renameFolder(db, found.id, cutText(title, 200));
      return { content: `Renamed the folder ${from} to "${title}": now ${pathOf(await loadTree(db), found.id)}.`, isError: false };
    }

    case 'create_folder': {
      if (!folderSpec) return { content: 'Give folder: the new folder\'s name or path.', isError: true };
      const found = findFolder(tree, folderSpec);
      if (found.kind === 'ambiguous') return { content: folderProblem(tree, folderSpec, found), isError: true };
      if (found.kind === 'found')
        return { content: `The folder ${pathOf(tree, found.id)} already exists. Nothing was created.`, isError: false };
      const id = await createPath(db, found.parentId, found.rest);
      return { content: `Created the folder ${pathOf(await loadTree(db), id)}.`, isError: false };
    }

    case 'delete_folder': {
      if (!folderSpec) return { content: 'Give folder: the folder to delete.', isError: true };
      const found = findFolder(tree, folderSpec);
      if (found.kind !== 'found') return { content: folderProblem(tree, folderSpec, found), isError: true };
      if (found.id === null) return { content: 'The top level cannot be deleted.', isError: true };
      const folder = tree.byId.get(found.id) as BookmarkFolder;
      const path = pathOf(tree, found.id);
      const contents = await folderContents(db, found.id);
      const empty = !contents.bookmarks && !contents.folders;
      if (!empty) {
        if (!ctx.confirm)
          return { content: 'Deleting a folder with contents needs the user\'s confirmation, which is not available here.', isError: true };
        const allowed = await ctx.confirm(
          `${t('library.deleteFolderConfirm', { name: folder.title })}\n${t('library.deleteFolderContents', contents)}`,
          null,
        );
        if (!allowed)
          return {
            content: 'The user declined deleting the folder. Nothing was deleted; ask them how to proceed.',
            isError: true,
            notice: declinedNotice(),
          };
      }
      await deleteFolder(db, found.id);
      return {
        content: empty
          ? `Deleted the empty folder ${path}.`
          : `Deleted the folder ${path} with ${contents.bookmarks} bookmark(s) and ${contents.folders} subfolder(s) in it. This cannot be undone.`,
        isError: false,
      };
    }
  }
}

function findIsTop(tree: Tree, spec: string): boolean {
  const found = findFolder(tree, spec);
  return found.kind === 'found' && found.id === null;
}
