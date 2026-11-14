import { ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { sleep } from '../utils/sleep';

/** At most this many viewport-sized pieces; endless feeds would otherwise never stop. */
export const MAX_PIECES = 25;
/** At most this much of the page, in CSS pixels (about 25 phone screens). */
export const MAX_PAGE_HEIGHT = 20000;
/** Pieces are captured at most this wide in pixels: sharp text without huge bitmaps. */
export const MAX_PIECE_WIDTH_PX = 1080;
/**
 * Tallest single image we stitch, in pixels. 8192 is the smallest common GPU texture limit and
 * keeps one 1080 px wide bitmap around 35 MB; longer pages are split into several images.
 */
export const MAX_IMAGE_HEIGHT_PX = 8192;

type Metrics = { y: number; viewportHeight: number; pageHeight: number };

/** One captured screen, as a temporary JPEG; the top `cropTop` pixels repeat the previous piece. */
export type Piece = { uri: string; cropTop: number };

export type FullPageCapture = {
  pieces: Piece[];
  /** Size of every piece image in pixels (they are all the same). */
  width: number;
  height: number;
  /** The page was longer than the limits allowed, so its end is missing. */
  truncated: boolean;
};

// --- Progress, shown by CaptureOverlay; one capture runs at a time. ---

export type CaptureProgress = { done: number; total: number; stage: 'capturing' | 'stitching' };

let progress: CaptureProgress | null = null;
let cancelled = false;
const listeners = new Set<() => void>();

function setProgress(next: CaptureProgress | null) {
  progress = next;
  listeners.forEach((l) => l());
}

export function useCaptureProgress(): CaptureProgress | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => progress,
  );
}

/** Stops the running capture after the current piece; it rejects with a "cancelled" error. */
export function cancelCapture() {
  cancelled = true;
}

export class CaptureCancelled extends Error {
  constructor() {
    super(t('capture.cancelled'));
  }
}

function checkCancelled() {
  if (cancelled) throw new CaptureCancelled();
}

function measure(tab: Tab): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!tab.container) return reject(new Error(t('error.tabNotReady')));
    tab.container.measure((_x, _y, width, height) => resolve({ width, height }));
  });
}

export function deletePieces(pieces: Piece[]) {
  for (const piece of pieces) {
    try {
      const file = new File(piece.uri);
      if (file.exists) file.delete();
    } catch {
      // Temporary files; the system clears the cache eventually anyway.
    }
  }
}

/**
 * Scrolls the page from the top one screen at a time and captures each screen of the tab's
 * view. The page's scroll position, styles and the tab's input are always restored, also when
 * the capture fails or is cancelled. The caller owns the returned files (see deletePieces).
 */
export async function captureFullPage(tab: Tab): Promise<FullPageCapture> {
  if (progress) throw new Error(t('capture.busy'));
  if (!tab.container) throw new Error(t('error.tabNotReady'));
  // Claimed before the first await, so two captures can never overlap.
  cancelled = false;
  setProgress({ done: 0, total: 1, stage: 'capturing' });
  const pieces: Piece[] = [];
  let truncated = false;
  try {
    const view = await measure(tab);
    if (view.width === 0 || view.height === 0) throw new Error(t('error.tabNotVisible'));
    // view-shot sizes are in points; keep the pixel width at or below MAX_PIECE_WIDTH_PX.
    const ratio = PixelRatio.get();
    const scale = Math.min(1, MAX_PIECE_WIDTH_PX / (view.width * ratio));
    const size = { width: Math.round(view.width * scale), height: Math.round(view.height * scale) };
    const pixels = { width: Math.round(size.width * ratio), height: Math.round(size.height * ratio) };

    tab.setCapturing(true);
    // Lets the WebView apply the hidden scrollbars before the first piece.
    await sleep(100);
    await tab.run('captureBegin', [], 15000);
    // Where the content already captured ends, in CSS pixels.
    let coveredTo = 0;
    for (let index = 0; ; index++) {
      checkCancelled();
      const target = index === 0 ? 0 : coveredTo;
      // Page commands wait for lazy images, so they get more time than usual.
      const metrics = await tab.run<Metrics>('captureStep', [target, index], 15000);
      checkCancelled();
      const viewportHeight = metrics.viewportHeight || 1;
      // The page could not scroll further (it ended, or stopped short of the target).
      if (index > 0 && metrics.y + viewportHeight <= coveredTo + 1) break;

      const uri = await captureRef(tab.container!, { format: 'jpg', quality: 0.9, result: 'tmpfile', ...size });
      const overlap = Math.max(0, coveredTo - metrics.y);
      pieces.push({ uri, cropTop: Math.round((overlap / viewportHeight) * pixels.height) });
      coveredTo = metrics.y + viewportHeight;

      const limit = Math.min(metrics.pageHeight, MAX_PAGE_HEIGHT);
      const total = Math.min(MAX_PIECES, Math.max(pieces.length, Math.ceil(limit / viewportHeight)));
      setProgress({ done: pieces.length, total, stage: 'capturing' });
      // The page height is read again at every step: feeds grow while they are scrolled.
      if (coveredTo >= metrics.pageHeight - 1) break;
      if (pieces.length >= MAX_PIECES || coveredTo >= MAX_PAGE_HEIGHT) {
        truncated = true;
        break;
      }
    }
    return { pieces, ...pixels, truncated };
  } catch (e) {
    deletePieces(pieces);
    throw e;
  } finally {
    if (tab.capturing) {
      await tab.run('captureEnd', [], 5000).catch(() => {});
      tab.setCapturing(false);
    }
    setProgress(null);
  }
}

/** Same as captureFullPage, with the "stitching" stage shown while `work` runs on the result. */
export async function withFullPage<T>(tab: Tab, work: (capture: FullPageCapture) => Promise<T>): Promise<T> {
  const capture = await captureFullPage(tab);
  setProgress({ done: capture.pieces.length, total: capture.pieces.length, stage: 'stitching' });
  try {
    return await work(capture);
  } finally {
    deletePieces(capture.pieces);
    setProgress(null);
  }
}

async function loadImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const image = Skia.Image.MakeImageFromEncoded(data);
  if (!image) throw new Error(t('capture.decodeFailed'));
  return image;
}

/** Height a piece adds to the stitched page. */
function keptHeight(piece: Piece, height: number) {
  return Math.max(0, height - piece.cropTop);
}

/** The part of a decoded piece below its repeated top (the decoded size may differ by a pixel). */
function sourceRect(image: SkImage, piece: Piece, height: number) {
  const s = image.height() / height;
  return Skia.XYWHRect(0, piece.cropTop * s, image.width(), keptHeight(piece, height) * s);
}

/**
 * Groups the pieces into images no taller than MAX_IMAGE_HEIGHT_PX, cutting only between pieces
 * so no line of text is split in the middle.
 */
export function packPieces(pieces: Piece[], height: number): Piece[][] {
  const groups: Piece[][] = [];
  let current: Piece[] = [];
  let used = 0;
  for (const piece of pieces) {
    const kept = keptHeight(piece, height);
    if (kept === 0) continue;
    if (current.length > 0 && used + kept > MAX_IMAGE_HEIGHT_PX) {
      groups.push(current);
      current = [];
      used = 0;
    }
    current.push(piece);
    used += kept;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * Draws pieces one under the other on a CPU surface (no GPU texture size limit) and returns the
 * result as a temporary JPEG file. Pieces are decoded one at a time to keep memory low.
 */
async function stitch(group: Piece[], width: number, height: number): Promise<File> {
  const total = group.reduce((sum, piece) => sum + keptHeight(piece, height), 0);
  const surface = Skia.Surface.Make(width, total);
  if (!surface) throw new Error(t('capture.tooLarge'));
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));
  const paint = Skia.Paint();
  let y = 0;
  for (const piece of group) {
    const image = await loadImage(piece.uri);
    const kept = keptHeight(piece, height);
    canvas.drawImageRect(image, sourceRect(image, piece, height), Skia.XYWHRect(0, y, width, kept), paint);
    image.dispose();
    y += kept;
  }
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const bytes = snapshot.encodeToBytes(ImageFormat.JPEG, 90);
  snapshot.dispose();
  surface.dispose();
  if (!bytes || bytes.length === 0) throw new Error(t('capture.tooLarge'));

  const file = new File(Paths.cache, `qutai-page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  await file.write(bytes);
  return file;
}

export type StitchedImages = { files: File[]; truncated: boolean };

/** Stitches a capture into as few tall JPEGs as the bitmap limit allows. The caller deletes the files. */
export async function stitchCapture(capture: FullPageCapture): Promise<StitchedImages> {
  const files: File[] = [];
  try {
    for (const group of packPieces(capture.pieces, capture.height)) {
      files.push(await stitch(group, capture.width, capture.height));
    }
  } catch (e) {
    files.forEach((f) => f.exists && f.delete());
    throw e;
  }
  return { files, truncated: capture.truncated };
}

/** Crops a piece's repeated top away and returns it as base64 JPEG (for the PDF). */
export async function pieceBase64(piece: Piece, width: number, height: number): Promise<string> {
  const image = await loadImage(piece.uri);
  try {
    const kept = keptHeight(piece, height);
    if (piece.cropTop === 0) return image.encodeToBase64(ImageFormat.JPEG, 85);
    const surface = Skia.Surface.Make(width, kept);
    if (!surface) throw new Error(t('capture.tooLarge'));
    surface
      .getCanvas()
      .drawImageRect(image, sourceRect(image, piece, height), Skia.XYWHRect(0, 0, width, kept), Skia.Paint());
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 85);
    snapshot.dispose();
    surface.dispose();
    return base64;
  } finally {
    image.dispose();
  }
}
