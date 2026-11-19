import { File, Paths } from 'expo-file-system';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, PixelRatio, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ThemeInfo } from '../apps/bridge';
import { IOS_OFFLINE_RULE_LIST_ID, IOS_OFFLINE_RULES, formatDiagnostics } from '../apps/document';
import { CONTRACT_VERSION } from '../apps/manifest';
import { appRunner, type RunnerRequest } from '../apps/runnerState';
import { compileIosRuleList, hasIosRuleList, hasNativeBlocking } from '../device/contentBlocker';
import { incognitoProfilesSupported } from '../device/webviewProfile';
import { t } from '../i18n';
import { AppModal } from '../ui/AppModal';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, type Palette } from '../ui/theme';
import { ActionSheet, type SheetAction } from './ActionSheet';
import { DialogHost } from './Dialog';
import { ErrorDetails } from './ErrorDetails';
import { ScreenHeader } from './ScreenHeader';
import { Toast, useToast } from './Toast';
import { WholeWordsText } from './WholeWordsText';
import { RunnerSession, type Overlay } from './runnerSession';

/**
 * The runner (docs/mini-apps.md › The runtime): one app, full screen, in its own WebView with an opaque origin, no
 * storage of its own, its own data store (iOS non-persistent store; Android the `qutai-apps` profile), every
 * navigation refused, the policy and (iOS) a block-everything rule list against the network; the bridge to Qutai;
 * diagnostics, the error overlay with "Ask Qutai to fix this", the hang watchdog, and the menu (edit, versions,
 * permissions, reload, rename, delete).
 */

/** Android's WebView profile for apps: apart from browsing (androidx.webkit profiles, the patched module). */
const ANDROID_PROFILE = 'qutai-apps';

let offlineRules: Promise<string[]> | null = null;
/** iOS: the block-everything rule list, compiled once; [] where the build has no native blocking (CSP still holds). */
function iosOfflineRules(): Promise<string[]> {
  if (Platform.OS !== 'ios' || !hasNativeBlocking()) return Promise.resolve([]);
  offlineRules ??= (async () => {
    try {
      if (!(await hasIosRuleList(IOS_OFFLINE_RULE_LIST_ID))) {
        const file = new File(Paths.cache, `${IOS_OFFLINE_RULE_LIST_ID}.json`);
        file.write(IOS_OFFLINE_RULES);
        try {
          await compileIosRuleList(IOS_OFFLINE_RULE_LIST_ID, file.uri);
        } finally {
          try {
            file.delete();
          } catch {}
        }
      }
      return [IOS_OFFLINE_RULE_LIST_ID];
    } catch {
      offlineRules = null;
      return [];
    }
  })();
  return offlineRules;
}

export function themeInfo(palette: Palette): ThemeInfo {
  return {
    dark: palette.dark,
    colors: {
      bg: palette.bg,
      surface: palette.surface,
      sunken: palette.sunken,
      text: palette.text,
      textSecondary: palette.textSecondary,
      tint: palette.tint,
      onTint: palette.onTint,
      danger: palette.danger,
      separator: palette.separator,
      border: palette.border,
    },
    fontScale: Math.round(PixelRatio.getFontScale() * 100) / 100,
  };
}

type Props = {
  /** "Edit with the assistant": the runner has closed; put a draft in the assistant. */
  onEdit: (app: { id: string; name: string }) => void;
  /** "Ask Qutai to fix this": the runner has closed; send the assistant the error lines. */
  onFix: (app: { id: string; name: string; version: number }, errors: string) => void;
  onNotice: (text: string) => void;
};

export function AppRunnerHost(props: Props) {
  const request = useSyncExternalStore(appRunner.subscribe, appRunner.current);
  if (!request) return null;
  return <Runner key={request.serial} request={request} {...props} />;
}

function Runner({ request, onEdit, onFix, onNotice }: Props & { request: RunnerRequest }) {
  const styles = useStyles();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState<string[] | null>(Platform.OS === 'ios' ? null : []);
  const [session] = useState(
    () =>
      new RunnerSession(
        request,
        { onEdit, onFix, onNotice, toast: toast.show },
        { theme: themeInfo(palette), insets: { top: 0, right: insets.right, bottom: insets.bottom, left: insets.left } },
      ),
  );
  const snap = useSyncExternalStore(session.subscribe, session.snapshot);

  useEffect(() => {
    session.start();
    let alive = true;
    void iosOfflineRules().then((ids) => alive && setRules(ids));
    return () => {
      alive = false;
      session.dispose();
    };
  }, [session]);
  // Theme, text size and safe areas follow the phone while the app is open.
  useEffect(() => {
    session.setEnvironment(themeInfo(palette), { top: 0, right: insets.right, bottom: insets.bottom, left: insets.left });
  }, [session, palette, insets.right, insets.bottom, insets.left]);

  const onBack = () => (menu ? setMenu(false) : session.onBack());
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menu) setMenu(false);
      else session.onBack();
      return true;
    });
    return () => sub.remove();
  }, [session, menu]);

  const loaded = snap.app && snap.app !== 'missing' ? snap.app : null;
  const menuActions: SheetAction[] = loaded
    ? [
        { icon: 'assistant', label: t('apps.edit'), onPress: session.edit },
        { icon: 'history', label: t('apps.versions'), onPress: () => void session.showVersions() },
        { icon: 'shield', label: t('apps.permissions'), onPress: () => void session.showPermissions() },
        { icon: 'reload', label: t('apps.reload'), onPress: session.restart },
        { icon: 'edit', label: t('apps.rename'), onPress: () => void session.rename() },
        { icon: 'trash', label: t('apps.delete'), destructive: true, onPress: () => void session.remove() },
      ]
    : [];

  const androidProfile = Platform.OS === 'android' && incognitoProfilesSupported() ? ANDROID_PROFILE : undefined;

  const body = () => {
    if (snap.app === null || rules === null) return <View style={styles.flex} />;
    if (snap.app === 'missing') return <Message title={t('apps.missing')} />;
    if (loaded && loaded.pkg.manifest.contract > CONTRACT_VERSION) return <Message title={t('apps.needsUpdate')} />;
    if (loaded && !snap.runnable)
      return (
        <Message title={t('apps.approveTitle', { name: loaded.name })} body={t('apps.needsApproval')}>
          <Button label={t('apps.turnOn')} onPress={() => void session.approve()} />
        </Message>
      );
    if (!loaded || !snap.built) return null;
    return (
      <View style={styles.flex}>
        <WebView
          key={`${loaded.id}:${loaded.version}:${snap.reload}`}
          ref={session.setWebView}
          style={[styles.flex, { backgroundColor: palette.bg }]}
          // The app's own origin under .invalid (never resolves): apart from every site's cookies and storage and from
          // other apps; web storage and cookies are refused by the document's lockdown.
          source={{ html: snap.built.html, baseUrl: session.baseUrl() }}
          // Everything passes the origin list (otherwise react-native-webview hands it to another app) and is then
          // refused here: the app never leaves its document.
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(r) => session.allowNavigation(r.url)}
          onLoadStart={(e) => session.loadStarted(e.nativeEvent.url)}
          onMessage={(e) => session.onMessage(e.nativeEvent.data)}
          javaScriptEnabled
          domStorageEnabled={false}
          cacheEnabled={false}
          incognito={Platform.OS === 'ios'}
          webviewProfile={androidProfile}
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          geolocationEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          mediaCapturePermissionGrantType="deny"
          allowsLinkPreview={false}
          allowsBackForwardNavigationGestures={false}
          dataDetectorTypes="none"
          mixedContentMode="never"
          saveFormDataDisabled
          textZoom={100}
          contentBlocking={Platform.OS === 'ios' && rules.length > 0}
          contentRuleLists={rules.join('\n')}
          onContentProcessDidTerminate={session.crashed}
          onRenderProcessGone={session.crashed}
        />
        {snap.overlay && (
          <OverlayView
            overlay={snap.overlay}
            name={loaded.name}
            onFix={session.askFix}
            onReload={session.restart}
            onDismiss={session.dismissOverlay}
            onClose={session.close}
          />
        )}
      </View>
    );
  };

  return (
    <AppModal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onBack}>
      <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]} edges={['top']}>
        <View style={[styles.header, { paddingLeft: insets.left, paddingRight: insets.right }]}>
          <ScreenHeader
            title={snap.title}
            left={{ label: t('apps.close'), icon: 'close', iconOnly: true, tone: 'plain', onPress: session.close }}
            right={loaded ? { label: t('apps.menu'), icon: 'more', iconOnly: true, tone: 'plain', onPress: () => setMenu(true) } : undefined}
          />
        </View>
        {body()}
      </SafeAreaView>
      <ActionSheet title={menu ? snap.title : null} actions={menuActions} dark={palette.dark} onClose={() => setMenu(false)} />
      <Toast message={toast.message} action={toast.action} onHidden={toast.hide} key={toast.key} />
      <DialogHost />
    </AppModal>
  );
}

function Message({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  const styles = useStyles();
  return (
    <ScrollView contentContainerStyle={styles.message}>
      <Text style={styles.messageTitle} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={styles.messageBody}>{body}</Text> : null}
      {children}
    </ScrollView>
  );
}

function Button({ label, onPress, tone = 'primary' }: { label: string; onPress: () => void; tone?: 'primary' | 'secondary' }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [tone === 'primary' ? styles.primary : styles.secondary, pressed && styles.pressed]}
    >
      <WholeWordsText style={tone === 'primary' ? styles.primaryText : styles.secondaryText}>{label}</WholeWordsText>
    </Pressable>
  );
}

function OverlayView({
  overlay,
  name,
  onFix,
  onReload,
  onDismiss,
  onClose,
}: {
  overlay: NonNullable<Overlay>;
  name: string;
  onFix: () => void;
  onReload: () => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      overlay.kind === 'error' ? t('apps.errorTitle', { name }) : overlay.kind === 'crash' ? t('apps.crashedTitle', { name }) : t('apps.hangTitle', { name }),
    );
  }, [overlay.kind, name]);
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.overlayContent}>
        <Icon name="info" size={32} color={palette.danger} />
        {overlay.kind === 'error' ? (
          <>
            <Text style={styles.messageTitle} accessibilityRole="header">
              {t('apps.errorTitle', { name })}
            </Text>
            <Text style={styles.messageBody}>{t('apps.errorBody')}</Text>
            <ErrorDetails details={formatDiagnostics(overlay.diagnostics.slice(-5))} />
            <Button label={t('apps.askFix')} onPress={onFix} />
            <Button label={t('apps.reload')} onPress={onReload} tone="secondary" />
            <Button label={t('apps.dismiss')} onPress={onDismiss} tone="secondary" />
          </>
        ) : overlay.kind === 'crash' ? (
          <>
            <Text style={styles.messageTitle} accessibilityRole="header">
              {t('apps.crashedTitle', { name })}
            </Text>
            <Text style={styles.messageBody}>{t('apps.crashedBody')}</Text>
            <Button label={t('apps.reload')} onPress={onReload} />
            <Button label={t('apps.close')} onPress={onClose} tone="secondary" />
          </>
        ) : (
          <>
            <Text style={styles.messageTitle} accessibilityRole="header">
              {t('apps.hangTitle', { name })}
            </Text>
            <Text style={styles.messageBody}>{t('apps.hangBody')}</Text>
            <Button label={t('apps.reload')} onPress={onReload} />
            <Button label={t('apps.askFix')} onPress={onFix} tone="secondary" />
            <Button label={t('apps.close')} onPress={onClose} tone="secondary" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  header: { backgroundColor: c.chrome, borderBottomWidth: 1, borderBottomColor: c.separator },
  message: { padding: 24, gap: 12, alignItems: 'stretch' },
  messageTitle: { fontSize: 19, fontWeight: '700', color: c.text, textAlign: 'center' },
  messageBody: { fontSize: 15, lineHeight: 21, color: c.textSecondary, textAlign: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.bg },
  overlayContent: { padding: 24, gap: 12, alignItems: 'stretch', maxWidth: 520, width: '100%', alignSelf: 'center' },
  primary: { backgroundColor: c.tint, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  primaryText: { color: c.onTint, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondary: { backgroundColor: c.sunken, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  secondaryText: { color: c.tintText, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.8 },
}));
