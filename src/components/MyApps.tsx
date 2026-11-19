import { Canvas, ImageSVG, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appStore, appsChanged } from '../apps/appStore';
import { appColor, checkSvgIcon, type AppIcon } from '../apps/manifest';
import { appRunner } from '../apps/runnerState';
import type { AppSummary } from '../apps/store';
import { bump } from '../device/haptics';
import { t } from '../i18n';
import { AppModal } from '../ui/AppModal';
import { Icon, type IconName } from '../ui/Icon';
import { makeStyles, readableColumn } from '../ui/theme';
import { ActionSheet } from './ActionSheet';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';
import { ScreenHeader } from './ScreenHeader';
import { WholeWordsText } from './WholeWordsText';
import { deleteApp, exportApp, renameApp } from './appActions';

/**
 * "My apps" (docs/mini-apps.md): the user's apps as a grid on the new tab page and in their own screen (main menu ›
 * Library › My apps). Tap opens the app; long press offers open, rename, export and delete; the screen also imports a .qutaiapp file. With no apps, a card invites the
 * user to ask the assistant for one.
 */

/** The app's icon: a named symbol, or the SVG subset drawn by Skia (never in a WebView), on the app's colour. */
export function AppIconView({ app, size = 52 }: { app: { id: string; icon: AppIcon }; size?: number }) {
  const svg = useMemo(() => {
    if (!('svg' in app.icon) || checkSvgIcon(app.icon.svg)) return null;
    try {
      return Skia.SVG.MakeFromString(app.icon.svg);
    } catch {
      return null;
    }
  }, [app.icon]);
  const inner = Math.round(size * 0.55);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: appColor(app), alignItems: 'center', justifyContent: 'center' }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {svg ? (
        <Canvas style={{ width: inner, height: inner }}>
          <ImageSVG svg={svg} x={0} y={0} width={inner} height={inner} />
        </Canvas>
      ) : (
        <Icon name={('name' in app.icon ? app.icon.name : 'apps') as IconName} size={inner} color="#ffffff" />
      )}
    </View>
  );
}

function useApps(active = true): AppSummary[] | null {
  const [apps, setApps] = useState<AppSummary[] | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => appsChanged.subscribe(() => setRound((n) => n + 1)), []);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    appStore
      .list()
      .then((list) => alive && setApps(list))
      .catch(() => alive && setApps([]));
    return () => {
      alive = false;
    };
  }, [active, round]);
  return apps;
}

function AppGrid({ apps, onMenu, onOpen = (id) => appRunner.open(id) }: { apps: AppSummary[]; onMenu: (app: AppSummary) => void; onOpen?: (id: string) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {apps.map((app) => (
        <Pressable
          key={app.id}
          accessibilityRole="button"
          accessibilityLabel={app.name}
          accessibilityHint={t('apps.tileHint')}
          accessibilityActions={[{ name: 'longpress', label: t('apps.options') }]}
          onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onMenu(app)}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          onPress={() => onOpen(app.id)}
          onLongPress={() => {
            bump();
            onMenu(app);
          }}
        >
          <AppIconView app={app} />
          <Text style={styles.tileTitle} numberOfLines={2}>
            {app.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function useAppMenu(onNotice?: (text: string) => void, onOpen: (id: string) => void = (id) => appRunner.open(id)) {
  const [menuFor, setMenuFor] = useState<AppSummary | null>(null);
  const sheet = (dark: boolean) => (
    <ActionSheet
      title={menuFor?.name ?? null}
      dark={dark}
      onClose={() => setMenuFor(null)}
      actions={
        menuFor
          ? [
              { icon: 'apps', label: t('apps.open'), onPress: () => onOpen(menuFor.id) },
              { icon: 'edit', label: t('apps.rename'), onPress: () => void renameApp(menuFor).catch(() => {}) },
              { icon: 'share', label: t('apps.export'), onPress: () => void exportApp(menuFor).catch(() => {}) },
              {
                icon: 'trash',
                label: t('apps.delete'),
                destructive: true,
                onPress: () =>
                  void deleteApp(menuFor)
                    .then((done) => done && onNotice?.(t('apps.deleted', { name: menuFor.name })))
                    .catch(() => {}),
              },
            ]
          : []
      }
    />
  );
  return { open: setMenuFor, sheet };
}

/** The new tab page's section: the grid, or the invitation to make a first app. */
export function MyAppsSection({ active, dark, onAskForApp }: { active: boolean; dark: boolean; onAskForApp: () => void }) {
  const styles = useStyles();
  const apps = useApps(active);
  const menu = useAppMenu();
  if (!apps) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {t('apps.myApps')}
      </Text>
      {apps.length ? (
        <AppGrid apps={apps} onMenu={menu.open} />
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyRow}>
            <Icon name="apps" size={22} color={styles.emptyIcon.color} />
            <Text style={styles.emptyTitle}>{t('apps.emptyTitle')}</Text>
          </View>
          <Text style={styles.emptyBody}>{t('apps.emptyBody')}</Text>
          <Pressable onPress={onAskForApp} accessibilityRole="button" style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}>
            <Icon name="assistant" size={16} color={styles.emptyButtonText.color} />
            <WholeWordsText style={styles.emptyButtonText}>{t('apps.emptyAction')}</WholeWordsText>
          </Pressable>
        </View>
      )}
      {menu.sheet(dark)}
    </View>
  );
}

/** The full screen (main menu › Library › My apps). */
export function MyAppsScreen({
  visible,
  dark,
  onClose,
  onAskForApp,
  onImport,
  onNotice,
}: {
  visible: boolean;
  dark: boolean;
  onClose: () => void;
  onAskForApp: () => void;
  /** "Import an app": the caller closes this screen and opens the file picker (docs/mini-apps.md › Import). */
  onImport: () => void;
  onNotice: (text: string) => void;
}) {
  const styles = useStyles();
  const apps = useApps(visible);
  // iOS shows one sheet at a time: this screen closes before the runner opens over the browser.
  const openApp = (id: string) => {
    onClose();
    setTimeout(() => appRunner.open(id), 450);
  };
  const menu = useAppMenu(onNotice, openApp);
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader title={t('apps.myApps')} right={{ label: t('common.done'), onPress: onClose }} />
        <ScrollView contentContainerStyle={styles.screenContent}>
          {apps && apps.length > 0 && (
            <AppGrid apps={apps} onMenu={menu.open} onOpen={openApp} />
          )}
          {apps && (
            <View style={styles.empty}>
              {!apps.length && <Text style={styles.emptyTitle}>{t('apps.emptyTitle')}</Text>}
              <Text style={styles.emptyBody}>{t(apps.length ? 'apps.screenHint' : 'apps.emptyBody')}</Text>
              <Pressable
                onPress={() => {
                  onClose();
                  onAskForApp();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
              >
                <Icon name="assistant" size={16} color={styles.emptyButtonText.color} />
                <WholeWordsText style={styles.emptyButtonText}>{t('apps.emptyAction')}</WholeWordsText>
              </Pressable>
              <Pressable
                onPress={onImport}
                accessibilityRole="button"
                accessibilityHint={t('apps.importHint')}
                style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
              >
                <Icon name="download" size={16} color={styles.emptyButtonText.color} />
                <WholeWordsText style={styles.emptyButtonText}>{t('apps.import')}</WholeWordsText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
      {menu.sheet(dark)}
      <DialogHost />
    </AppModal>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  screenContent: { ...readableColumn, padding: 16, gap: 20 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, paddingHorizontal: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  tile: { width: '25%', minWidth: 76, alignItems: 'center', gap: 6, paddingVertical: 4, borderRadius: 12 },
  tileTitle: { fontSize: 12, color: c.text, textAlign: 'center', maxWidth: '92%' },
  pressed: { backgroundColor: c.pressed },
  empty: { backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 8 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyIcon: { color: c.tintText },
  emptyTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: c.text },
  emptyBody: { fontSize: 14, lineHeight: 20, color: c.textSecondary },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.sunken,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  emptyButtonText: { color: c.tintText, fontSize: 15, fontWeight: '600', textAlign: 'center' },
}));
