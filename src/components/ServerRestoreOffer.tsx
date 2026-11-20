import { useEffect, useState } from 'react';
import { useAccountState } from '../account';
import { downloadServerBackup, keptPassword, runRestoreOffer, serverBackupEnabled, type ServerBackup } from '../backup/server';
import { errorDetails, errorKind } from '../backup/server/logic';
import { t } from '../i18n';
import { formatDateTime } from '../i18n/format';
import { BackupScreen, type ServerRestoreJob } from './BackupScreen';
import { dialog } from './Dialog';
import { serverBackupErrorText } from './ServerBackupSection';

function askRestore(backup: ServerBackup): Promise<boolean> {
  return dialog.confirm({
    title: t('serverBackup.offerTitle'),
    message: t('serverBackup.offerBody', {
      date: formatDateTime(new Date(backup.createdAt)),
      device: backup.deviceLabel ?? '–',
    }),
    confirmText: t('serverBackup.restore'),
    cancelText: t('serverBackup.offerLater'),
  });
}

/**
 * The restore offer (docs/server-backup.md › Restore offer after sign-in; src/backup/server/offer.ts): whenever `ready`
 * is true after a fresh sign-in to an account with a backup worth offering, asks once; "Restore" downloads it and
 * returns it as the import screen's job. A result that comes back after `ready` went false is dropped without
 * counting as asked, and asked again the next time `ready` is true. Used by the browser and by setup's account screen.
 */
export function useServerRestoreOffer(ready: boolean): [ServerRestoreJob | null, () => void] {
  const account = useAccountState();
  const userId = account.status === 'signedIn' ? account.user.id : null;
  const [job, setJob] = useState<ServerRestoreJob | null>(null);

  useEffect(() => {
    if (!serverBackupEnabled || !ready || !userId) return;
    let live = true;
    void (async () => {
      const { outcome, backup } = await runRestoreOffer(() => live, askRestore);
      // The user said "Restore": go on even if something came in front meanwhile (the import screen opens over it).
      if (outcome !== 'accepted' || !backup) return;
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

  return [job, () => setJob(null)];
}

/**
 * The browser's restore offer. `ready`: nothing else is in front (no lock, no Settings, no intro, no running task).
 */
export function ServerRestoreOffer({ ready, appLock }: { ready: boolean; appLock: boolean }) {
  const [job, close] = useServerRestoreOffer(ready);
  return <BackupScreen job={job} appLock={appLock} onClose={close} />;
}
