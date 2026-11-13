import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchSuggestions, SearchEngineId } from '../browser/search';
import { looksLikeUrl, toUrl } from '../browser/url';
import { getLanguage, t } from '../i18n';
import { hostOf } from '../i18n/format';
import { getDb } from '../storage/db';
import { LocalSuggestion, localSuggestions } from '../storage/omnibox';

type Props = {
  text: string;
  incognito: boolean;
  /** Dark appearance (incognito or dark theme); privacy still follows `incognito` only. */
  dark?: boolean;
  searchEngine: SearchEngineId;
  suggestionsEnabled: boolean;
  onNavigate: (url: string) => void;
  onAsk: (text: string) => void;
};

const REMOTE_DELAY_MS = 200;

/** Dropdown under the address bar while editing. */
export function OmniboxSuggestions({
  text,
  incognito,
  dark,
  searchEngine,
  suggestionsEnabled,
  onNavigate,
  onAsk,
}: Props) {
  const darkUI = incognito || !!dark;
  const query = text.trim();
  const [local, setLocal] = useState<{ query: string; items: LocalSuggestion[] }>({ query: '', items: [] });
  const [remote, setRemote] = useState<{ query: string; items: string[] }>({ query: '', items: [] });
  const [canPaste, setCanPaste] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then((db) => localSuggestions(db, query))
      .catch(() => [] as LocalSuggestion[])
      .then((items) => !cancelled && setLocal({ query, items }));
    return () => {
      cancelled = true;
    };
  }, [query]);

  // What the user types only leaves the device when suggestions are on, and never from incognito tabs.
  const remoteAllowed = suggestionsEnabled && !incognito && query.length > 0 && !looksLikeUrl(query);
  useEffect(() => {
    if (!remoteAllowed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSuggestions(searchEngine, query, getLanguage(), controller.signal)
        .catch(() => [] as string[])
        .then((items) => !controller.signal.aborted && setRemote({ query, items }));
    }, REMOTE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [remoteAllowed, query, searchEngine]);

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

  const go = (input: string) => onNavigate(toUrl(input, searchEngine));
  const localItems = local.query === query ? local.items : [];
  const remoteItems = remoteAllowed && remote.query === query ? remote.items : [];

  return (
    <View style={[styles.panel, darkUI && styles.panelDark]}>
      <ScrollView keyboardShouldPersistTaps="always" style={styles.scroll}>
        {!query && <PasteRow android={canPaste} incognito={darkUI} onPaste={go} />}

        {query.length > 0 && (
          <Row
            icon="✦"
            title={t('omnibox.ask', { text: query })}
            incognito={darkUI}
            accent
            onPress={() => onAsk(query)}
          />
        )}
        {query.length > 0 && looksLikeUrl(query) && (
          <Row icon="🌐" title={query} incognito={darkUI} onPress={() => go(query)} />
        )}
        {localItems.map((item) => (
          <Row
            key={item.url}
            icon={item.bookmarked ? '★' : '🕘'}
            title={item.title || hostOf(item.url)}
            subtitle={item.url.replace(/^https?:\/\/(www\.)?/i, '')}
            incognito={darkUI}
            onPress={() => onNavigate(item.url)}
          />
        ))}
        {remoteItems.map((suggestion) => (
          <Row key={suggestion} icon="🔍" title={suggestion} incognito={darkUI} onPress={() => go(suggestion)} />
        ))}
        {query.length > 0 && !looksLikeUrl(query) && !remoteItems.includes(query) && (
          <Row icon="🔍" title={query} incognito={darkUI} onPress={() => go(query)} />
        )}
      </ScrollView>
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
      icon="📋"
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
  icon: string;
  title: string;
  subtitle?: string;
  incognito: boolean;
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && (incognito ? styles.pressedDark : styles.pressed)]}
      accessibilityRole="button"
    >
      <Text style={[styles.icon, accent && styles.accent]}>{icon}</Text>
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

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: 360,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    overflow: 'hidden',
  },
  panelDark: { backgroundColor: '#2b2a33' },
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  pressed: { backgroundColor: '#f1efe8' },
  pressedDark: { backgroundColor: '#3a3944' },
  icon: { width: 20, fontSize: 15, textAlign: 'center', color: '#888' },
  rowText: { flex: 1 },
  title: { fontSize: 15, color: '#222' },
  textDark: { color: '#f2f1f5' },
  subtitle: { fontSize: 12, color: '#888', marginTop: 1 },
  accent: { color: '#c96442', fontWeight: '600' },
  pasteButtonRow: { paddingHorizontal: 16, paddingVertical: 10 },
  pasteButton: { height: 36, width: 150 },
});
