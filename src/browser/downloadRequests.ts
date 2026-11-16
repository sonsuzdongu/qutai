import { PermissionsAndroid, Platform } from 'react-native';
import { dialog } from '../components/Dialog';
import { guessDownloadName, isRiskyDownload, safeFileName, siteOf } from '../device/download';
import { ensureNotificationPermission } from '../device/notifications';
import { t } from '../i18n';
import { AndroidDownloads } from '../storage/androidDownloads';
import type { DownloadStore } from '../storage/downloads';
import type { Tab } from './Tab';

/** What the WebView reported about a download a page started (Android gives more than iOS). */
export type PageDownload = {
  url: string;
  disposition: string | null;
  mime: string | null;
  length: number | null;
  userAgent: string | null;
  /**
   * The user touched the page in the 10 seconds before (Android; the WebView's listener says nothing about gestures).
   * iOS doesn't tell: its downloads start directly, as before.
   */
  userGesture: boolean;
};

/** The onFileDownload event's payload (Android: the patched listener's fields; iOS: only the URL). */
export function pageDownloadFrom(e: {
  downloadUrl: string;
  contentDisposition?: string;
  mimeType?: string;
  contentLength?: number;
  userAgent?: string;
  userGesture?: boolean;
}): PageDownload {
  return {
    url: e.downloadUrl,
    disposition: e.contentDisposition || null,
    mime: e.mimeType || null,
    length: e.contentLength && e.contentLength > 0 ? e.contentLength : null,
    userAgent: e.userAgent || null,
    userGesture: e.userGesture ?? true,
  };
}

/** Bytes per page round trip for blob: and data: downloads (base64 grows it by a third). */
const PAGE_CHUNK = 512 * 1024;

type BlobInfo = { size: number; type: string; name: string };

/** Where a download was asked for. */
type Origin = 'page' | 'user' | 'assistant';

/**
 * Decides about every download before it starts, on both platforms: the address kind (blob: and data: are read from
 * the page, content: / file: refused), a page that starts one without a recent tap ("<site> wants to download <file>"),
 * the warning for files that can install or run code, several automatic downloads from one site (ask, then offer to
 * block that site's downloads for the session), Android 9's storage permission and the notification permission at
 * the first download.
 */
export class DownloadRequests {
  /** Sites whose automatic downloads the user blocked this session. */
  private blockedSites = new Set<string>();
  /** Automatic downloads each site started this session. */
  private automatic = new Map<string, number>();
  private notificationsAsked = false;

  /** Short notices (the app's toast, set once it is mounted). */
  notify: (message: string) => void = () => {};

  constructor(private store: DownloadStore) {}

  /** The WebView's download listener (a link tap, or a page script). */
  async fromPage(tab: Tab, d: PageDownload): Promise<void> {
    const { name, nameFixed } = guessDownloadName(d.url, d.disposition, d.mime);
    await this.begin(tab, d.url, { name, nameFixed, mime: d.mime, length: d.length, userAgent: d.userAgent }, d.userGesture ? 'user' : 'page');
  }

  /** The long-press menu's "Download link" / Android's "Save image": the user clearly asked. */
  async fromUser(tab: Tab, url: string, suggested?: string): Promise<void> {
    const { name, nameFixed } = guessDownloadName(url, null, null);
    await this.begin(tab, url, { name: suggested ? safeFileName(suggested) : name, nameFixed }, 'user');
  }

  /**
   * The assistant's download_file, after the user confirmed it (with the dangerous-type warning): starts without asking
   * again and returns once it is listed.
   */
  async fromAssistant(tab: Tab, url: string, name: string, mime: string | null): Promise<void> {
    if (!(await this.begin(tab, url, { name, nameFixed: false, mime }, 'assistant'))) {
      throw new Error('The download did not start (no storage permission, or the address is not supported).');
    }
  }

  private async begin(
    tab: Tab,
    url: string,
    file: { name: string; nameFixed: boolean; mime?: string | null; length?: number | null; userAgent?: string | null },
    origin: Origin,
  ): Promise<boolean> {
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase() ?? '';
    if (!['http', 'https', 'blob', 'data'].includes(scheme)) {
      this.notify(t('downloads.refusedScheme'));
      return false;
    }
    let blob: BlobInfo | null = null;
    if (scheme === 'blob') {
      // The page knows the real type and the download attribute's name: ask it before deciding anything.
      blob = await tab.run<BlobInfo>('blobInfo', [url], 15000).catch(() => null);
      if (!blob) {
        this.notify(t('downloads.pageGone'));
        return false;
      }
      const type = blob.type || file.mime || null;
      const named = !file.nameFixed && blob.name ? safeFileName(blob.name) : file.name;
      const generic = named === 'download' || /^downloadfile(\.bin)?$/i.test(named);
      file = { ...file, mime: type, name: generic ? guessDownloadName('blob:', null, type).name : named };
    }
    if (scheme === 'data' && !file.nameFixed) {
      const named = await tab.run<string>('downloadName', [url], 3000).catch(() => '');
      if (named) file = { ...file, name: safeFileName(named) };
    }
    const site = siteOf(/^https?:/i.test(url) ? url : tab.url) || siteOf(tab.url);
    if (origin === 'page') {
      if (this.blockedSites.has(site)) {
        this.notify(t('downloads.siteBlocked', { site }));
        return false;
      }
      const count = this.automatic.get(site) ?? 0;
      this.automatic.set(site, count + 1);
      const risky = isRiskyDownload(file.name, file.mime ?? null);
      const result = await dialog.show({
        title: t('downloads.pageAsks', { site: site || t('downloads.thisPage'), name: file.name }),
        message: risky ? t('downloads.agentRisky', { host: site }) : undefined,
        buttons: [
          ...(count > 0 ? [{ text: t('downloads.blockSite'), style: 'destructive' as const }] : []),
          { text: t('common.cancel'), style: 'cancel' as const },
          { text: t('downloads.download'), primary: true },
        ],
      });
      const last = count > 0 ? 2 : 1;
      if (count > 0 && result.button === 0) {
        this.blockedSites.add(site);
        this.notify(t('downloads.siteBlocked', { site }));
        return false;
      }
      if (result.button !== last) return false;
    } else if (origin === 'user' && isRiskyDownload(file.name, file.mime ?? null)) {
      const ok = await dialog.confirm({
        title: t('downloads.riskyTitle', { name: file.name }),
        message: t('downloads.agentRisky', { host: site }),
        confirmText: t('downloads.download'),
      });
      if (!ok) return false;
    }
    if (!(await this.storageAllowed())) {
      this.notify(t('downloads.androidNoPermission'));
      return false;
    }
    if (scheme === 'blob' || scheme === 'data') {
      // Read from the page in the background; the entry shows the progress.
      this.fromPageBytes(tab, url, file.name, file.mime ?? null, blob).catch(() =>
        this.notify(t('downloads.failed', { name: file.name })),
      );
    } else {
      await this.store.start({
        tab,
        url,
        name: file.name,
        nameFixed: file.nameFixed,
        mime: file.mime,
        length: file.length,
        userAgent: file.userAgent ?? tab.userAgent ?? null,
      });
    }
    // No "Downloading …" toast: the download pill (DownloadIndicator) shows it, and the two were drawn on top of each other.
    this.askNotifications();
    return true;
  }

  /** Android 9 and older: writing to the public Downloads folder needs the storage permission. */
  private async storageAllowed(): Promise<boolean> {
    if (Platform.OS !== 'android' || !(this.store.backend instanceof AndroidDownloads)) return true;
    if (!this.store.backend.needsStoragePermission()) return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  /** Android: the progress notification needs permission on Android 13+ (asked once; downloads work without it). */
  private askNotifications() {
    if (Platform.OS !== 'android' || this.notificationsAsked) return;
    this.notificationsAsked = true;
    ensureNotificationPermission().catch(() => {});
  }

  /** A blob: or data: download: the bytes come from the page (or the address itself) in slices. */
  private async fromPageBytes(tab: Tab, url: string, name: string, mime: string | null, info: BlobInfo | null) {
    if (!info) return this.fromDataUrl(tab, url, name, mime);
    const writer = await this.store.beginPage({ tab, name, mime, total: info.size });
    try {
      for (let offset = 0; offset < info.size; offset += PAGE_CHUNK) {
        const chunk = await tab.run<string>('blobChunk', [url, offset, PAGE_CHUNK], 30000);
        if (!(await writer.write(chunk))) return;
      }
      await writer.end();
    } catch {
      await writer.fail('page');
    } finally {
      tab.run('blobRelease', [url]).catch(() => {});
    }
  }

  private async fromDataUrl(tab: Tab, url: string, name: string, mime: string | null) {
    const comma = url.indexOf(',');
    const header = url.slice(5, comma);
    const type = header.split(';')[0] || mime || 'text/plain';
    let base64 = url.slice(comma + 1);
    if (!/;base64$/i.test(header)) base64 = utf8ToBase64(decodeURIComponent(base64));
    const fileName = name === 'download' ? guessDownloadName('data:', null, type).name : name;
    const total = Math.floor((base64.replace(/=+$/, '').length * 3) / 4);
    const writer = await this.store.beginPage({ tab, name: fileName, mime: type, total });
    const step = (PAGE_CHUNK / 3) * 4;
    try {
      for (let i = 0; i < base64.length; i += step) {
        if (!(await writer.write(base64.slice(i, i + step)))) return;
      }
      await writer.end();
    } catch {
      await writer.fail('file');
    }
  }
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(out);
}
