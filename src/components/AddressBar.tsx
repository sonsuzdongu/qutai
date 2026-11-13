import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  url: string;
  loading: boolean;
  canGoBack: boolean;
  tabCount: number;
  incognito: boolean;
  claudeOpen: boolean;
  claudeRunning: boolean;
  onSubmit: (url: string) => void;
  onBack: () => void;
  onReload: () => void;
  onOpenTabs: () => void;
  onToggleClaude: () => void;
};

export function toUrl(input: string): string {
  const text = input.trim();
  if (/^https?:\/\//i.test(text)) return text;
  if (!/\s/.test(text) && /\.[a-z]{2,}(\/|$|:)/i.test(text)) return `https://${text}`;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}

/** URL as shown when not editing: no scheme, no "www.", no trailing slash. */
function displayUrl(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

export function AddressBar({
  url,
  loading,
  canGoBack,
  tabCount,
  incognito,
  claudeOpen,
  claudeRunning,
  onSubmit,
  onBack,
  onReload,
  onOpenTabs,
  onToggleClaude,
}: Props) {
  const [text, setText] = useState(url);
  const [editing, setEditing] = useState(false);
  const dark = incognito ? darkStyles : null;

  return (
    <View style={[styles.bar, dark?.bar]}>
      <IconButton label="‹" onPress={onBack} disabled={!canGoBack} incognito={incognito} />

      {/* A TextInput scrolls long URLs to the cursor, so a plain Text is shown until the user taps to edit. */}
      {editing ? (
        <TextInput
          style={[styles.field, styles.fieldText, dark?.field, dark?.text]}
          placeholderTextColor={incognito ? '#8f8e99' : '#999'}
          value={text}
          onChangeText={setText}
          onBlur={() => setEditing(false)}
          onSubmitEditing={() => text.trim() && onSubmit(toUrl(text))}
          autoFocus
          selectTextOnFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          placeholder="Adres veya arama"
        />
      ) : (
        <Pressable
          style={[styles.field, styles.fieldRow, dark?.field]}
          onPress={() => {
            setText(url);
            setEditing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Adres: ${url}. Düzenlemek için dokunun`}
        >
          {incognito && <Text style={styles.incognitoBadge}>🕶</Text>}
          <Text
            style={[styles.fieldText, styles.fieldTextFlex, dark?.text, !url && styles.placeholder]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {url ? displayUrl(url) : 'Adres veya arama'}
          </Text>
        </Pressable>
      )}

      {loading ? (
        <ActivityIndicator style={styles.icon} color={incognito ? '#f2f1f5' : undefined} />
      ) : (
        <IconButton label="↻" onPress={onReload} incognito={incognito} />
      )}
      <Pressable onPress={onOpenTabs} hitSlop={6} style={styles.icon} accessibilityLabel={`${tabCount} sekme`}>
        <View style={[styles.tabCount, dark?.tabCount]}>
          <Text style={[styles.tabCountText, dark?.text]}>{tabCount}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggleClaude}
        hitSlop={6}
        style={[styles.claudeButton, claudeOpen && styles.claudeButtonActive]}
        accessibilityLabel={claudeOpen ? 'Claude panelini kapat' : 'Claude panelini aç'}
      >
        {claudeRunning && !claudeOpen ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.claudeIcon}>✳︎</Text>
        )}
      </Pressable>
    </View>
  );
}

function IconButton({
  label,
  onPress,
  disabled,
  incognito,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  incognito?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} style={styles.icon}>
      <Text style={[styles.iconText, incognito && darkStyles.text, disabled && styles.disabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
    backgroundColor: '#f5f4ef',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d6d3c9',
  },
  field: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 15,
    color: '#222',
    textAlign: 'left',
    textAlignVertical: 'center',
    // Android adds extra font padding that pushes single-line text off-center.
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6 },
  fieldTextFlex: { flex: 1 },
  incognitoBadge: { fontSize: 14 },
  placeholder: { color: '#999' },
  icon: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22, color: '#333' },
  disabled: { color: '#bbb' },
  tabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabCountText: { fontSize: 12, fontWeight: '700', color: '#333' },
  claudeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c96442',
  },
  claudeButtonActive: { backgroundColor: '#8f4026' },
  claudeIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
});

const darkStyles = StyleSheet.create({
  bar: { backgroundColor: '#24232b', borderBottomColor: '#3a3944' },
  field: { backgroundColor: '#3a3944' },
  text: { color: '#f2f1f5' },
  tabCount: { borderColor: '#f2f1f5' },
});
