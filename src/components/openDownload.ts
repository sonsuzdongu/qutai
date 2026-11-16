import { t } from '../i18n';
import type { DownloadItem, DownloadStore, OpenResult } from '../storage/downloads';
import { dialog } from './Dialog';

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
export async function openDownload(store: DownloadStore, item: DownloadItem, notify: (message: string) => void) {
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
