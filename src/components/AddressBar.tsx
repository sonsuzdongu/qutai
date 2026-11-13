import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { SearchEngineId } from '../browser/search';
import { toUrl } from '../browser/url';
import { t } from '../i18n';

type Props = {
  url: string;
  loading: boolean;
  canGoBack: boolean;
  tabCount: number;
  incognito: boolean;
  assistantOpen: boolean;
  assistantRunning: boolean;
  searchEngine: SearchEngineId;
  onSubmit: (url: string) => void;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpenTabs: () => void;
  onToggleAssistant: () => void;
};

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
  assistantOpen,
  assistantRunning,
  searchEngine,
  onSubmit,
  onBack,
  onOpenMenu,
  onOpenTabs,
  onToggleAssistant,
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
          onSubmitEditing={() => text.trim() && onSubmit(toUrl(text, searchEngine))}
          autoFocus
          selectTextOnFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          placeholder={t('address.placeholder')}
        />
      ) : (
        <Pressable
          style={[styles.field, styles.fieldRow, dark?.field]}
          onPress={() => {
            setText(url);
            setEditing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('address.a11y', { url })}
        >
          {incognito && <Text style={styles.incognitoBadge}>🕶</Text>}
          <Text
            style={[styles.fieldText, styles.fieldTextFlex, dark?.text, !url && styles.placeholder]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {url ? displayUrl(url) : t('address.placeholder')}
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={onOpenTabs}
        hitSlop={6}
        style={styles.icon}
        accessibilityLabel={t('address.tabs', { count: tabCount })}
      >
        <View style={[styles.tabCount, dark?.tabCount]}>
          <Text style={[styles.tabCountText, dark?.text]}>{tabCount}</Text>
        </View>
      </Pressable>
      <IconButton label="⋮" onPress={onOpenMenu} incognito={incognito} accessibilityLabel={t('address.menu')} />
      <Pressable
        onPress={onToggleAssistant}
        hitSlop={6}
        style={[styles.assistantButton, assistantOpen && styles.assistantButtonActive]}
        accessibilityLabel={t(assistantOpen ? 'address.closeAssistant' : 'address.openAssistant')}
      >
        {assistantRunning && !assistantOpen ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.assistantIcon}>✦</Text>
        )}
      </Pressable>
      {loading && <LoadingBar />}
    </View>
  );
}

/** Thin indeterminate progress line along the bottom edge while a page loads. */
function LoadingBar() {
  const { width } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.4, width] });
  return (
    <View style={styles.loadingTrack} pointerEvents="none">
      <Animated.View style={[styles.loadingBar, { width: width * 0.4, transform: [{ translateX }] }]} />
    </View>
  );
}

function IconButton({
  label,
  onPress,
  disabled,
  incognito,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  incognito?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={styles.icon}
      accessibilityLabel={accessibilityLabel}
    >
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
  loadingTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, overflow: 'hidden' },
  loadingBar: { height: 2, backgroundColor: '#c96442', borderRadius: 1 },
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
  assistantButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c96442',
  },
  assistantButtonActive: { backgroundColor: '#8f4026' },
  assistantIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
});

const darkStyles = StyleSheet.create({
  bar: { backgroundColor: '#24232b', borderBottomColor: '#3a3944' },
  field: { backgroundColor: '#3a3944' },
  text: { color: '#f2f1f5' },
  tabCount: { borderColor: '#f2f1f5' },
});
