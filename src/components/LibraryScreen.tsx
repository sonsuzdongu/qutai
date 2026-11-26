import { MutableRefObject, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pickBookmarkFile, PickerUnavailableError, shareBookmarkFile } from '../device/bookmarksFile';
import { bump, success, tick } from '../device/haptics';
import { t } from '../i18n';
import { Icon, IconName } from '../ui/Icon';
import { makeStyles, readableColumn, usePalette, radii, common } from '../ui/theme';
import { formatDate, groupByDay, hostOf, timeLabel } from '../i18n/format';
import {
  BookmarkFileError,
  ParsedFolder,
  parseBookmarkFile,
  planImport,
  serializeBookmarkFile,
} from '../storage/bookmarkHtml';
import {
  allFolders,
  Bookmark,
  BookmarkFolder,
  bookmarkedUrls,
  createFolder,
  deleteFolder,
  exportData,
  folderContents,
  FolderEntry,
  importBookmarks,
  listBookmarks,
  listFolders,
  onBookmarksChanged,
  moveFolder,
  removeBookmark,
  renameFolder,
  updateBookmark,
} from '../storage/bookmarks';
import { Db, getDb } from '../storage/db';
import { ActionSheet, SheetAction } from './ActionSheet';
import { dialog, DialogHost } from './Dialog';
import { KeyboardAvoidingContainer } from './KeyboardAware';
import { keepShown } from './historySelection';
import { clearHistory, deleteHistoryEntries, deleteHistoryEntry, HistoryEntry, listHistory } from '../storage/history';
import { HEADER_FONT_SCALE } from './ScreenHeader';
import { WholeWordsText } from './WholeWordsText';
import { reportStorageFailure } from '../storage/failures';

export type LibraryTab = 'bookmarks' | 'history';

type Props = {
  visible: boolean;
  initialTab: LibraryTab;
  onOpen: (url: string) => void;
  onClose: () => void;
};

const PAGE_SIZE = 60;

/** Bookmarks and history in one screen, like the library in mobile browsers. */
export function LibraryScreen({ visible, initialTab, onOpen, onClose }: Props) {
  // Android's back button first leaves History's select mode (UI-71), then closes the screen.
  const backRef = useRef<(() => boolean) | null>(null);
  const requestClose = () => {
    if (backRef.current?.()) return;
    onClose();
  };
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      {/* Mounted only while visible, so it always opens fresh on the requested tab. */}
      {visible && <LibraryContent initialTab={initialTab} onOpen={onOpen} onClose={onClose} backRef={backRef} />}
      <DialogHost />
    </AppModal>
  );
}

type BackRef = MutableRefObject<(() => boolean) | null>;

function LibraryContent({ initialTab, onOpen, onClose, backRef }: Omit<Props, 'visible'> & { backRef: BackRef }) {
  const styles = useStyles();
  const palette = usePalette();
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  const [query, setQuery] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.segment}>
          {(['bookmarks', 'history'] as const).map((id) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.segmentButton, tab === id && styles.segmentSelected]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === id }}
            >
              <WholeWordsText style={[styles.segmentText, tab === id && styles.bold]}>{t(`library.${id}`)}</WholeWordsText>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
          <Text style={[styles.action, styles.bold]} numberOfLines={1} maxFontSizeMultiplier={HEADER_FONT_SCALE}>
            {t('common.done')}
          </Text>
        </Pressable>
      </View>
      <TextInput
        placeholderTextColor={palette.textSecondary}
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('library.search')}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      {tab === 'history' ? (
        <HistoryList query={query} onOpen={onOpen} backRef={backRef} />
      ) : (
        <BookmarkList query={query} onOpen={onOpen} />
      )}
    </SafeAreaView>
  );
}

function HistoryList({ query, onOpen, backRef }: { query: string; onOpen: (url: string) => void; backRef: BackRef }) {
  const styles = useStyles();
  const palette = usePalette();
  // `loadedQuery` tells which search the entries belong to; while it differs from `query`, a load is running.
  const [result, setResult] = useState<{ loadedQuery: string | null; entries: HistoryEntry[]; done: boolean }>({
    loadedQuery: null,
    entries: [],
    done: false,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const { entries, done } = result;
  const loading = result.loadedQuery !== query || loadingMore;
  // While a new search runs, the previous results (or "no results") stay as they are; the spinner is only for the
  // first load and for older pages, so nothing flickers on every letter.
  const spinner = result.loadedQuery === null || loadingMore;
  // Select mode (UI-71): the chosen visits, always a subset of the rows on screen.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then((db) => listHistory(db, { query, limit: PAGE_SIZE }))
      .catch((e) => (reportStorageFailure('history.list', e, 'user'), [] as HistoryEntry[]))
      .then((page) => {
        if (cancelled) return;
        setResult({ loadedQuery: query, entries: page, done: page.length < PAGE_SIZE });
        // A new search shows other rows: what was chosen and is no longer on screen is no longer chosen, so Delete
        // only ever removes visits the user can see; "Select all" then picks the new results.
        setSelected((prev) => keepShown(prev, page));
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const endSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  useEffect(() => {
    backRef.current = selecting
      ? () => {
          endSelecting();
          return true;
        }
      : null;
    return () => {
      backRef.current = null;
    };
  }, [selecting, backRef]);

  // The keyboard a search leaves open would cover the Delete bar at the bottom: choosing closes it.
  const toggle = (id: number) => {
    Keyboard.dismiss();
    tick();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const startSelecting = (first?: HistoryEntry) => {
    Keyboard.dismiss();
    bump();
    setSelecting(true);
    setSelected(first ? new Set([first.id]) : new Set());
  };
  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.id));
  const toggleAll = () => {
    Keyboard.dismiss();
    tick();
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)));
  };

  const loadMore = async () => {
    if (loading || done || entries.length === 0) return;
    setLoadingMore(true);
    try {
      const db = await getDb();
      const page = await listHistory(db, { query, limit: PAGE_SIZE, before: entries[entries.length - 1].visitedAt });
      setResult((prev) => ({ ...prev, entries: [...prev.entries, ...page], done: page.length < PAGE_SIZE }));
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Takes deleted visits off the list. When that empties what is loaded while older visits remain, the next page is
   * loaded at once: an empty list must mean there is no history, not that the loaded rows are gone.
   */
  const dropRows = async (gone: ReadonlySet<number>) => {
    const left = entries.filter((e) => !gone.has(e.id));
    if (left.length > 0 || done) {
      setResult((prev) => ({ ...prev, entries: prev.entries.filter((e) => !gone.has(e.id)) }));
      return;
    }
    const page = await listHistory(await getDb(), { query, limit: PAGE_SIZE });
    setResult((prev) =>
      prev.loadedQuery === query ? { loadedQuery: query, entries: page, done: page.length < PAGE_SIZE } : prev,
    );
  };

  const remove = async (entry: HistoryEntry) => {
    await deleteHistoryEntry(await getDb(), entry.id);
    await dropRows(new Set([entry.id]));
  };

  const deleteSelected = () => {
    const ids = entries.filter((e) => selected.has(e.id)).map((e) => e.id);
    if (ids.length === 0 || deleting) return;
    dialog.alert(t('library.deleteSelectedConfirm', { count: ids.length }), t('library.cannotUndo'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('library.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteHistoryEntries(await getDb(), ids);
            await dropRows(new Set(ids));
            success();
            endSelecting();
          } catch (e) {
            reportStorageFailure('history.delete', e, 'user');
            dialog.alert(t('common.error', { message: e instanceof Error ? e.message : String(e) }));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const clearAll = () => {
    dialog.alert(t('library.clearHistoryConfirm'), t('library.cannotUndo'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('library.clearHistory'),
        style: 'destructive',
        onPress: async () => {
          await clearHistory(await getDb());
          setResult({ loadedQuery: query, entries: [], done: true });
        },
      },
    ]);
  };

  const count = selected.size;
  return (
    <View style={styles.flex}>
      {selecting ? (
        <View style={styles.selectBar}>
          <Pressable onPress={toggleAll} hitSlop={8} accessibilityRole="button" disabled={entries.length === 0}>
            <Text style={[styles.action, entries.length === 0 && styles.dimmed]} numberOfLines={1}>
              {t(allSelected ? 'library.deselectAll' : 'library.selectAll')}
            </Text>
          </Pressable>
          <Text style={styles.selectCount} numberOfLines={1} accessibilityLiveRegion="polite">
            {t('library.selectedCount', { count })}
          </Text>
          <Pressable onPress={endSelecting} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.action, styles.bold]} numberOfLines={1}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      ) : entries.length > 0 ? (
        <View style={styles.selectBar}>
          {/* Above the list, not after it: the list loads more as it scrolls, so its end may never come (UI-78). */}
          {!result.loadedQuery ? (
            <Pressable onPress={clearAll} hitSlop={8} accessibilityRole="button">
              <Text style={styles.danger} numberOfLines={1}>
                {t('library.clearHistory')}
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.flex} />
          <Pressable onPress={() => startSelecting()} hitSlop={8} accessibilityRole="button">
            <Text style={styles.action} numberOfLines={1}>
              {t('library.select')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <SectionList
        style={styles.flex}
        contentContainerStyle={readableColumn}
        sections={groupByDay(entries, (e) => e.visitedAt)}
        keyExtractor={(e) => String(e.id)}
        extraData={selecting ? selected : null}
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) =>
          selecting ? (
            <Row
              title={item.title}
              url={item.url}
              meta={timeLabel(item.visitedAt)}
              onPress={() => toggle(item.id)}
              selected={selected.has(item.id)}
            />
          ) : (
            <Row
              title={item.title}
              url={item.url}
              meta={timeLabel(item.visitedAt)}
              onPress={() => onOpen(item.url)}
              onLongPress={() => startSelecting(item)}
              onRemove={() => remove(item)}
            />
          )
        }
        onEndReached={() => {
          loadMore().catch(() => {});
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          spinner ? undefined : <Empty title={t(result.loadedQuery ? 'library.noResults' : 'library.emptyHistory')} />
        }
        ListFooterComponent={spinner ? <ActivityIndicator style={styles.footer} /> : undefined}
      />
      {selecting ? (
        <View style={styles.deleteBar}>
          <Pressable
            onPress={deleteSelected}
            disabled={count === 0 || deleting}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed, (count === 0 || deleting) && styles.dimmed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: count === 0 || deleting }}
          >
            <Icon name="trash" size={18} color={palette.danger} />
            <Text style={styles.danger} numberOfLines={1}>
              {t('library.deleteSelected', { count })}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** The edit and move dialogs, drawn inside the library's own modal. */
type Editor =
  | { kind: 'edit'; bookmark: Bookmark }
  | {
      kind: 'move';
      title: string;
      current: number | null;
      /** A folder being moved can't go into itself or its own subfolders. */
      exclude?: number;
      onPick: (folderId: number | null) => void;
    };

type ListItem = { kind: 'folder'; folder: FolderEntry } | { kind: 'bookmark'; bookmark: Bookmark };

function BookmarkList({ query, onOpen }: { query: string; onOpen: (url: string) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [folderId, setFolderId] = useState<number | null>(null);
  const [data, setData] = useState<{ all: BookmarkFolder[]; folders: FolderEntry[]; bookmarks: Bookmark[] } | null>(
    null,
  );
  const [reload, setReload] = useState(0);
  const [menu, setMenu] = useState<{ title: string; actions: SheetAction[] } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const searching = query.trim().length > 0;
  const refresh = () => setReload((n) => n + 1);
  // Changes the assistant makes show at once.
  useEffect(() => onBookmarksChanged(() => setReload((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then(async (db) => {
        const [all, folders, bookmarks] = await Promise.all([
          allFolders(db),
          searching ? Promise.resolve([]) : listFolders(db, folderId),
          // A search looks through every folder.
          listBookmarks(db, searching ? { query } : { folderId }),
        ]);
        return { all, folders, bookmarks };
      })
      .catch((e) => (reportStorageFailure('bookmarks.list', e, 'user'), { all: [], folders: [], bookmarks: [] }))
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        // The open folder was deleted: back to the top level.
        if (folderId !== null && !loaded.all.some((f) => f.id === folderId)) setFolderId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [query, searching, folderId, reload]);

  const byId = useMemo(() => new Map((data?.all ?? []).map((f) => [f.id, f])), [data]);
  // The open folder and its parents, outermost first.
  const path: BookmarkFolder[] = [];
  for (let id = folderId; id !== null; ) {
    const folder = byId.get(id);
    if (!folder || path.includes(folder)) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  const current = path[path.length - 1];
  const folderName = (id: number | null) => (id === null ? t('library.bookmarks') : (byId.get(id)?.title ?? ''));

  const run = async (task: (db: Db) => Promise<unknown>) => {
    try {
      await task(await getDb());
    } catch (e) {
      dialog.alert(t('common.error', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      refresh();
    }
  };

  const openFolder = (id: number | null) => {
    tick();
    setFolderId(id);
  };

  /** Asks for a folder name; nothing happens when cancelled. */
  const askName = async (title: string, initial: string, save: (name: string) => (db: Db) => Promise<unknown>) => {
    const name = await dialog.prompt({ title, label: t('library.folderName'), initial, maxLength: 200 });
    if (name) await run(save(name));
  };

  const newFolder = () => void askName(t('library.newFolder'), '', (name) => (db) => createFolder(db, name, folderId));

  const deleteFolderAsking = async (folder: BookmarkFolder) => {
    const db = await getDb();
    const contents = await folderContents(db, folder.id);
    if (!contents.bookmarks && !contents.folders) {
      await run(() => deleteFolder(db, folder.id));
      return;
    }
    dialog.alert(
      t('library.deleteFolderConfirm', { name: folder.title }),
      t('library.deleteFolderContents', contents),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('library.delete'), style: 'destructive', onPress: () => run(() => deleteFolder(db, folder.id)) },
      ],
    );
  };

  const folderMenu = (folder: FolderEntry) => {
    bump();
    setMenu({
      title: folder.title,
      actions: [
        {
          label: t('library.rename'),
          onPress: () =>
            void askName(t('library.renameFolder'), folder.title, (name) => (db) => renameFolder(db, folder.id, name)),
        },
        {
          label: t('library.moveTo'),
          onPress: () =>
            setEditor({
              kind: 'move',
              title: folder.title,
              current: folder.parentId,
              exclude: folder.id,
              onPick: (parentId) => run((db) => moveFolder(db, folder.id, parentId)),
            }),
        },
        { label: t('library.delete'), destructive: true, onPress: () => void deleteFolderAsking(folder) },
      ],
    });
  };

  const bookmarkMenu = (bookmark: Bookmark) => {
    bump();
    setMenu({
      title: bookmark.title || hostOf(bookmark.url),
      actions: [
        { label: t('library.open'), onPress: () => onOpen(bookmark.url) },
        { label: t('library.edit'), onPress: () => setEditor({ kind: 'edit', bookmark }) },
        {
          label: t('library.moveTo'),
          onPress: () =>
            setEditor({
              kind: 'move',
              title: bookmark.title || hostOf(bookmark.url),
              current: bookmark.folderId,
              onPick: (id) => run((db) => updateBookmark(db, bookmark.url, { folderId: id })),
            }),
        },
        {
          label: t('library.delete'),
          destructive: true,
          onPress: () => run((db) => removeBookmark(db, bookmark.url)),
        },
      ],
    });
  };

  const importFile = async () => {
    let text: string | null;
    try {
      text = await pickBookmarkFile();
    } catch (e) {
      dialog.alert(
        t('library.importFailed'),
        t(e instanceof PickerUnavailableError ? 'library.importNeedsBuild' : 'library.importUnreadable'),
      );
      return;
    }
    if (text === null) return;
    setBusy(true);
    try {
      let tree: ParsedFolder;
      try {
        tree = parseBookmarkFile(text);
      } catch (e) {
        if (!(e instanceof BookmarkFileError)) throw e;
        dialog.alert(
          t('library.importFailed'),
          t(e.reason === 'empty' ? 'library.importEmpty' : 'library.importNotBookmarkFile'),
        );
        return;
      }
      const db = await getDb();
      const plan = planImport(tree, await bookmarkedUrls(db), { untitledFolder: t('library.untitledFolder') });
      const skipped = [
        plan.duplicates ? t('library.importDuplicates', { count: plan.duplicates }) : '',
        plan.unsupported ? t('library.importUnsupported', { count: plan.unsupported }) : '',
      ].filter(Boolean);
      if (!plan.bookmarks.length) {
        dialog.alert(t('library.importNothing'), skipped.join('\n'));
        return;
      }
      const id = await importBookmarks(db, plan, t('library.importedFolder', { date: formatDate(new Date()) }));
      success();
      setFolderId(id);
      refresh();
      dialog.alert(
        t('library.importDone'),
        [
          t('library.importSummary', { bookmarks: plan.bookmarks.length, folders: plan.folders.length + 1 }),
          ...skipped,
        ].join('\n'),
      );
    } catch (e) {
      dialog.alert(t('library.importFailed'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportFile = async () => {
    setBusy(true);
    try {
      const { folders, bookmarks } = await exportData(await getDb());
      if (!bookmarks.length) {
        dialog.alert(t('library.exportEmpty'));
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      await shareBookmarkFile(serializeBookmarkFile(folders, bookmarks), `qutai-bookmarks-${date}.html`);
    } catch (e) {
      dialog.alert(t('common.error', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <ActivityIndicator style={styles.footer} />;
  const items: ListItem[] = [
    ...data.folders.map((folder) => ({ kind: 'folder' as const, folder })),
    ...data.bookmarks.map((bookmark) => ({ kind: 'bookmark' as const, bookmark })),
  ];
  const optionsAction = [{ name: 'longpress', label: t('library.options') }];

  return (
    <View style={styles.flex}>
      <FlatList
        contentContainerStyle={readableColumn}
        data={items}
        keyExtractor={(item) => (item.kind === 'folder' ? `f${item.folder.id}` : item.bookmark.url)}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          searching ? undefined : (
            <View>
              {current && (
                <Pressable
                  onPress={() => openFolder(current.parentId)}
                  style={({ pressed }) => [styles.pathBar, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('library.backTo', { name: folderName(current.parentId) })}
                >
                  <Icon name="back" size={20} color={palette.tintText} />
                  <View style={styles.rowText}>
                    <Text style={styles.pathParents} numberOfLines={1}>
                      {[t('library.bookmarks'), ...path.slice(0, -1).map((f) => f.title)].join(' › ')}
                    </Text>
                    <Text style={styles.pathTitle} numberOfLines={1} accessibilityRole="header">
                      {current.title}
                    </Text>
                  </View>
                </Pressable>
              )}
              <View style={styles.toolbar}>
                <ToolButton icon="newFolder" label={t('library.newFolder')} onPress={newFolder} />
                {folderId === null && (
                  <>
                    <ToolButton
                      icon="download"
                      label={t('library.import')}
                      accessibilityLabel={t('library.importBookmarks')}
                      disabled={busy}
                      onPress={() => void importFile()}
                    />
                    <ToolButton
                      icon="share"
                      label={t('library.export')}
                      accessibilityLabel={t('library.exportBookmarks')}
                      disabled={busy}
                      onPress={() => void exportFile()}
                    />
                  </>
                )}
                {busy && <ActivityIndicator />}
              </View>
            </View>
          )
        }
        renderItem={({ item }) =>
          item.kind === 'folder' ? (
            <Pressable
              onPress={() => openFolder(item.folder.id)}
              onLongPress={() => folderMenu(item.folder)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.folder.title}, ${t('library.folderItems', { count: item.folder.items })}`}
              accessibilityActions={optionsAction}
              onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && folderMenu(item.folder)}
            >
              <View style={styles.badge}>
                <Icon name="folder" size={18} color={palette.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.folder.title}
                </Text>
                <Text style={styles.rowUrl} numberOfLines={1}>
                  {t('library.folderItems', { count: item.folder.items })}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={palette.textSecondary} />
            </Pressable>
          ) : (
            <Row
              title={item.bookmark.title}
              url={item.bookmark.url}
              // In search results, which folder each match is in.
              meta={searching && item.bookmark.folderId !== null ? folderName(item.bookmark.folderId) : undefined}
              onPress={() => onOpen(item.bookmark.url)}
              onMore={() => bookmarkMenu(item.bookmark)}
            />
          )
        }
        ListEmptyComponent={
          searching ? (
            <Empty title={t('library.noResults')} />
          ) : folderId !== null ? (
            <Empty title={t('library.emptyFolder')} />
          ) : (
            <Empty title={t('library.emptyBookmarks')} hint={t('library.emptyBookmarksHint')} />
          )
        }
        ListFooterComponent={
          !searching && folderId === null ? <Text style={styles.importHint}>{t('library.importHint')}</Text> : undefined
        }
      />

      <ActionSheet title={menu?.title ?? null} actions={menu?.actions ?? []} onClose={() => setMenu(null)} />

      {editor?.kind === 'move' && (
        <FolderPicker
          title={t('library.moveItem', { name: editor.title })}
          folders={data.all}
          current={editor.current}
          exclude={editor.exclude}
          onCancel={() => setEditor(null)}
          onPick={(id) => {
            setEditor(null);
            if (id !== editor.current) editor.onPick(id);
          }}
        />
      )}
      {editor?.kind === 'edit' && (
        <EditBookmarkDialog
          bookmark={editor.bookmark}
          folders={data.all}
          folderName={folderName}
          onCancel={() => setEditor(null)}
          onSave={(changes) => {
            setEditor(null);
            void run((db) => updateBookmark(db, editor.bookmark.url, changes));
          }}
        />
      )}
    </View>
  );
}

function ToolButton({
  icon,
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.toolButton, pressed && styles.pressed, disabled && styles.dimmed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
    >
      <Icon name={icon} size={16} color={palette.tintText} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

/** A dialog drawn inside the library's own modal (a second modal over a closing action sheet is unreliable on iOS). */
function Overlay({ onCancel, children }: { onCancel: () => void; children: ReactNode }) {
  const styles = useStyles();
  return (
    // The dialog stays centered in the space above the keyboard (the Modal's window does not resize for it).
    <KeyboardAvoidingContainer style={[StyleSheet.absoluteFill, styles.overlay]}>
      <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={t('common.close')} />
      <View style={styles.dialog} accessibilityViewIsModal>
        {children}
      </View>
    </KeyboardAvoidingContainer>
  );
}

function DialogButtons({
  onCancel,
  onSave,
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.dialogButtons}>
      <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
        <Text style={styles.action}>{t('common.cancel')}</Text>
      </Pressable>
      <Pressable
        onPress={onSave}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.action, styles.bold, disabled && styles.dimmed]}>{t('common.save')}</Text>
      </Pressable>
    </View>
  );
}

function EditBookmarkDialog({
  bookmark,
  folders,
  folderName,
  onCancel,
  onSave,
}: {
  bookmark: Bookmark;
  folders: BookmarkFolder[];
  folderName: (id: number | null) => string;
  onCancel: () => void;
  onSave: (changes: { title: string; folderId: number | null }) => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const [title, setTitle] = useState(bookmark.title);
  const [folderId, setFolderId] = useState(bookmark.folderId);
  const [picking, setPicking] = useState(false);

  if (picking) {
    return (
      <FolderPicker
        title={t('library.folder')}
        folders={folders}
        current={folderId}
        onCancel={() => setPicking(false)}
        onPick={(id) => {
          setFolderId(id);
          setPicking(false);
        }}
      />
    );
  }
  const save = () => onSave({ title: title.trim(), folderId });
  return (
    <Overlay onCancel={onCancel}>
      <Text style={styles.dialogTitle} accessibilityRole="header">
        {t('library.editBookmark')}
      </Text>
      <Text style={styles.fieldLabel}>{t('library.bookmarkTitle')}</Text>
      <TextInput
        style={styles.dialogInput}
        placeholderTextColor={palette.textSecondary}
        value={title}
        onChangeText={setTitle}
        placeholder={hostOf(bookmark.url)}
        accessibilityLabel={t('library.bookmarkTitle')}
        returnKeyType="done"
        onSubmitEditing={save}
        maxLength={500}
      />
      <Text style={styles.dialogUrl} numberOfLines={1}>
        {bookmark.url}
      </Text>
      <Text style={styles.fieldLabel}>{t('library.folder')}</Text>
      <Pressable
        onPress={() => setPicking(true)}
        style={({ pressed }) => [styles.folderField, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t('library.folder')}: ${folderName(folderId)}`}
      >
        <Icon name={folderId === null ? 'bookmarks' : 'folder'} size={18} color={palette.textSecondary} />
        <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>
          {folderName(folderId)}
        </Text>
        <Icon name="chevronRight" size={16} color={palette.textSecondary} />
      </Pressable>
      <DialogButtons onCancel={onCancel} onSave={save} disabled={false} />
    </Overlay>
  );
}

/** Folders as an indented tree, alphabetical at each level; `exclude` leaves out a folder and its subfolders. */
function folderTree(folders: BookmarkFolder[], exclude?: number) {
  const ids = new Set(folders.map((f) => f.id));
  const children = new Map<number | null, BookmarkFolder[]>();
  for (const folder of folders) {
    const parent = folder.parentId !== null && ids.has(folder.parentId) ? folder.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), folder]);
  }
  const rows: { id: number | null; title: string; depth: number }[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const folder of children.get(parent) ?? []) {
      if (folder.id === exclude) continue;
      rows.push({ id: folder.id, title: folder.title, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 1);
  return rows;
}

function FolderPicker({
  title,
  folders,
  current,
  exclude,
  onPick,
  onCancel,
}: {
  title: string;
  folders: BookmarkFolder[];
  current: number | null;
  exclude?: number;
  onPick: (id: number | null) => void;
  onCancel: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const rows = useMemo(
    () => [{ id: null, title: t('library.bookmarks'), depth: 0 }, ...folderTree(folders, exclude)],
    [folders, exclude],
  );
  return (
    <Overlay onCancel={onCancel}>
      <Text style={styles.dialogTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <FlatList
        style={styles.pickerList}
        data={rows}
        keyExtractor={(row) => String(row.id)}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              tick();
              onPick(item.id);
            }}
            style={({ pressed }) => [styles.pickerRow, { paddingLeft: 8 + item.depth * 18 }, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === current }}
          >
            <Icon name={item.id === null ? 'bookmarks' : 'folder'} size={18} color={palette.textSecondary} />
            <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.id === current && <Icon name="check" size={18} color={palette.tintText} />}
          </Pressable>
        )}
      />
      <View style={styles.dialogButtons}>
        <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button">
          <Text style={styles.action}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </Overlay>
  );
}

function Row({
  title,
  url,
  meta,
  onPress,
  onLongPress,
  onRemove,
  onMore,
  selected,
}: {
  title: string;
  url: string;
  meta?: string;
  onPress: () => void;
  /** Long press when there is no options sheet (History: starts select mode). */
  onLongPress?: () => void;
  onRemove?: () => void;
  /** Select mode: a checkbox instead of the ✕ button, and a tap toggles it. */
  selected?: boolean;
  /** Options sheet: a ⋯ button and long press instead of the ✕ button. */
  onMore?: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const host = hostOf(url);
  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      onPress={onPress}
      onLongPress={onMore ?? onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityActions={onMore ? [{ name: 'longpress', label: t('library.options') }] : undefined}
      onAccessibilityAction={onMore ? (e) => e.nativeEvent.actionName === 'longpress' && onMore() : undefined}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{(host[0] || '?').toUpperCase()}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title || host}
        </Text>
        <Text style={styles.rowUrl} numberOfLines={1}>
          {meta ? `${meta} · ${host}` : host}
        </Text>
      </View>
      {selected !== undefined ? (
        <View style={[styles.checkBox, selected && styles.checkBoxOn]}>
          {selected && <Icon name="check" size={16} color={palette.onTint} />}
        </View>
      ) : onMore ? (
        <Pressable onPress={onMore} hitSlop={10} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('library.options')}>
          <Icon name="more" size={16} color={palette.textSecondary} />
        </Pressable>
      ) : onRemove ? (
        <Pressable onPress={onRemove} hitSlop={10} style={styles.remove} accessibilityRole="button" accessibilityLabel={t('library.delete')}>
          <Icon name="close" size={14} color={palette.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function Empty({ title, hint }: { title: string; hint?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint && <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 12 },
  segment: { ...common(c).segment, flex: 1 },
  segmentButton: { ...common(c).segmentButton, paddingVertical: 7, paddingHorizontal: 4 },
  segmentSelected: common(c).segmentSelected,
  segmentText: { fontSize: 14, color: c.text },
  bold: { fontWeight: '700' },
  action: { fontSize: 16, color: c.tintText },
  search: {
    color: c.text,
    marginHorizontal: 12,
    marginBottom: 8,
    // Grows with large text sizes instead of clipping the text.
    minHeight: 38,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
    backgroundColor: c.pressed,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  pressed: { backgroundColor: c.pressed },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 15, fontWeight: '700', color: c.textSecondary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: c.text },
  rowUrl: { fontSize: 12, color: c.textSecondary },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  checkBox: {
    width: 22,
    height: 22,
    marginHorizontal: 3,
    borderRadius: radii.inner,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: c.tint, borderColor: c.tint },
  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 30,
  },
  selectCount: { flexShrink: 1, fontSize: 14, color: c.textSecondary, textAlign: 'center' },
  deleteBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.control,
  },
  footer: { paddingVertical: 20, alignItems: 'center' },
  danger: { color: c.danger, fontSize: 15, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: c.textSecondary },
  emptyHint: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
  flex: { flex: 1 },
  dimmed: { opacity: 0.4 },
  pathBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pathParents: { fontSize: 12, color: c.textSecondary },
  pathTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  toolText: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  importHint: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 16, paddingVertical: 20, lineHeight: 18 },
  overlay: { backgroundColor: c.backdrop, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: c.bg, borderRadius: radii.window, padding: 16, gap: 10, maxHeight: '80%' },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  dialogInput: {
    color: c.text,
    height: 42,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 16,
  },
  dialogUrl: { fontSize: 12, color: c.textSecondary },
  dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, paddingTop: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginTop: 4 },
  folderField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: radii.control,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  pickerList: { flexGrow: 0 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
    paddingVertical: 11,
    borderRadius: radii.control,
  },
}));
