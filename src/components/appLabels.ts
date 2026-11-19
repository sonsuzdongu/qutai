import { AppFileError } from '../apps/appFile';
import { t, type MessageKey } from '../i18n';

/** Plain words for apps: permissions, and an import that failed (docs/mini-apps.md › Phase 2). */

/** A permission in plain words. */
export function appPermissionLabel(permission: string): string {
  const keys: Record<string, MessageKey> = {
    'clipboard-read': 'apps.perm.clipboardRead',
    'clipboard-write': 'apps.perm.clipboardWrite',
    share: 'apps.perm.share',
    files: 'apps.perm.files',
    location: 'apps.perm.location',
    notifications: 'apps.perm.notifications',
    camera: 'apps.perm.camera',
    photos: 'apps.perm.photos',
    links: 'apps.perm.links',
    assistant: 'apps.perm.assistant',
    network: 'apps.perm.network',
  };
  return keys[permission] ? t(keys[permission]) : permission;
}

/** An import that failed, as one plain sentence and the technical line for Details. */
export function importErrorMessage(e: unknown): { message: string; detail: string } {
  if (e instanceof AppFileError) {
    const keys: Record<AppFileError['code'], MessageKey> = {
      'not-app': 'apps.importError.notApp',
      backup: 'apps.importError.backup',
      'too-large': 'apps.importError.tooLarge',
      newer: 'apps.importError.newer',
      damaged: 'apps.importError.damaged',
      invalid: 'apps.importError.invalid',
    };
    return { message: t(keys[e.code]), detail: e.detail || e.code };
  }
  return { message: t('apps.importError.unreadable'), detail: e instanceof Error ? e.message : String(e) };
}
