import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { OmniboxResults, Shown } from '../browser/omniboxResults';
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
}: Props) {
  const styles = useStyles();
  const darkUI = incognito || !!dark;
  const query = text.trim();
  const reduceMotion = useReduceMotion();
  const [canPaste, setCanPaste] = useState(false);
  const remoteAllowed = suggestionsEnabled && !incognito && query.length > 0 && !looksLikeUrl(query);
  const { results, shown } = useResults(query, remoteAllowed, searchEngine);

  useEffect(() => {
    if (query || Platform.OS === 'ios') return;
    let cancelled = false;
    Clipboard.hasStringAsync()
      .then((has) => !cancelled && setCanPaste(has))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query]);

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
        <ScrollView keyboardShouldPersistTaps="always" style={styles.scroll} onContentSizeChange={onContentSize}>
          {!query && <PasteRow android={canPaste} incognito={darkUI} onPaste={go} />}

          {/* "Ask Qutai" only for more than one word: an address or a single word is a place to go (UI-52). */}
          {/\S\s+\S/.test(query.trim()) && (
            <Row
              icon="assistant"
              title={t('omnibox.ask', { text: query })}
              incognito={darkUI}
              accent
              onPress={() => onAsk(query)}
            />
          )}
          {/* One "go" row in a fixed place: the typed address, or a search for the typed words. */}
          {query.length > 0 && (
            <Row
              icon={looksLikeUrl(query) ? 'link' : 'find'}
              title={query}
              incognito={darkUI}
              onPress={() => go(query)}
            />
          )}
          {localItems.map((item) => (
            <Animated.View key={`local:${item.url}`} {...motion}>
              <Row
                icon={item.bookmarked ? 'bookmarked' : 'history'}
                title={item.title || hostOf(item.url)}
                subtitle={item.url.replace(/^https?:\/\/(www\.)?/i, '')}
                incognito={darkUI}
                onPress={() => onNavigate(item.url)}
              />
            </Animated.View>
          ))}
          {remoteItems.map((suggestion) => (
            <Animated.View key={`remote:${suggestion}`} {...motion}>
              <Row icon="find" title={suggestion} incognito={darkUI} onPress={() => go(suggestion)} />
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function PasteRow({
  android,
  incognito,
  onPaste,
}: {
  android: boolean;
  incognito: boolean;
  onPaste: (text: string) => void;
}) {
  const styles = useStyles();
  // iOS's own paste button reads the clipboard without the "Allow Paste" prompt.
  if (Platform.OS === 'ios') {
    if (!Clipboard.isPasteButtonAvailable) return null;
    return (
      <View style={styles.pasteButtonRow}>
        <Clipboard.ClipboardPasteButton
          acceptedContentTypes={['plain-text', 'url']}
          displayMode="iconAndLabel"
          cornerStyle="capsule"
          style={styles.pasteButton}
          onPress={(data) => {
            if (data.type === 'text' && data.text.trim()) onPaste(data.text.trim());
          }}
        />
      </View>
    );
  }
  if (!android) return null;
  return (
    <Row
      icon="copy"
      title={t('omnibox.pasteAndGo')}
      incognito={incognito}
      onPress={() => {
        Clipboard.getStringAsync()
          .then((text) => text.trim() && onPaste(text.trim()))
          .catch(() => {});
      }}
    />
  );
}

function Row({
  icon,
  title,
  subtitle,
  incognito,
  accent,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  incognito: boolean;
  accent?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && (incognito ? styles.pressedDark : styles.pressed)]}
      accessibilityRole="button"
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
  pasteButtonRow: { paddingHorizontal: 16, paddingVertical: 10 },
  pasteButton: { height: 36, width: 150 },
}));
