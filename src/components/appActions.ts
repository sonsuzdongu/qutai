import { appDataBytes, appDataCount, appFileName, buildAppFile } from '../apps/appFile';
import { appStore, appsChanged } from '../apps/appStore';
import { appImporter } from '../apps/importState';
import { appVersion } from '../device/appVersion';
import { pickAppFile, shareAppFile } from '../device/appFile';
import { t } from '../i18n';
import { formatSize } from '../i18n/format';
import { importErrorMessage } from './appLabels';
import { dialog } from './Dialog';

/** Renaming, deleting, exporting and importing apps, the same from "My apps" and the runner's menu. */

/** The new name, or null when nothing changed. */
export async function renameApp(app: { id: string; name: string }): Promise<string | null> {
  const name = await dialog.prompt({ title: t('apps.renameTitle'), label: t('apps.nameLabel'), initial: app.name, maxLength: 40 });
  if (!name || name === app.name) return null;
  await appStore.rename(app.id, name);
  appsChanged.emit();
  return name;
}

/** Asks, saying what goes (versions and data), then deletes; true when deleted. */
export async function deleteApp(app: { id: string; name: string }): Promise<boolean> {
  const [size, versions] = await Promise.all([appStore.dataSize(app.id).catch(() => 0), appStore.versions(app.id).catch(() => [])]);
  const ok = await dialog.confirm({
    title: t('apps.deleteTitle', { name: app.name }),
    message: t('apps.deleteBody', { count: versions.length, size: formatSize(size) }),
    confirmText: t('apps.deleteConfirm'),
    destructive: true,
  });
  if (!ok) return false;
  await appStore.remove(app.id);
  appsChanged.emit();
  return true;
}

/**
 * Export as a `.qutaiapp` file (docs/mini-apps.md › The export file): the user chooses without data (the default: data
 * can be personal and goes wherever the file goes) or with it, then the system sheet saves or sends the file. Only the
 * current version. False when cancelled.
 */
export async function exportApp(app: { id: string; name: string }): Promise<boolean> {
  const [loaded, data] = await Promise.all([appStore.load(app.id), appStore.exportData(app.id)]);
  if (!loaded) return false;
  const count = appDataCount(data);
  let withData = false;
  if (count > 0) {
    const answer = await dialog.show({
      title: t('apps.exportTitle', { name: app.name }),
      message: t('apps.exportBody', { count, size: formatSize(appDataBytes(data)) }),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('apps.exportWith') },
        { text: t('apps.exportWithout'), primary: true },
      ],
    });
    if (answer.button === null || answer.button === 0) return false;
    withData = answer.button === 1;
  }
  const text = buildAppFile({
    pkg: loaded.pkg,
    data: withData ? data : null,
    exportedAt: new Date().toISOString(),
    exportedBy: `Qutai ${appVersion().version}`,
  });
  try {
    await shareAppFile(text, appFileName(loaded.name, withData, t('apps.fileWithData')));
    return true;
  } catch (e) {
    dialog.alert(t('apps.exportFailed'), undefined, undefined, e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** My apps › Import an app: the system picker, then the import screen. */
export async function pickAndImportApp(): Promise<void> {
  try {
    const picked = await pickAppFile();
    if (picked) appImporter.open(picked);
  } catch (e) {
    const { message, detail } = importErrorMessage(e);
    dialog.alert(t('apps.importErrorTitle'), message, undefined, detail);
  }
}
