import { Directory, File, Paths } from 'expo-file-system';
import type { Tab } from '../browser/Tab';
import type { OfflinePage } from '../storage/offlinePages';
import type { Snapshot } from './pdf';

function offlineDir(): Directory {
  const dir = new Directory(Paths.document, 'Offline');
  if (!dir.exists) dir.create({ idempotent: true });
  return dir;
}

/**
 * Saves the page with its images and readable CSS inlined (the same copy used for PDFs), so it
 * opens without a connection. Scripts are not kept, so interactive parts won't work offline.
 */
export async function savePageOffline(tab: Tab): Promise<OfflinePage> {
  const snapshot = await tab.run<Snapshot>('snapshotHtml', [], 60000);
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const file = new File(offlineDir(), `${id}.html`);
  await file.write(snapshot.html);
  return {
    id,
    url: snapshot.url || tab.url,
    title: snapshot.title || tab.title || tab.url,
    uri: file.uri,
    size: file.size ?? null,
    savedAt: Date.now(),
  };
}

export async function readOfflinePage(page: OfflinePage): Promise<string> {
  return new File(page.uri).text();
}

export function deleteOfflineFile(page: OfflinePage) {
  const file = new File(page.uri);
  if (file.exists) file.delete();
}
