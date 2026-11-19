import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  appDataCount,
  codeFlags,
  findClash,
  needsNewerQutai,
  packageBytes,
  readAppFile,
  unavailablePermissions,
  type AppFileContents,
} from '../apps/appFile';
import { appStore, appsChanged } from '../apps/appStore';
import { appImporter, type ImportRequest } from '../apps/importState';
import type { AppAuthor, AppPackage } from '../apps/manifest';
import { appRunner } from '../apps/runnerState';
import { readAppFileUri } from '../device/appFile';
import { t } from '../i18n';
import { formatSize } from '../i18n/format';
import { AppModal } from '../ui/AppModal';
import { Icon } from '../ui/Icon';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { makeStyles, readableColumn, usePalette } from '../ui/theme';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost, dialog } from './Dialog';
import { ErrorDetails } from './ErrorDetails';
import { appPermissionLabel, importErrorMessage } from './appLabels';
import { AppIconView } from './MyApps';
import { ScreenHeader } from './ScreenHeader';
import { WholeWordsText } from './WholeWordsText';

/**
 * Importing an app (docs/mini-apps.md › Import): the file is read and checked, then this screen shows what the app is
 * before anything is stored, the user decides about its data and any clash, and the app is stored switched off. The
 * runner then shows the same review on its approval screen, where the user turns it on.
 */

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** What an app is and can do: shown before an import is stored and on the runner's approval screen. */
export function AppReview({ pkg, author, showAuthor = true }: { pkg: AppPackage; author: AppAuthor; showAuthor?: boolean }) {
  const styles = useStyles();
  const palette = usePalette();
  const [reading, setReading] = useState<string | null>(null);
  const m = pkg.manifest;
  const later = unavailablePermissions(m);
  const flags = codeFlags(pkg.files);
  const files = Object.keys(pkg.files).sort((a, b) => (a === m.entry ? -1 : b === m.entry ? 1 : a.localeCompare(b)));
  return (
    <View style={styles.review}>
      <View style={styles.identity}>
        <AppIconView app={{ id: m.id, icon: m.icon }} size={64} />
        <View style={styles.identityText}>
          <Text style={styles.name} accessibilityRole="header">
            {m.name}
          </Text>
          {m.description ? <Text style={styles.body}>{m.description}</Text> : null}
          {showAuthor ? (
            <Text style={styles.meta}>{author.kind === 'imported' ? t('apps.importFrom', { file: author.file }) : t('apps.madeHere')}</Text>
          ) : null}
          <Text style={styles.meta}>{t('apps.importSize', { size: formatSize(packageBytes(pkg)), version: m.version })}</Text>
        </View>
      </View>

      {author.kind === 'imported' ? (
        <View style={styles.warning} accessibilityRole="alert">
          <Icon name="info" size={18} color={palette.danger} />
          <Text style={styles.warningText}>{t('apps.importWarning')}</Text>
        </View>
      ) : null}
      {needsNewerQutai(m) ? <Text style={styles.problem}>{t('apps.needsUpdate')}</Text> : null}

      <Text style={styles.section} accessibilityRole="header">
        {t('apps.importCanDo')}
      </Text>
      <Text style={styles.line}>{`• ${t('apps.importBasics')}`}</Text>
      {m.permissions.map((p) => (
        <Text key={p} style={styles.line}>
          {`• ${later.includes(p) ? t('apps.permLater', { permission: appPermissionLabel(p) }) : appPermissionLabel(p)}`}
        </Text>
      ))}
      {m.network?.hosts.length ? <Text style={styles.line}>{`• ${t('apps.importHosts', { hosts: m.network.hosts.join(', ') })}`}</Text> : null}
      <Text style={styles.line}>{`• ${t('apps.importOffline')}`}</Text>
      {flags.length ? <Text style={styles.problem}>{t('apps.importFlags', { flags: flags.join(', ') })}</Text> : null}

      <Text style={styles.section} accessibilityRole="header">
        {t('apps.importFiles')}
      </Text>
      {files.map((name) => (
        <Pressable
          key={name}
          onPress={() => setReading(name)}
          accessibilityRole="button"
          accessibilityHint={t('apps.importFileHint')}
          style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
        >
          <Icon name="document" size={18} color={palette.textSecondary} />
          <Text style={styles.fileName}>{name}</Text>
          <Text style={styles.meta}>{formatSize(new TextEncoder().encode(pkg.files[name]).length)}</Text>
          <Icon name="chevronRight" size={16} color={palette.textSecondary} />
        </Pressable>
      ))}
      <CodeViewer name={reading} text={reading ? (pkg.files[reading] ?? '') : ''} onClose={() => setReading(null)} />
    </View>
  );
}

/** A file's code, read only and selectable, in pieces so a 256 KB file stays smooth. */
function CodeViewer({ name, text, onClose }: { name: string | null; text: string; onClose: () => void }) {
  const styles = useStyles();
  const chunks = useMemo(() => {
    const lines = text.split('\n');
    const out: string[] = [];
    for (let i = 0; i < lines.length; i += 150) out.push(lines.slice(i, i + 150).join('\n'));
    return out;
  }, [text]);
  return (
    <AppModal visible={name !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader title={name ?? ''} right={{ label: t('common.done'), onPress: onClose }} />
        <Text style={[styles.meta, styles.codeNote]}>{t('apps.codeReadOnly')}</Text>
        <ScrollView contentContainerStyle={styles.code}>
          <ScrollView horizontal>
            <View>
              {chunks.map((chunk, i) => (
                <Text key={i} style={styles.codeText} selectable>
                  {chunk}
                </Text>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </SafeAreaView>
    </AppModal>
  );
}

type Loaded = { file: AppFileContents; name: string; existing: { id: string; name: string }[] };

export function AppImportHost({ onNotice }: { onNotice: (text: string) => void }) {
  const request = useSyncExternalStore(appImporter.subscribe, appImporter.current);
  if (!request) return null;
  return <ImportScreen key={request.serial} request={request} onNotice={onNotice} />;
}

function ImportScreen({ request, onNotice }: { request: ImportRequest; onNotice: (text: string) => void }) {
  const styles = useStyles();
  const [state, setState] = useState<{ kind: 'reading' } | { kind: 'error'; message: string; detail: string } | ({ kind: 'ready' } & Loaded)>({
    kind: 'reading',
  });
  const [withData, setWithData] = useState(false);
  const [mode, setMode] = useState<'keepBoth' | 'replace'>('keepBoth');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const picked = 'bytes' in request.source ? request.source : await readAppFileUri(request.source.uri);
        const file = readAppFile(picked.bytes);
        const existing = (await appStore.list()).map((a) => ({ id: a.id, name: a.name }));
        if (alive) setState({ kind: 'ready', file, name: picked.name, existing });
      } catch (e) {
        if (alive) setState({ kind: 'error', ...importErrorMessage(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [request]);

  const close = () => appImporter.close();

  const run = async (ready: Loaded) => {
    const { file, name } = ready;
    const clash = findClash(file.pkg.manifest, ready.existing);
    const target = clash && mode === 'replace' ? clash.app : null;
    let replaceData = false;
    if (target && withData && file.data) {
      const here = await appStore.dataSize(target.id).catch(() => 0);
      if (here > 0) {
        const answer = await dialog.show({
          title: t('apps.importReplaceDataTitle'),
          message: t('apps.importReplaceDataBody', { name: target.name, here: formatSize(here), file: formatSize(file.dataBytes) }),
          buttons: [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('apps.importKeepData') },
            { text: t('apps.importReplaceDataConfirm'), style: 'destructive' },
          ],
        });
        if (answer.button === null || answer.button === 0) return;
        replaceData = answer.button === 2;
      }
    }
    setBusy(true);
    try {
      if (target && appRunner.current()?.appId === target.id) appRunner.close();
      const id = await appStore.importApp({
        pkg: file.pkg,
        mode: target ? 'replace' : clash ? 'keepBoth' : 'new',
        targetId: target?.id,
        fileName: name,
        data: withData ? file.data : null,
        replaceData,
      });
      appsChanged.emit();
      const stored = await appStore.load(id);
      close();
      onNotice(t('apps.imported', { name: stored?.name ?? file.pkg.manifest.name }));
      // The runner shows the approval screen: the app runs only after Turn on.
      setTimeout(() => appRunner.open(id), 400);
    } catch (e) {
      setBusy(false);
      dialog.alert(t('apps.importErrorTitle'), importErrorMessage(e).message, undefined, importErrorMessage(e).detail);
    }
  };

  const body = () => {
    if (state.kind === 'reading')
      return (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      );
    if (state.kind === 'error')
      return (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.name} accessibilityRole="header">
            {t('apps.importErrorTitle')}
          </Text>
          <Text style={styles.body}>{state.message}</Text>
          <ErrorDetails details={state.detail} style={styles.details} />
          <Button label={t('common.close')} onPress={close} />
        </ScrollView>
      );
    const { file } = state;
    const clash = findClash(file.pkg.manifest, state.existing);
    const author: AppAuthor = { kind: 'imported', file: state.name, importedAt: '' };
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <AppReview pkg={file.pkg} author={author} />

        <Text style={styles.section} accessibilityRole="header">
          {t('apps.importDataTitle')}
        </Text>
        {file.data ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.label}>{t('apps.importData')}</Text>
              <Text style={styles.meta}>{t('apps.importDataHint', { count: appDataCount(file.data), size: formatSize(file.dataBytes) })}</Text>
            </View>
            <ThemedSwitch value={withData} onValueChange={setWithData} disabled={busy} accessibilityLabel={t('apps.importData')} />
          </View>
        ) : (
          <Text style={styles.body}>{t('apps.importNoData')}</Text>
        )}

        {clash ? (
          <>
            <Text style={styles.section} accessibilityRole="header">
              {t(clash.kind === 'id' ? 'apps.importClashId' : 'apps.importClashName', { name: clash.app.name })}
            </Text>
            <Choice selected={mode === 'keepBoth'} label={t('apps.importKeepBoth')} hint={t('apps.importKeepBothHint')} onPress={() => setMode('keepBoth')} />
            <Choice
              selected={mode === 'replace'}
              label={t('apps.importReplace', { name: clash.app.name })}
              hint={t('apps.importReplaceHint')}
              onPress={() => setMode('replace')}
            />
          </>
        ) : null}

        <Text style={styles.body}>{t('apps.importArrivesOff')}</Text>
        {busy ? <ActivityIndicator /> : <Button label={t('apps.importAction')} onPress={() => void run(state)} />}
        <Button label={t('common.cancel')} onPress={close} tone="secondary" />
      </ScrollView>
    );
  };

  return (
    <AppModal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.screen} edges={MODAL_SCREEN_EDGES}>
        <ScreenHeader title={t('apps.importTitle')} left={{ label: t('common.cancel'), onPress: close }} />
        {body()}
      </SafeAreaView>
      <DialogHost />
    </AppModal>
  );
}

function Choice({ selected, label, hint, onPress }: { selected: boolean; label: string; hint: string; onPress: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}
    >
      <Icon name={selected ? 'selected' : 'unselected'} size={20} color={selected ? palette.tintText : palette.textSecondary} />
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.meta}>{hint}</Text>
      </View>
    </Pressable>
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

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { ...readableColumn, padding: 16, gap: 12, paddingBottom: 40 },
  review: { gap: 10 },
  identity: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  identityText: { flex: 1, gap: 4 },
  name: { fontSize: 20, fontWeight: '700', color: c.text },
  body: { fontSize: 15, lineHeight: 21, color: c.text },
  meta: { fontSize: 13, lineHeight: 18, color: c.textSecondary },
  label: { fontSize: 16, fontWeight: '600', color: c.text },
  section: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginTop: 8, textTransform: 'uppercase' },
  line: { fontSize: 15, lineHeight: 21, color: c.text },
  problem: { fontSize: 14, lineHeight: 20, color: c.danger },
  warning: { flexDirection: 'row', gap: 10, backgroundColor: c.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: c.danger },
  warningText: { flex: 1, fontSize: 14, lineHeight: 20, color: c.text },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8 },
  fileName: { flex: 1, fontSize: 15, color: c.tintText, fontFamily: MONO },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  choice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: c.surface },
  choiceSelected: { borderWidth: 1, borderColor: c.tint },
  details: { marginLeft: 0 },
  code: { padding: 12 },
  codeNote: { paddingHorizontal: 16 },
  codeText: { fontSize: 12, lineHeight: 17, color: c.text, fontFamily: MONO },
  pressed: { opacity: 0.7 },
  primary: { backgroundColor: c.tint, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  primaryText: { color: c.onTint, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondary: { backgroundColor: c.sunken, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  secondaryText: { color: c.tintText, fontSize: 16, fontWeight: '600', textAlign: 'center' },
}));
