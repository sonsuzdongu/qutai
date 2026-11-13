import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Browser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';

type Props = {
  visible: boolean;
  browser: Browser;
  onClose: () => void;
};

const PADDING = 12;
const GAP = 12;

export function TabSwitcher({ visible, browser, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      {/* Mounted only while visible, so it opens in the mode of the tab on screen. */}
      {visible && <TabSwitcherContent browser={browser} onClose={onClose} />}
    </Modal>
  );
}

function TabSwitcherContent({ browser, onClose }: Omit<Props, 'visible'>) {
  const [incognito, setIncognito] = useState(browser.active.incognito);
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP) / 2;

  const tabs = browser.tabsOf(incognito);
  const theme = incognito ? dark : light;

  const select = (tab: Tab) => {
    browser.switchTab(tab.id);
    onClose();
  };

  const newTab = () => {
    browser.openTab(undefined, { incognito });
    onClose();
  };

  const closeAll = () => {
    Alert.alert(t(incognito ? 'tabs.closeAllIncognitoConfirm' : 'tabs.closeAllConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.close'),
        style: 'destructive',
        onPress: () => {
          if (incognito) browser.closeAllIncognito();
          else browser.tabsOf(false).forEach((t) => browser.closeTab(t.id));
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
            onPress={() => setIncognito(false)}
          />
          <SegmentButton
            label={t('tabs.incognito', { count: browser.tabsOf(true).length })}
            selected={incognito}
            incognito={incognito}
            onPress={() => setIncognito(true)}
          />
        </View>
      </View>

      {incognito && Platform.OS === 'android' && tabs.length > 0 && (
        <Text style={styles.warning}>{t('tabs.androidIncognitoWarning')}</Text>
      )}

      <FlatList
        // Copy: the tabs array is mutated in place, and FlatList skips re-rendering for the same reference.
        data={[...tabs]}
        extraData={browser.getVersion()}
        keyExtractor={(tab) => tab.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<EmptyState incognito={incognito} />}
        renderItem={({ item }) => (
          <TabCard
            tab={item}
            width={cardWidth}
            active={item.id === browser.activeId}
            incognito={incognito}
            onPress={() => select(item)}
            onCloseTab={() => browser.closeTab(item.id)}
          />
        )}
      />

      <View style={[styles.toolbar, theme.toolbar]}>
        <Pressable onPress={closeAll} disabled={tabs.length === 0} hitSlop={8} style={styles.toolbarSide}>
          <Text style={[styles.toolbarText, theme.text, tabs.length === 0 && styles.dimmed]}>{t('tabs.closeAll')}</Text>
        </Pressable>
        <Pressable
          onPress={newTab}
          style={[styles.newTab, theme.newTab]}
          accessibilityLabel={t(incognito ? 'menu.newIncognitoTab' : 'menu.newTab')}
        >
          <Text style={styles.newTabText}>＋</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8} style={[styles.toolbarSide, styles.alignRight]}>
          <Text style={[styles.toolbarText, styles.bold, theme.accent]}>{t('common.done')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SegmentButton({
  label,
  selected,
  incognito,
  onPress,
}: {
  label: string;
  selected: boolean;
  incognito: boolean;
  onPress: () => void;
}) {
  const theme = incognito ? dark : light;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, selected && theme.segmentSelected]}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.segmentText, theme.text, selected && styles.bold]}>{label}</Text>
    </Pressable>
  );
}

function TabCard({
  tab,
  width,
  active,
  incognito,
  onPress,
  onCloseTab,
}: {
  tab: Tab;
  width: number;
  active: boolean;
  incognito: boolean;
  onPress: () => void;
  onCloseTab: () => void;
}) {
  const theme = incognito ? dark : light;
  const previewHeight = width * 1.25;
  const host = tab.url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0];

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, theme.card, { width }, active && theme.activeCard]}
      accessibilityLabel={t('tabs.tabA11y', { title: tab.title || host })}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, theme.text]} numberOfLines={1}>
          {tab.title || host || t('menu.newTab')}
        </Text>
        <Pressable onPress={onCloseTab} hitSlop={10} style={styles.cardClose} accessibilityLabel={t('tabs.closeTab')}>
          <Text style={[styles.cardCloseText, theme.text]}>✕</Text>
        </Pressable>
      </View>
      <View style={[styles.preview, theme.preview, { height: previewHeight }]}>
        {tab.thumbnail ? (
          // Sized by the captured aspect ratio and clipped, so the top of the page is what shows.
          <Image source={{ uri: tab.thumbnail }} style={{ width, height: width / tab.thumbnailAspect }} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={[styles.placeholderLetter, theme.dimText]}>{(host[0] || '?').toUpperCase()}</Text>
            <Text style={[styles.placeholderHost, theme.dimText]} numberOfLines={1}>
              {host}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function EmptyState({ incognito }: { incognito: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{incognito ? '🕶' : '🗂'}</Text>
      <Text style={[styles.emptyTitle, incognito ? dark.text : light.text]}>
        {t(incognito ? 'tabs.emptyIncognito' : 'tabs.empty')}
      </Text>
      {incognito && (
        <Text style={[styles.emptyBody, dark.dimText]}>
          {t('tabs.incognitoInfo')} {t(Platform.OS === 'ios' ? 'tabs.incognitoInfoIos' : 'tabs.incognitoInfoAndroid')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: PADDING, paddingVertical: 10, alignItems: 'center' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentButton: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 8 },
  segmentText: { fontSize: 14 },
  bold: { fontWeight: '700' },
  warning: {
    marginHorizontal: PADDING,
    marginBottom: 4,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#4a3b1a',
    color: '#f5d48a',
    fontSize: 12,
    lineHeight: 17,
  },
  grid: { padding: PADDING, gap: GAP, flexGrow: 1 },
  row: { gap: GAP },
  card: { borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, height: 34 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '500' },
  cardClose: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  cardCloseText: { fontSize: 13 },
  preview: { overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  placeholderLetter: { fontSize: 40, fontWeight: '700' },
  placeholderHost: { fontSize: 12, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolbarSide: { flex: 1 },
  alignRight: { alignItems: 'flex-end' },
  toolbarText: { fontSize: 15 },
  dimmed: { opacity: 0.35 },
  newTab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  newTabText: { color: '#fff', fontSize: 26, fontWeight: '500', marginTop: -2 },
});

const light = StyleSheet.create({
  container: { backgroundColor: '#efede6' },
  segment: { backgroundColor: '#dedbd1' },
  segmentSelected: { backgroundColor: '#fff' },
  text: { color: '#222' },
  dimText: { color: '#999' },
  accent: { color: '#c96442' },
  card: { backgroundColor: '#fff' },
  activeCard: { borderColor: '#c96442' },
  preview: { backgroundColor: '#f5f4ef' },
  toolbar: { backgroundColor: '#f5f4ef', borderTopColor: '#d6d3c9' },
  newTab: { backgroundColor: '#c96442' },
});

const dark = StyleSheet.create({
  container: { backgroundColor: '#1c1b22' },
  segment: { backgroundColor: '#2b2a33' },
  segmentSelected: { backgroundColor: '#42414d' },
  text: { color: '#f2f1f5' },
  dimText: { color: '#8f8e99' },
  accent: { color: '#c9a7ff' },
  card: { backgroundColor: '#2b2a33' },
  activeCard: { borderColor: '#a77bff' },
  preview: { backgroundColor: '#35343e' },
  toolbar: { backgroundColor: '#24232b', borderTopColor: '#3a3944' },
  newTab: { backgroundColor: '#7542e5' },
});
