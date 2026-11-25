import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ADDRESS_BAR_TIMING, OmniboxResults, Shown } from '../browser/omniboxResults';
import { fetchSuggestions, SearchEngineId } from '../browser/search';
import { looksLikeUrl, toUrl } from '../browser/url';
import { getLanguage, t } from '../i18n';
import { hostOf } from '../i18n/format';
import { getDb } from '../storage/db';
import { LocalSuggestion, localSuggestions } from '../storage/omnibox';
import { darkPalette, makeStyles, usePalette, radii } from '../ui/theme';
import { Icon, IconName } from '../ui/Icon';
import { useReduceMotion } from '../utils/useReduceMotion';

type Props = {
  text: string;
  incognito: boolean;
  /** Dark appearance (incognito or dark theme); privacy still follows `incognito` only. */
  dark?: boolean;
  /** The address bar is at the bottom, so the list opens upwards. */
  above?: boolean;
  /** Height of the address bar; the list sits right against its edge. */
  barHeight: number;
  searchEngine: SearchEngineId;
  suggestionsEnabled: boolean;
  onNavigate: (url: string) => void;
  onAsk: (text: string) => void;
  /** The row the arrow keys highlight (UI-88), by its place in the list; null: none. */
  highlight?: number | null;
  /** The rows as the arrow keys see them, after every change. */
  onRows?: (rows: SuggestionRow[]) => void;
};

/** One row of the list, top to bottom: what the field shows while it is highlighted, and what Return does with it. */
export type SuggestionRow = { key: string; fill: string; activate: () => void };

type RowSpec = SuggestionRow & {
  icon: IconName;
  title: string;
  subtitle?: string;
  accent?: boolean;
  /** History and engine rows fade in and move smoothly. */
  animated: boolean;
};

const MAX_HEIGHT = 360;
/** Rows fading in and the list growing or shrinking: short enough not to feel slow. */
const FADE_MS = 120;
const RESIZE_MS = 150;

/**
 * History, bookmarks and search engine suggestions for the text being typed. What is shown stays until the next
 * answer lands (browser/omniboxResults.ts), so the list never empties between letters.
 */
function useResults(query: string, remoteAllowed: boolean, searchEngine: SearchEngineId) {
  const [shown, setShown] = useState<Shown<LocalSuggestion>>({ query: '', local: [], remote: [] });
  const [results] = useState(
    () =>
      new OmniboxResults<LocalSuggestion>({
        // Both lookups wait for a 350 ms pause in typing (UI-82).
        ...ADDRESS_BAR_TIMING,
        lookupLocal: (q) => getDb().then((db) => localSuggestions(db, q)),
        onChange: setShown,
      }),
  );
  useEffect(() => () => results.dispose(), [results]);
  useEffect(() => {
    // What the user types only leaves the device when suggestions are on, and never from incognito tabs.
    const changed = results.setRemote(`${remoteAllowed}|${searchEngine}`, (q, signal) =>
      remoteAllowed ? fetchSuggestions(searchEngine, q, getLanguage(), signal) : null,
    );
    // Suggestions switched on or off, or another engine: the same text is looked up again.
    results.setQuery(query, { force: changed });
  }, [results, query, remoteAllowed, searchEngine]);
  return { results, shown };
}

/** Dropdown under the address bar while editing. */
export function OmniboxSuggestions({
  text,
  incognito,
  dark,
  above,
  barHeight,
  searchEngine,
  suggestionsEnabled,
  onNavigate,
  onAsk,
  highlight = null,
  onRows,
}: Props) {
  const styles = useStyles();
  const darkUI = incognito || !!dark;
  const query = text.trim();
  const reduceMotion = useReduceMotion();
  const remoteAllowed = suggestionsEnabled && !incognito && query.length > 0 && !looksLikeUrl(query);
  const { results, shown } = useResults(query, remoteAllowed, searchEngine);

  // The list grows and shrinks smoothly instead of jumping to its new height.
  const height = useSharedValue(-1);
  const heightStyle = useAnimatedStyle(() => (height.value < 0 ? {} : { height: height.value }));
  const onContentSize = (_w: number, h: number) => {
    const target = Math.min(h, MAX_HEIGHT);
    height.set(height.get() < 0 || reduceMotion ? target : withTiming(target, { duration: RESIZE_MS }));
  };

  const go = (input: string) => onNavigate(toUrl(input, searchEngine));
  // The last answer stays until the next one lands, even if it was for a letter more or less.
  const localItems = query ? shown.local : [];
  const remoteItems = remoteAllowed
    ? shown.remote.filter((s) => s.toLocaleLowerCase().trim() !== query.toLocaleLowerCase())
    : [];
  const motion = reduceMotion ? {} : { entering: FadeIn.duration(FADE_MS), layout: LinearTransition.duration(RESIZE_MS) };

  const rows: RowSpec[] = [];
  // "Ask Qutai" only for more than one word: an address or a single word is a place to go (UI-52).
  if (/\S\s+\S/.test(query.trim())) {
    rows.push({
      key: 'ask',
      icon: 'assistant',
      title: t('omnibox.ask', { text: query }),
      accent: true,
      fill: query,
      activate: () => onAsk(query),
      animated: false,
    });
  }
  // One "go" row in a fixed place: the typed address, or a search for the typed words.
  if (query.length > 0) {
    rows.push({
      key: 'go',
      icon: looksLikeUrl(query) ? 'link' : 'find',
      title: query,
      fill: query,
      activate: () => go(query),
      animated: false,
    });
  }
  for (const item of localItems) {
    rows.push({
      key: `local:${item.url}`,
      icon: item.bookmarked ? 'bookmarked' : 'history',
      title: item.title || hostOf(item.url),
      subtitle: item.url.replace(/^https?:\/\/(www\.)?/i, ''),
      fill: item.url,
      activate: () => onNavigate(item.url),
      animated: true,
    });
  }
  for (const suggestion of remoteItems) {
    rows.push({
      key: `remote:${suggestion}`,
      icon: 'find',
      title: suggestion,
      fill: suggestion,
      activate: () => go(suggestion),
      animated: true,
    });
  }

  // The address bar learns the rows (for the arrow keys) after every render, with their latest actions.
  useEffect(() => {
    onRows?.(rows);
  });

  // While a row is highlighted the list holds still (answers wait until the highlight goes).
  const highlighted = highlight !== null && highlight >= 0 && highlight < rows.length ? rows[highlight].key : null;
  useEffect(() => {
    results.holdForKeys(highlighted !== null);
  }, [results, highlighted]);

  // The highlighted row is scrolled into view.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const frames = useRef(new Map<string, { y: number; height: number }>());
  const scrollY = useRef(0);
  const viewHeight = useRef(MAX_HEIGHT);
  useEffect(() => {
    if (highlighted === null) return;
    const frame = frames.current.get(highlighted);
    if (!frame) return;
    const top = scrollY.current;
    const bottom = top + viewHeight.current;
    if (frame.y < top) scrollRef.current?.scrollTo({ y: frame.y, animated: !reduceMotion });
    else if (frame.y + frame.height > bottom) {
      scrollRef.current?.scrollTo({ y: frame.y + frame.height - viewHeight.current, animated: !reduceMotion });
    }
  }, [highlighted, reduceMotion]);

  return (
    <View
      style={[
        styles.panel,
        above ? [styles.panelAbove, { bottom: barHeight }] : { top: barHeight },
        darkUI && styles.panelDark,
      ]}
      // Nothing moves under a finger that is about to tap: changes wait until it lifts.
      onTouchStart={() => results.touchStart()}
      onTouchEnd={() => results.touchEnd()}
      onTouchCancel={() => results.touchEnd()}
    >
      <Animated.View style={heightStyle}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="always"
          style={styles.scroll}
          onContentSizeChange={onContentSize}
          onLayout={(e) => {
            viewHeight.current = e.nativeEvent.layout.height;
          }}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
        >
          {rows.map((row) => (
            <Animated.View
              key={row.key}
              {...(row.animated ? motion : {})}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                frames.current.set(row.key, { y, height });
              }}
            >
              <Row
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                incognito={darkUI}
                accent={row.accent}
                highlighted={row.key === highlighted}
                onPress={row.activate}
              />
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  incognito,
  accent,
  highlighted,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  incognito: boolean;
  accent?: boolean;
  /** The arrow keys' row (UI-88). */
  highlighted?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        (pressed || highlighted) && (incognito ? styles.pressedDark : styles.pressed),
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!highlighted }}
    >
      <Icon
        name={icon}
        size={17}
        color={accent ? palette.tintText : incognito ? darkPalette.textSecondary : palette.textSecondary}
        style={styles.icon}
      />
      <View style={styles.rowText}>
        <Text style={[styles.title, incognito && styles.textDark, accent && styles.accent]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: MAX_HEIGHT,
    backgroundColor: c.surface,
    borderBottomLeftRadius: radii.popover,
    borderBottomRightRadius: radii.popover,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    overflow: 'hidden',
  },
  panelAbove: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: radii.popover,
    borderTopRightRadius: radii.popover,
  },
  panelDark: { backgroundColor: '#2b2a33' },
  scroll: { flexGrow: 0, maxHeight: MAX_HEIGHT },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  pressed: { backgroundColor: c.pressed },
  pressedDark: { backgroundColor: '#3a3944' },
  icon: { width: 20 },
  rowText: { flex: 1 },
  title: { fontSize: 15, color: c.text },
  textDark: { color: '#f2f1f5' },
  subtitle: { fontSize: 12, color: c.textSecondary, marginTop: 1 },
  accent: { color: c.tintText, fontWeight: '600' },
}));
