import { t } from '../i18n';
import type { DownloadItem, DownloadStore, OpenResult } from '../storage/downloads';
import { dialog } from './Dialog';
import { APP_FILE_EXTENSION } from '../apps/appFile';
import { appImporter } from '../apps/importState';

/** Shares the file; a short notice when it is gone or the share sheet could not open. */
export async function shareDownload(store: DownloadStore, item: DownloadItem, notify: (message: string) => void) {
  let result: OpenResult;
  try {
    result = await store.share(item.id, item.name);
  } catch {
    result = 'failed';
  }
  if (result === 'gone') notify(t('downloads.gone'));
  else if (result !== 'opened') notify(t('downloads.shareFailed'));
}

/**
 * "Open" on a finished download, from the Downloads screen, the download pill and (Android) a "done" notification no
 * app could open. Never silent: a file that is gone gets a notice; no app for the type, no access any more or a
 * refusal get a dialog that says what to do instead (share it, or open it from the phone's Downloads folder in the
 * Files app). An APK goes to the system's installer, which asks "allow from this source" itself.
 * `notify` shows a short notice where the user is looking (the Downloads screen has its own, over its sheet).
 */
export async function openDownload(
  store: DownloadStore,
  item: DownloadItem,
  notify: (message: string) => void,
  /** Closes the screen the tap came from before the import screen opens (iOS shows one sheet at a time). */
  beforeImport?: () => void,
) {
  // A Qutai app file opens the import screen (after the user's tap here), never anything else; not from incognito.
  if (item.uri && item.name.toLowerCase().endsWith(`.${APP_FILE_EXTENSION}`)) {
    if (item.incognito) return void dialog.alert(t('apps.importIncognito'));
    const uri = item.uri;
    if (beforeImport) {
      beforeImport();
      setTimeout(() => appImporter.open({ uri }), 450);
    } else appImporter.open({ uri });
    return;
  }
  let result: OpenResult;
  try {
    result = await store.open(item.id);
  } catch {
    result = 'failed';
  }
  if (result === 'opened') return;
  if (result === 'gone') return notify(t('downloads.gone'));
  if (result === 'noApp') {
    dialog.alert(t('downloads.noApp'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('downloads.share'), onPress: () => void shareDownload(store, item, notify) },
    ]);
    return;
  }
  const showFolder = async () => {
    if (!(await store.showFolder().catch(() => false))) notify(t('downloads.noFolder'));
  };
  dialog.alert(
    t(result === 'denied' ? 'downloads.openDenied' : 'downloads.openFailed', { name: item.name }),
    t(store.canShowFolder ? 'downloads.openElsewhere' : 'downloads.openElsewhereShare'),
    store.canShowFolder
      ? [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('downloads.showFolder'), onPress: () => void showFolder() },
        ]
      : [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('downloads.share'), onPress: () => void shareDownload(store, item, notify) },
        ],
  );
}
