import { useMemo, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';

/** One shipped component, from src/legal/licences.json (written by scripts/generate-licences.js). */
type Licence = {
  name: string;
  version: string;
  /** SPDX expression or a short description. */
  licence: string;
  /** Key into `texts`; null when the terms aren't shipped (closed-source SDKs). */
  text: string | null;
  url?: string;
  platform?: 'android' | 'ios';
  proprietary?: boolean;
};
type LicenceData = { entries: Licence[]; texts: Record<string, string> };

// Loaded the first time the screen opens, not at app start (about 190 KB of text).
let data: LicenceData | null = null;
const licenceData = (): LicenceData => (data ??= require('../legal/licences.json') as LicenceData);

/** Settings › About › Open source licences: the third-party software in the app and each one's licence text. */
export function LicencesScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [open, setOpen] = useState<Licence | null>(null);
  const close = () => {
    setOpen(null);
    onClose();
  };
  return (
    // Android's back button goes from a licence text back to the list, then closes.
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={open ? () => setOpen(null) : close}
    >
      {visible && <LicencesContent open={open} onOpen={setOpen} onClose={close} />}
      <DialogHost />
    </Modal>
  );
}

function platformLabel(platform: Licence['platform']): string | null {
  if (platform === 'android') return t('licences.androidOnly');
  if (platform === 'ios') return t('licences.iosOnly');
  return null;
}

function LicencesContent({
  open,
  onOpen,
  onClose,
}: {
  open: Licence | null;
  onOpen: (entry: Licence | null) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const [query, setQuery] = useState('');
  const { entries, texts } = licenceData();

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return entries;
    return entries.filter((e) => `${e.name} ${e.licence}`.toLocaleLowerCase().includes(q));
  }, [entries, query]);

  if (open) {
    return (
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <View style={styles.header}>
          <Pressable
            onPress={() => onOpen(null)}
            hitSlop={8}
            style={styles.side}
            accessibilityRole="button"
            accessibilityLabel={t('licences.back')}
          >
            <View style={styles.backRow}>
              <Icon name="chevronLeft" size={18} color={palette.tintText} />
              <Text style={styles.done}>{t('licences.back')}</Text>
            </View>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]} accessibilityRole="button">
            <Text style={styles.done}>{t('common.done')}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.detail}>
          <Text style={styles.detailTitle} accessibilityRole="header">
            {open.name}
          </Text>
          <Text style={styles.meta} selectable>
            {t('licences.version', { version: open.version })}
            {'\n'}
            {t('licences.licence', { licence: open.licence })}
            {platformLabel(open.platform) ? `\n${platformLabel(open.platform)}` : ''}
          </Text>
          {open.url && (
            <Text style={styles.link} onPress={() => Linking.openURL(open.url!)} accessibilityRole="link">
              {open.url}
            </Text>
          )}
          {open.text ? (
            <Text style={styles.licenceText} selectable>
              {texts[open.text]}
            </Text>
          ) : (
            <Text style={styles.hint}>{t(open.proprietary ? 'licences.proprietary' : 'licences.noText')}</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <View style={styles.header}>
        <Text style={[styles.title, styles.side]} accessibilityRole="header">
          {t('licences.title')}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={shown}
        keyExtractor={(e) => `${e.name}@${e.version}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.hint}>{t('licences.intro', { count: entries.length })}</Text>
            <TextInput
              placeholderTextColor={palette.textSecondary}
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder={t('licences.search')}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
              accessibilityLabel={t('licences.search')}
            />
          </View>
        }
        ListEmptyComponent={<Text style={[styles.hint, styles.empty]}>{t('licences.none')}</Text>}
        renderItem={({ item }) => {
          const platform = platformLabel(item.platform);
          return (
            <Pressable
              onPress={() => onOpen(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.version} · {item.licence}
                {platform ? ` · ${platform}` : ''}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  side: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  right: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600' },
  done: { color: c.tintText, fontSize: 16, fontWeight: '600' },
  list: { paddingBottom: 24, maxWidth: 680, alignSelf: 'center', width: '100%' },
  listHeader: { padding: 16, gap: 12 },
  hint: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  empty: { paddingHorizontal: 16 },
  search: {
    color: c.text,
    minHeight: 40,
    paddingVertical: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
  },
  pressed: { backgroundColor: c.pressed },
  name: { color: c.text, fontSize: 15, fontWeight: '600' },
  meta: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  detail: { padding: 20, gap: 12, maxWidth: 680, alignSelf: 'center', width: '100%' },
  detailTitle: { color: c.text, fontSize: 20, fontWeight: '700' },
  link: { color: c.tintText, fontSize: 14 },
  licenceText: { color: c.text, fontSize: 13, lineHeight: 19 },
}));
