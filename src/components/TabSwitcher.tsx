import { createContext, useContext, useEffect, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { previewRatio, tabCardWidth, tabColumns } from '../ui/layout';
import { Browser, ClosedGroup, TabGroup, useBrowser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { matchesTabQuery } from '../browser/tabSearch';
import { bump } from '../device/haptics';
import { incognitoInfoKey, incognitoIsolated } from '../device/webviewProfile';
import { ActionSheet, SheetAction } from './ActionSheet';
import { dropTab, Measurable, sectionsOf, TabDrag } from './tabDrag';
import { t } from '../i18n';
import { makeStyles, usePalette, radii } from '../ui/theme';
import { Icon, IconName } from '../ui/Icon';
import { siteColor } from '../ui/siteColor';
import { hostOf } from '../i18n/format';
import { dialog, DialogHost } from './Dialog';
import { KeyboardAwareScrollView } from './KeyboardAware';
import { HEADER_FONT_SCALE } from './ScreenHeader';

type Props = {
  visible: boolean;
  /** Dark theme; incognito tabs are always dark. */
  darkMode?: boolean;
  browser: Browser;
  onClose: () => void;
  /** The user picked tabs to compare with the assistant. */
  onCompare: (tabs: Tab[]) => void;
};

const PADDING = 12;

const DarkMode = createContext(false);

const WARNING_TEXT = '#f5d48a';

/** The address after the site, e.g. "/dp/B0C…?ref=x" → "/dp/B0C…". */
function pathOf(url: string): string {
  return url.replace(/^[a-z]+:\/\/[^/]+/i, '').replace(/[?#].*$/, '') || '/';
}

/** Icon colours that match a theme's text styles. */
function iconColors(theme: object) {
  return theme === light
    ? { text: '#222222', dim: '#6b6862', accent: '#1460b4' }
    : theme === darkNormal
      ? { text: '#f2f1f5', dim: '#a9a8b3', accent: '#5cb8f0' }
      : { text: '#f2f1f5', dim: '#a9a8b3', accent: '#c9a7ff' };
}

/** Incognito keeps its own purple look; the dark theme keeps the normal orange accent. */
function useTheme(incognito: boolean) {
  const darkMode = useContext(DarkMode);
  return incognito ? dark : darkMode ? darkNormal : light;
}
const GAP = 12;

export function TabSwitcher({ visible, darkMode = false, browser, onClose, onCompare }: Props) {
  return (
    <AppModal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      {/* Mounted only while visible, so it opens in the mode of the tab on screen. */}
      <DarkMode.Provider value={darkMode}>
        {visible && <TabSwitcherContent browser={browser} onClose={onClose} onCompare={onCompare} />}
      </DarkMode.Provider>
      <DialogHost />
    </AppModal>
  );
}

function TabSwitcherContent({ browser, onClose, onCompare }: Omit<Props, 'visible' | 'darkMode'>) {
  const styles = useStyles();
  // Redraws on its own when tabs or groups change, not only when the app does.
  useBrowser(browser);
  const [incognito, setIncognito] = useState(browser.active.incognito);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Columns by the room between the side safe areas: 2 upright on a phone, 3 on its side, 4 on a wide tablet.
  const contentWidth = width - insets.left - insets.right;
  const columns = tabColumns(contentWidth);
  const cardWidth = tabCardWidth(contentWidth, columns, PADDING, GAP);
  // A group's border and padding (10) come out of its cards' widths.
  const groupCardWidth = cardWidth - Math.ceil(10 / columns);
  const ratio = previewRatio({ width, height });

  const [query, setQuery] = useState('');
  // Compare mode: tapping cards selects them instead of switching tabs.
  const [comparing, setComparing] = useState<string[] | null>(null);
  const allTabs = browser.tabsOf(incognito);
  const searching = query.trim() !== '';
  const tabs = searching ? allTabs.filter((tab) => matchesTabQuery(tab, query)) : allTabs;
  const theme = useTheme(incognito);
  const darkMode = useContext(DarkMode);

  // Long press picks a card up for dragging; a long press without moving opens its menu.
  const [drag] = useState(() => new TabDrag());
  const [, setDragVersion] = useState(0);
  const [menuTab, setMenuTab] = useState<Tab | null>(null);
  useEffect(() => {
    drag.setHandlers({
      drop: (id, x, y) => dropTab(browser, id, drag.dropTargets, x, y),
      menu: (id) => setMenuTab(browser.getTab(id) ?? null),
      change: () => setDragVersion((v) => v + 1),
    });
  });
  const startDrag = (tab: Tab) => {
    bump();
    drag.start(tab.id);
  };

  /** The long-press menu of a card: grouping and closing. */
  const cardActions = (tab: Tab): SheetAction[] => [
    {
      label: t('tabs.newGroup'),
      onPress: () => browser.createGroup([tab.id], t('tabs.groupName', { number: browser.groups.length + 1 })),
    },
    ...browser.groups
      .filter((g) => g.id !== tab.groupId && browser.tabs.some((x) => x.groupId === g.id && x.incognito === incognito))
      .map((g) => ({ label: t('tabs.addToGroup', { name: g.name }), onPress: () => browser.setGroup(tab.id, g.id) })),
    ...(tab.groupId ? [{ label: t('tabs.removeFromGroup'), onPress: () => browser.setGroup(tab.id, null) }] : []),
    { label: t('tabs.closeTab'), destructive: true, onPress: () => closeTab(tab) },
  ];

  /** What the undo bar brings back: the last closed tab, or a whole closed group. */
  const [undo, setUndo] = useState<{ count: number; group?: ClosedGroup } | null>(null);
  // Bumped on every close, so the 4-second undo window restarts.
  const [undoKey, setUndoKey] = useState(0);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 4000);
    return () => clearTimeout(timer);
  }, [undo, undoKey]);
  const showUndo = (next: { count: number; group?: ClosedGroup }) => {
    setUndo(next);
    setUndoKey((k) => k + 1);
  };

  const closeTab = (tab: Tab) => {
    // Only normal web pages are remembered, so only those can be undone.
    bump();
    if (!browser.closeTab(tab.id)) return;
    showUndo({ count: 1 });
  };

  const undoClose = () => {
    setUndo(null);
    if (undo?.group) browser.restoreGroup(undo.group);
    else browser.reopenClosed(0);
  };

  // The group header's options: ungroup (tabs stay open) or close all of its tabs.
  const [menuGroup, setMenuGroup] = useState<TabGroup | null>(null);
  const groupSize = (group: TabGroup) => browser.tabs.filter((x) => x.groupId === group.id).length;

  const closeGroupTabs = async (group: TabGroup) => {
    if (browser.isTaskRunningIn(group.id)) {
      const confirmed = await dialog.confirm({
        title: t('tabs.groupTaskRunning'),
        message: t('tabs.groupTaskRunningBody'),
        confirmText: t('tabs.stopAndClose'),
        destructive: true,
      });
      if (!confirmed) return;
    }
    bump();
    // Incognito tabs are never remembered, so closing an incognito group can't be undone.
    const closed = browser.closeGroup(group.id);
    if (closed) showUndo({ count: closed.tabs.length, group: closed });
  };

  const groupActions = (group: TabGroup): SheetAction[] => {
    const count = groupSize(group);
    return [
      { label: t('tabs.ungroup'), onPress: () => browser.ungroup(group.id) },
      {
        label: count === 1 ? t('tabs.closeGroupTab') : t('tabs.closeGroupTabs', { count }),
        destructive: true,
        onPress: () => void closeGroupTabs(group),
      },
    ];
  };

  const select = (tab: Tab) => {
    if (comparing) {
      if (tab.isNewTab) return;
      setComparing(comparing.includes(tab.id) ? comparing.filter((id) => id !== tab.id) : [...comparing, tab.id]);
      return;
    }
    browser.switchTab(tab.id);
    onClose();
  };
  const comparable = allTabs.filter((tab) => !tab.isNewTab).length >= 2;
  const compareSelected = () => {
    const chosen = allTabs.filter((tab) => comparing?.includes(tab.id));
    if (chosen.length >= 2) onCompare(chosen);
  };

  const newTab = () => {
    browser.openTab(undefined, { incognito });
    onClose();
  };

  const closeAll = () => {
    dialog.alert(t(incognito ? 'tabs.closeAllIncognitoConfirm' : 'tabs.closeAllConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.close'),
        style: 'destructive',
        onPress: () => {
          if (incognito) browser.closeAllIncognito();
          else browser.closeTabs(browser.tabsOf(false).map((t) => t.id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, theme.container]}>
      <View style={styles.header}>
        <View style={[styles.segment, theme.segment]}>
          <SegmentButton
            label={t('tabs.normal', { count: browser.tabsOf(false).length })}
            selected={!incognito}
            incognito={incognito}
            onPress={() => {
              setIncognito(false);
              setQuery('');
              setComparing(null);
            }}
          />
          <SegmentButton
            label={t('tabs.incognito', { count: browser.tabsOf(true).length })}
            icon="incognito"
            selected={incognito}
            incognito={incognito}
            onPress={() => {
              setIncognito(true);
              setQuery('');
              setComparing(null);
            }}
          />
        </View>
      </View>

      {allTabs.length > 1 && (
        <View style={styles.searchRow}>
          <View style={[styles.search, theme.search]}>
            <Icon name="find" size={17} color={iconColors(theme).dim} />
            <TextInput
              style={[styles.searchInput, theme.text]}
              value={query}
              onChangeText={setQuery}
              placeholder={t('tabs.search')}
              placeholderTextColor={incognito ? '#a9a8b3' : '#6b6862'}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel={t('tabs.search')}
            />
          </View>
          {/* Next to search rather than over the Tabs/Incognito switch, so it never collides or gets cut. */}
          {comparable && !comparing ? (
            <Pressable onPress={() => setComparing([])} hitSlop={6} style={styles.compare} accessibilityRole="button">
              <Icon name="compare" size={17} color={iconColors(theme).accent} />
              <Text style={[styles.compareText, theme.accent]} numberOfLines={1}>
                {t('tabs.compare')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {incognito && !incognitoIsolated() && allTabs.length > 0 && (
        <View style={styles.warning}>
          <Icon name="insecure" size={16} color={WARNING_TEXT} style={styles.warningIcon} />
          <Text style={styles.warningText}>{t('tabs.androidIncognitoWarning')}</Text>
        </View>
      )}

      {/* A group's name is edited in place; it scrolls into view above the keyboard. */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.grid}
        scrollEnabled={drag.id === null}
        {...drag.responder.panHandlers}
      >
        {tabs.length === 0 &&
          (searching ? (
            <Text style={[styles.noResults, theme.dimText]}>{t('tabs.noResults')}</Text>
          ) : (
            <EmptyState incognito={incognito} />
          ))}
        {sectionsOf(tabs, browser).map((section) => {
          const group = browser.getGroup(section.groupId ?? undefined);
          return (
            <View key={section.key} style={group ? [styles.group, { borderColor: group.color }] : undefined}>
              {group && (
                <GroupHeader
                  group={group}
                  count={section.tabs.length}
                  incognito={incognito}
                  register={(view) => drag.register('group', group.id, view)}
                  onToggle={() => browser.toggleGroup(group.id)}
                  onRename={(name) => browser.renameGroup(group.id, name)}
                  onOptions={() => setMenuGroup(group)}
                />
              )}
              {group?.collapsed ? null : (
                <View style={styles.cards}>
                  {section.tabs.map((item) => (
                    <TabCard
                      key={item.id}
                      tab={item}
                      width={group ? groupCardWidth : cardWidth}
                      previewShape={ratio}
                      active={item.id === browser.activeId}
                      incognito={incognito}
                      selection={
                        comparing ? { selected: comparing.includes(item.id), disabled: item.isNewTab } : undefined
                      }
                      dragging={drag.id === item.id ? drag.pan : undefined}
                      register={(view) => drag.register('tab', item.id, view)}
                      onPress={() => select(item)}
                      onLongPress={comparing || searching ? undefined : () => startDrag(item)}
                      onPressOut={() => drag.pressOut(item.id)}
                      onCloseTab={() => closeTab(item)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {incognito || searching ? null : (
          <RecentlyClosed
            browser={browser}
            onReopen={(index) => {
              browser.reopenClosed(index);
              onClose();
            }}
          />
        )}
      </KeyboardAwareScrollView>

      <ActionSheet
        title={menuTab ? menuTab.title || menuTab.url : null}
        actions={menuTab ? cardActions(menuTab) : []}
        dark={incognito || darkMode}
        onClose={() => setMenuTab(null)}
      />

      <ActionSheet
        title={
          menuGroup
            ? t(groupSize(menuGroup) === 1 ? 'tabs.groupSheetTitleOne' : 'tabs.groupSheetTitle', {
                name: menuGroup.name,
                count: groupSize(menuGroup),
              })
            : null
        }
        actions={menuGroup ? groupActions(menuGroup) : []}
        dark={incognito || darkMode}
        onClose={() => setMenuGroup(null)}
      />

      {undo && (
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <Text style={styles.undoText}>
            {undo.count === 1 ? t('tabs.closed') : t('tabs.closedCount', { count: undo.count })}
          </Text>
          <Pressable onPress={undoClose} hitSlop={8} accessibilityRole="button">
            <Text style={styles.undoAction}>{t('tabs.undo')}</Text>
          </Pressable>
        </View>
      )}

      {comparing ? (
        <View style={[styles.toolbar, theme.toolbar]}>
          <Pressable accessibilityRole="button" onPress={() => setComparing(null)} hitSlop={8} style={styles.toolbarCancel}>
            <Text style={[styles.toolbarText, theme.text]} numberOfLines={1} maxFontSizeMultiplier={HEADER_FONT_SCALE}>
              {t('common.cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={compareSelected}
            disabled={comparing.length < 2}
            style={[styles.compareButton, theme.newTab, comparing.length < 2 && styles.dimmed]}
            accessibilityRole="button"
          >
            <Text style={styles.compareButtonText} numberOfLines={2} maxFontSizeMultiplier={HEADER_FONT_SCALE}>
              {comparing.length < 2 ? t('tabs.compareHint') : t('tabs.compareCount', { count: comparing.length })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.toolbar, theme.toolbar]}>
          <Pressable accessibilityRole="button" onPress={closeAll} disabled={allTabs.length === 0} hitSlop={8} style={styles.toolbarSide}>
            <Text
              style={[styles.toolbarText, theme.text, allTabs.length === 0 && styles.dimmed]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={HEADER_FONT_SCALE}
            >
              {t('tabs.closeAll')}
            </Text>
          </Pressable>
          <Pressable
            onPress={newTab}
            style={[styles.newTab, theme.newTab]}
            accessibilityRole="button"
            accessibilityLabel={t(incognito ? 'menu.newIncognitoTab' : 'menu.newTab')}
          >
            <Icon name="newTab" size={26} color="#ffffff" />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={[styles.toolbarSide, styles.alignRight]}>
            <Text
              style={[styles.toolbarText, styles.bold, theme.accent]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={HEADER_FONT_SCALE}
            >
              {t('common.done')}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const RECENT_SHOWN = 8;

function RecentlyClosed({ browser, onReopen }: { browser: Browser; onReopen: (index: number) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const closed = browser.recentlyClosed.slice(0, RECENT_SHOWN);
  if (closed.length === 0) return null;
  return (
    <View style={styles.recent}>
      <Text style={styles.recentTitle}>{t('tabs.recentlyClosed')}</Text>
      {closed.map((item, index) => (
        <Pressable
          key={`${item.closedAt}-${index}`}
          onPress={() => onReopen(index)}
          style={({ pressed }) => [styles.recentRow, pressed && styles.recentPressed]}
          accessibilityRole="button"
        >
          <Icon name="reopen" size={16} color={palette.textSecondary} />
          <View style={styles.recentText}>
            <Text style={styles.recentRowTitle} numberOfLines={1}>
              {item.title || hostOf(item.url)}
            </Text>
            <Text style={styles.recentHost} numberOfLines={1}>
              {hostOf(item.url)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function SegmentButton({
  label,
  icon,
  selected,
  incognito,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  incognito: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme(incognito);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, selected && theme.segmentSelected]}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
    >
      {icon ? <Icon name={icon} size={16} color={iconColors(theme).text} /> : null}
      <Text
        style={[styles.segmentText, theme.text, selected && styles.bold]}
        numberOfLines={1}
        maxFontSizeMultiplier={HEADER_FONT_SCALE}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GroupHeader({
  group,
  count,
  incognito,
  register,
  onToggle,
  onRename,
  onOptions,
}: {
  group: TabGroup;
  count: number;
  incognito: boolean;
  register: (view: Measurable | null) => void;
  onToggle: () => void;
  onRename: (name: string) => void;
  /** Opens the group's options (ungroup, or close all of its tabs). */
  onOptions: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme(incognito);
  const [name, setName] = useState(group.name);
  return (
    <View ref={(view) => register(view)} style={styles.groupHeader}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: !group.collapsed }}
        accessibilityLabel={group.name}
      >
        <Icon name={group.collapsed ? 'chevronRight' : 'chevronDown'} size={16} color={group.color} />
      </Pressable>
      <TextInput
        value={name}
        onChangeText={setName}
        onEndEditing={() => onRename(name)}
        style={[styles.groupName, { color: group.color }]}
        maxLength={40}
        returnKeyType="done"
        accessibilityLabel={t('tabs.groupNameA11y')}
      />
      <Text style={[styles.groupCount, theme.dimText]}>{count}</Text>
      <Pressable
        onPress={onOptions}
        hitSlop={8}
        accessibilityLabel={t('tabs.groupOptions', { name: group.name })}
        accessibilityRole="button"
      >
        <Icon name="close" size={14} color={iconColors(theme).dim} />
      </Pressable>
    </View>
  );
}

function TabCard({
  tab,
  width,
  previewShape,
  active,
  incognito,
  selection,
  dragging,
  register,
  onPress,
  onLongPress,
  onPressOut,
  onCloseTab,
}: {
  tab: Tab;
  width: number;
  /** Preview height / width: the window's shape (previewRatio in src/ui/layout.ts). */
  previewShape: number;
  active: boolean;
  incognito: boolean;
  /** Set in compare mode. */
  selection?: { selected: boolean; disabled: boolean };
  /** The finger's offset while this card is being dragged. */
  dragging?: Animated.ValueXY;
  register: (view: Measurable | null) => void;
  onLongPress?: () => void;
  onPressOut: () => void;
  onPress: () => void;
  onCloseTab: () => void;
}) {
  const styles = useStyles();
  const theme = useTheme(incognito);
  const previewHeight = width * previewShape;
  // The new tab page has no host; the card falls back to its "New tab" title.
  const host = tab.isNewTab ? '' : hostOf(tab.url);

  return (
    <Animated.View
      ref={(view) => register(view)}
      style={dragging && [styles.dragging, { transform: dragging.getTranslateTransform() }]}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        delayLongPress={350}
        style={[
          styles.card,
          theme.card,
          { width },
          (selection ? selection.selected : active) && theme.activeCard,
          selection?.disabled && styles.dimmed,
        ]}
        accessibilityLabel={t('tabs.tabA11y', { title: tab.title || host })}
        accessibilityState={selection ? { selected: selection.selected, disabled: selection.disabled } : undefined}
      >
        <View style={styles.cardHeader}>
          {tab.playback.audible && !selection && (
            // This tab plays sound (also while another tab is on screen); a tap pauses it.
            <Pressable
              onPress={() => tab.playback.command('pause')}
              hitSlop={8}
              style={styles.cardSpeaker}
              accessibilityRole="button"
              accessibilityLabel={t('tabs.playingPause')}
            >
              <Icon name="readAloud" size={14} color={iconColors(theme).accent} />
            </Pressable>
          )}
          <Text style={[styles.cardTitle, theme.text]} numberOfLines={1}>
            {tab.title || host || t('menu.newTab')}
          </Text>
          {selection ? (
            <View style={styles.cardClose}>
              <Icon
                name={selection.selected ? 'selected' : 'unselected'}
                size={18}
                color={selection.selected ? iconColors(theme).accent : iconColors(theme).dim}
              />
            </View>
          ) : (
            <Pressable
              onPress={onCloseTab}
              hitSlop={10}
              style={styles.cardClose}
              accessibilityRole="button"
              accessibilityLabel={t('tabs.closeTab')}
            >
              <Icon name="close" size={14} color={iconColors(theme).text} />
            </Pressable>
          )}
        </View>
        <View style={[styles.preview, theme.preview, { height: previewHeight }]}>
          {tab.thumbnail ? (
            // Sized by the captured aspect ratio and clipped, so the top of the page is what shows.
            <Image source={{ uri: tab.thumbnail }} style={{ width, height: width / tab.thumbnailAspect }} />
          ) : (
            // No snapshot yet (e.g. restored tabs): the site plus the page's own title and path, so
            // several tabs of one site still look different.
            <View style={styles.placeholder}>
              <View style={styles.placeholderSite}>
                <View style={[styles.badge, { backgroundColor: siteColor(host) }]}>
                  <Text style={styles.badgeLetter}>{(host[0] || '?').toUpperCase()}</Text>
                </View>
                <Text style={[styles.placeholderHost, theme.dimText]} numberOfLines={1}>
                  {host}
                </Text>
              </View>
              <Text style={[styles.placeholderTitle, theme.text]} numberOfLines={4}>
                {tab.title || host}
              </Text>
              <Text style={[styles.placeholderPath, theme.dimText]} numberOfLines={1}>
                {pathOf(tab.url)}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ incognito }: { incognito: boolean }) {
  const styles = useStyles();
  const theme = useTheme(incognito);
  return (
    <View style={styles.empty}>
      <Icon name={incognito ? 'incognito' : 'tabs'} size={44} color={iconColors(theme).dim} />
      <Text style={[styles.emptyTitle, theme.text]}>{t(incognito ? 'tabs.emptyIncognito' : 'tabs.empty')}</Text>
      {incognito && (
        <Text style={[styles.emptyBody, theme.dimText]}>
          {t('tabs.incognitoInfo')} {t(incognitoInfoKey())}
        </Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1 },
  header: { paddingHorizontal: PADDING, paddingVertical: 10, alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: PADDING, marginBottom: 4 },
  compare: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 38, paddingHorizontal: 8 },
  compareText: { fontSize: 15, fontWeight: '600' },
  compareButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareButtonText: { color: c.onTint, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  segment: { flexDirection: 'row', borderRadius: radii.control, padding: 3 },
  segmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: radii.inner,
    flexShrink: 1,
  },
  segmentText: { fontSize: 14, flexShrink: 1 },
  bold: { fontWeight: '700' },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: PADDING,
    marginBottom: 4,
    padding: 10,
    borderRadius: radii.control,
    backgroundColor: '#4a3b1a',
  },
  warningIcon: { marginTop: 0.5 },
  warningText: { flex: 1, color: WARNING_TEXT, fontSize: 12, lineHeight: 17 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingHorizontal: 12,
    minHeight: 38,
    borderRadius: radii.control,
  },
  searchIcon: { fontSize: 17 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0, height: '100%' },
  noResults: { textAlign: 'center', fontSize: 15, marginTop: 40 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  group: { borderLeftWidth: 3, paddingLeft: 7, gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 32 },
  groupName: { flex: 1, fontSize: 15, fontWeight: '700', paddingVertical: 0 },
  groupCount: { fontSize: 13 },
  groupUngroup: { fontSize: 13, paddingHorizontal: 4 },
  dragging: { zIndex: 20, elevation: 12, opacity: 0.92 },
  grid: { padding: PADDING, gap: GAP, flexGrow: 1 },
  row: { gap: GAP },
  card: { borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, height: 34 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '500' },
  cardClose: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  cardSpeaker: { width: 26, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: -6 },
  cardCloseText: { fontSize: 13 },
  preview: { overflow: 'hidden' },
  placeholder: { flex: 1, padding: 10, gap: 8 },
  placeholderSite: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  badgeLetter: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  placeholderHost: { flex: 1, fontSize: 11.5 },
  placeholderTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  placeholderPath: { fontSize: 11, marginTop: 'auto' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  undoBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(30,30,30,0.94)',
  },
  undoText: { color: c.onTint, fontSize: 14 },
  undoAction: { color: '#7cc8f2', fontSize: 14, fontWeight: '700' },
  recent: { marginTop: 8, borderRadius: radii.card, backgroundColor: c.surface, paddingVertical: 6 },
  recentTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, paddingHorizontal: 14, paddingVertical: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8 },
  recentPressed: { backgroundColor: c.pressed },
  recentIcon: { fontSize: 16, color: c.textSecondary, width: 18, textAlign: 'center' },
  recentText: { flex: 1 },
  recentRowTitle: { fontSize: 14, color: c.text },
  recentHost: { fontSize: 12, color: c.textSecondary },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // The two sides share the room left by the new-tab button; labels stay on one line.
  toolbarSide: { flex: 1, minHeight: 44, justifyContent: 'center' },
  // Cancel keeps its whole label; the compare button takes the rest.
  toolbarCancel: { minHeight: 44, justifyContent: 'center', marginRight: 12 },
  alignRight: { alignItems: 'flex-end' },
  toolbarText: { fontSize: 15 },
  dimmed: { opacity: 0.35 },
  newTab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  newTabText: { color: c.onTint, fontSize: 26, fontWeight: '500', marginTop: -2 },
}));

const light = StyleSheet.create({
  container: { backgroundColor: '#efede6' },
  segment: { backgroundColor: '#dedbd1' },
  segmentSelected: { backgroundColor: '#fff' },
  text: { color: '#222' },
  dimText: { color: '#6b6862' },
  accent: { color: '#1460b4' },
  card: { backgroundColor: '#fff' },
  activeCard: { borderColor: '#1565c0' },
  preview: { backgroundColor: '#f5f4ef' },
  search: { backgroundColor: '#fff' },
  toolbar: { backgroundColor: '#f5f4ef', borderTopColor: '#d6d3c9' },
  newTab: { backgroundColor: '#1565c0' },
});

const dark = StyleSheet.create({
  container: { backgroundColor: '#1c1b22' },
  segment: { backgroundColor: '#2b2a33' },
  segmentSelected: { backgroundColor: '#42414d' },
  text: { color: '#f2f1f5' },
  dimText: { color: '#a9a8b3' },
  accent: { color: '#c9a7ff' },
  card: { backgroundColor: '#2b2a33' },
  activeCard: { borderColor: '#a77bff' },
  preview: { backgroundColor: '#35343e' },
  search: { backgroundColor: '#2b2a33' },
  toolbar: { backgroundColor: '#24232b', borderTopColor: '#3a3944' },
  newTab: { backgroundColor: '#7542e5' },
});

const darkNormal = StyleSheet.create({
  ...dark,
  accent: { color: '#5cb8f0' },
  activeCard: { borderColor: '#1565c0' },
  newTab: { backgroundColor: '#1565c0' },
});
