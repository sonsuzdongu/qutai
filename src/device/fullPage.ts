import { ImageFormat, Skia, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { PixelRatio, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { sleep } from '../utils/sleep';

/**
 * At most this many screens are captured, so endless feeds stop; the user is told that only the first screens were
 * saved. 25 phone screens are at most about 55,000 px tall at 1080 px wide, which stays under JPEG's limit.
 */
export const MAX_SCREENS = 25;
/** Pieces are captured at most this wide in pixels: sharp text without huge bitmaps. */
export const MAX_PIECE_WIDTH_PX = 1080;
/**
 * A single image is never made narrower than this to keep it in one piece: 720 px is two device pixels per CSS
 * pixel on a 360 px wide phone layout, so body text stays legible. Below it, the page is split instead.
 */
export const MIN_SINGLE_IMAGE_WIDTH_PX = 720;
/** JPEG stores width and height in 16 bits (libjpeg's JPEG_MAX_DIMENSION). */
export const JPEG_MAX_DIMENSION = 65535;
/**
 * The most memory the stitched bitmap may take, at 4 bytes per pixel. Skia's raster surface itself allows up to 2 GB
 * (rows times row bytes below 2^31) and returns null only when the allocation fails, but on a phone a big allocation
 * usually succeeds and the system then kills the app, so the budget is a fixed conservative ceiling (React Native
 * and the installed Expo modules don't report the device's RAM). Android: 192 MB, a fraction of the 2 to 3 GB of
 * the smallest phones Qutai runs on, where the WebView already lives in its own process. iOS: 256 MB, well under the
 * per-app memory limit of the iPhones iOS 17 and later run on (3 GB RAM and more). Peak memory while stitching is
 * this bitmap plus one decoded screen (about 9 MB) plus the JPEG (some MB, held twice while it is handed to JS); the
 * snapshot that is encoded shares the bitmap's pixels instead of copying them.
 */
export const STITCH_BUDGET_BYTES = (Platform.OS === 'ios' ? 256 : 192) * 1024 * 1024;
const BYTES_PER_PIXEL = 4;
const MAX_STITCH_PIXELS = STITCH_BUDGET_BYTES / BYTES_PER_PIXEL;

/**
 * How much narrower than `width` (in pixels) a page `height` pixels tall has to be to become one image within the
 * memory budget and JPEG's limit: 1 when it already fits, never narrower than MIN_SINGLE_IMAGE_WIDTH_PX (or the
 * full width when that is narrower already). Width and height shrink together, so pixels shrink with the square.
 */
export function singleImageScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const fit = Math.min(1, Math.sqrt(MAX_STITCH_PIXELS / (width * height)), JPEG_MAX_DIMENSION / height);
  return Math.max(fit, Math.min(1, MIN_SINGLE_IMAGE_WIDTH_PX / width));
}

/** Whether an image of this size can be made in one piece. */
function fitsOneImage(width: number, height: number) {
  return width * height <= MAX_STITCH_PIXELS && height <= JPEG_MAX_DIMENSION;
}

type Metrics = { y: number; viewportHeight: number; pageHeight: number };

/** One captured screen, as a temporary JPEG; the top `cropTop` pixels repeat the previous piece. */
export type Piece = { uri: string; cropTop: number };

export type FullPageCapture = {
  pieces: Piece[];
  /** Size of every piece image in pixels (they are all the same). */
  width: number;
  height: number;
  /** The page was longer than MAX_SCREENS screens, so its end is missing. */
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
 *
 * With `oneImage`, the capture width is chosen from the page's height before the first screen is
 * captured, so that the stitched page fits in one image (see singleImageScale); otherwise screens
 * are captured at full width (the PDF keeps them as separate pages).
 */
export async function captureFullPage(tab: Tab, options: { oneImage?: boolean } = {}): Promise<FullPageCapture> {
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
    const fullScale = Math.min(1, MAX_PIECE_WIDTH_PX / (view.width * ratio));
    // Set from the first screen's measurements, before it is captured.
    let size = { width: 0, height: 0 };
    let pixels = { width: 0, height: 0 };

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

      if (index === 0) {
        let scale = fullScale;
        if (options.oneImage) {
          // The page's expected height in pixels at full width; feeds that grow later are scaled when stitching.
          const screens = Math.min(MAX_SCREENS, Math.max(1, metrics.pageHeight / viewportHeight));
          scale *= singleImageScale(view.width * fullScale * ratio, view.height * fullScale * ratio * screens);
        }
        size = { width: Math.round(view.width * scale), height: Math.round(view.height * scale) };
        pixels = { width: Math.round(size.width * ratio), height: Math.round(size.height * ratio) };
      }

      const uri = await captureRef(tab.container!, { format: 'jpg', quality: 0.9, result: 'tmpfile', ...size });
      const overlap = Math.max(0, coveredTo - metrics.y);
      pieces.push({ uri, cropTop: Math.round((overlap / viewportHeight) * pixels.height) });
      coveredTo = metrics.y + viewportHeight;

      const total = Math.min(MAX_SCREENS, Math.max(pieces.length, Math.ceil(metrics.pageHeight / viewportHeight)));
      setProgress({ done: pieces.length, total, stage: 'capturing' });
      // The page height is read again at every step: feeds grow while they are scrolled.
      if (coveredTo >= metrics.pageHeight - 1) break;
      if (pieces.length >= MAX_SCREENS) {
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

/**
 * Same as captureFullPage, with the "stitching" stage shown while `work` runs on the result.
 * `oneImage` is passed on to captureFullPage.
 */
export async function withFullPage<T>(
  tab: Tab,
  work: (capture: FullPageCapture) => Promise<T>,
  options: { oneImage?: boolean } = {},
): Promise<T> {
  const capture = await captureFullPage(tab, options);
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
  data.dispose();
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
 * Groups the pieces into images no taller than `maxHeight` pixels, cutting only between pieces
 * so no line of text is split in the middle. A piece taller than `maxHeight` gets an image of its own.
 */
export function packPieces(pieces: Piece[], height: number, maxHeight: number): Piece[][] {
  const groups: Piece[][] = [];
  let current: Piece[] = [];
  let used = 0;
  for (const piece of pieces) {
    const kept = keptHeight(piece, height);
    if (kept === 0) continue;
    if (current.length > 0 && used + kept > maxHeight) {
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

/** The bitmap could not be allocated or encoded: the caller tries again with smaller images. */
class StitchTooLarge extends Error {
  constructor() {
    super(t('capture.tooLarge'));
  }
}

/**
 * Draws pieces one under the other on a CPU surface (no GPU texture size limit), scaled by `scale`,
 * and returns the result as a temporary JPEG file. Pieces are decoded and released one at a time,
 * and the snapshot that is encoded shares the surface's pixels, so the bitmap is held only once.
 */
async function stitch(group: Piece[], width: number, height: number, scale: number, onDrawn: () => void): Promise<File> {
  const outWidth = Math.round(width * scale);
  const sourceTotal = group.reduce((sum, piece) => sum + keptHeight(piece, height), 0);
  const total = Math.round(sourceTotal * scale);
  const surface = Skia.Surface.Make(outWidth, total);
  if (!surface) throw new StitchTooLarge();
  let bytes: Uint8Array | null = null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(Skia.Color('white'));
    const paint = Skia.Paint();
    let sourceY = 0;
    for (const piece of group) {
      const image = await loadImage(piece.uri);
      try {
        const kept = keptHeight(piece, height);
        // Rounded edges, so neighbouring pieces meet without a gap or an overlap.
        const top = Math.round(sourceY * scale);
        const dest = Skia.XYWHRect(0, top, outWidth, Math.round((sourceY + kept) * scale) - top);
        if (scale === 1) canvas.drawImageRect(image, sourceRect(image, piece, height), dest, paint);
        // Mitchell filtering keeps downscaled text crisp.
        else canvas.drawImageRectCubic(image, sourceRect(image, piece, height), dest, 1 / 3, 1 / 3, paint);
        sourceY += kept;
      } finally {
        image.dispose();
      }
      onDrawn();
    }
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      bytes = snapshot.encodeToBytes(ImageFormat.JPEG, 90);
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
  if (!bytes || bytes.length === 0) throw new StitchTooLarge();

  const file = new File(Paths.cache, `qutai-page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  await file.write(bytes);
  return file;
}

export type StitchedImages = {
  files: File[];
  truncated: boolean;
  /** The page was too long for one image on this device, so it was cut between screens into `files.length` images. */
  split: boolean;
};

/**
 * Stitches a capture into one JPEG. If the page grew past what the capture width was chosen for,
 * the image is scaled down to fit (not below MIN_SINGLE_IMAGE_WIDTH_PX); only when that is not
 * enough, or the bitmap can't be allocated, it is cut between screens into as few images as fit,
 * halving the image size after each failed allocation. The caller deletes the files.
 */
export async function stitchCapture(capture: FullPageCapture): Promise<StitchedImages> {
  const { pieces, width, height } = capture;
  const sourceTotal = pieces.reduce((sum, piece) => sum + keptHeight(piece, height), 0);
  const oneScale = singleImageScale(width, sourceTotal);
  // `maxHeight` is in capture pixels; Infinity keeps the whole page in one image.
  let plan = fitsOneImage(width * oneScale, sourceTotal * oneScale)
    ? { scale: oneScale, maxHeight: Infinity }
    : { scale: 1, maxHeight: Math.min(JPEG_MAX_DIMENSION, Math.floor(MAX_STITCH_PIXELS / width)) };
  for (;;) {
    const groups = packPieces(pieces, height, plan.maxHeight);
    const files: File[] = [];
    let done = 0;
    const onDrawn = () => setProgress({ done: ++done, total: pieces.length, stage: 'stitching' });
    try {
      for (const group of groups) files.push(await stitch(group, width, height, plan.scale, onDrawn));
      return { files, truncated: capture.truncated, split: files.length > 1 };
    } catch (e) {
      files.forEach((f) => f.exists && f.delete());
      // A single screen that can't be allocated can't be split further.
      if (!(e instanceof StitchTooLarge) || groups.every((group) => group.length === 1)) throw e;
      // Full capture width, half the pixels of the largest image that was tried.
      const tallest = Math.max(...groups.map((group) => group.reduce((sum, p) => sum + keptHeight(p, height), 0)));
      plan = { scale: 1, maxHeight: Math.floor((tallest * plan.scale * plan.scale) / 2) };
    }
  }
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
