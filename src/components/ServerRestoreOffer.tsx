import { useEffect, useState } from 'react';
import { useAccountState } from '../account';
import { downloadServerBackup, keptPassword, restoreOffer, serverBackupEnabled } from '../backup/server';
import { errorDetails, errorKind } from '../backup/server/logic';
import { t } from '../i18n';
import { formatDateTime } from '../i18n/format';
import { BackupScreen, type ServerRestoreJob } from './BackupScreen';
import { dialog } from './Dialog';
import { serverBackupErrorText } from './ServerBackupSection';

/**
 * The restore offer (docs/server-backup.md › Restore offer after sign-in): once after each fresh sign-in to an account
 * with a server backup (logic.ts › shouldOfferRestore). Yes restores it through the usual import screen, which asks
 * merge or replace. `ready`: nothing else is in front (no lock, no Settings, no intro, no running task).
 */
export function ServerRestoreOffer({ ready, appLock }: { ready: boolean; appLock: boolean }) {
  const account = useAccountState();
  const userId = account.status === 'signedIn' ? account.user.id : null;
  const [job, setJob] = useState<ServerRestoreJob | null>(null);

  useEffect(() => {
    if (!serverBackupEnabled || !ready || !userId) return;
    let live = true;
    void (async () => {
      const backup = await restoreOffer();
      if (!live || !backup) return;
      const yes = await dialog.confirm({
        title: t('serverBackup.offerTitle'),
        message: t('serverBackup.offerBody', {
          date: formatDateTime(new Date(backup.createdAt)),
          device: backup.deviceLabel ?? '–',
        }),
        confirmText: t('serverBackup.restore'),
        cancelText: t('serverBackup.offerLater'),
      });
      if (!yes || !live) return;
      try {
        setJob({ file: await downloadServerBackup(backup), keptPassword: keptPassword() });
      } catch (error) {
        const kind = errorKind(error);
        if (kind !== 'cancelled') dialog.alert(t('serverBackup.restoreFailedTitle'), serverBackupErrorText(kind), undefined, errorDetails(error));
      }
    })();
    return () => {
      live = false;
    };
  }, [ready, userId]);

  return <BackupScreen job={job} appLock={appLock} onClose={() => setJob(null)} />;
}
