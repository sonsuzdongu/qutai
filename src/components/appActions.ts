import { appStore, appsChanged } from '../apps/appStore';
import { t } from '../i18n';
import { formatSize } from '../i18n/format';
import { dialog } from './Dialog';

/** Renaming and deleting an app, the same from "My apps" and the runner's menu. */

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
