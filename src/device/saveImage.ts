import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
};

/** Splits a data URL into its MIME type and base64 payload. */
export function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const match = /^data:([^;,]+)(;[^,]*)?;base64,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[3] };
}

export function extensionFor(mime: string): string {
  return EXTENSIONS[mime.toLowerCase()] ?? 'jpg';
}

/** Extension from the image URL's path (e.g. ".png"), for downloads whose type is not known up front. */
export function extensionFromUrl(url: string): string {
  const path = url.split(/[?#]/)[0].toLowerCase();
  const ext = /\.([a-z0-9]{3,4})$/.exec(path)?.[1];
  const known = ext === 'jpeg' ? 'jpg' : ext;
  return known && Object.values(EXTENSIONS).includes(known) ? known : 'jpg';
}

/**
 * Saves a long-pressed image to Photos. The page fetches it first, with the site's cookies,
 * so images behind a login work too; if that fails (CORS), it is downloaded directly.
 */
export async function saveImage(tab: Tab, src: string): Promise<void> {
  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new Error(t('error.photosPermission'));

  const name = `alpai-${Date.now()}`;
  let file: File | null = null;
  try {
    const data = src.startsWith('data:') ? src : await tab.run<string>('imageData', [src], 30000).catch(() => null);
    const parsed = data ? parseDataUrl(data) : null;
    if (parsed) {
      file = new File(Paths.cache, `${name}.${extensionFor(parsed.mime)}`);
      await file.write(parsed.base64, { encoding: 'base64' });
    } else if (!src.startsWith('data:')) {
      file = await File.downloadFileAsync(src, new File(Paths.cache, `${name}.${extensionFromUrl(src)}`));
    } else {
      throw new Error(t('error.imageUnreadable'));
    }
    await Asset.create(file.uri);
  } finally {
    if (file?.exists) file.delete();
  }
}
