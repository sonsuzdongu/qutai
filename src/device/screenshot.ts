import { File } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { ToolImage } from '../ai/types';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { PermissionDeniedError } from './settings';
import { stitchCapture, withFullPage } from './fullPage';

/** Longest side of screenshots sent to the model, in pixels: readable text without huge token costs. */
const MODEL_IMAGE_MAX_PX = 1024;

function measure(tab: Tab): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!tab.container) return reject(new Error(t('error.tabNotReady')));
    tab.container.measure((_x, _y, width, height) => resolve({ width, height }));
  });
}

/** Output size in view-shot units (points), so that the image is at most MODEL_IMAGE_MAX_PX on its long side. */
export function modelImageSize(width: number, height: number, pixelRatio: number) {
  const scale = Math.min(1, MODEL_IMAGE_MAX_PX / (Math.max(width, height) * pixelRatio));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Captures the visible part of the tab as a compact JPEG for the model to look at. */
export async function captureForModel(tab: Tab): Promise<ToolImage & { width: number; height: number }> {
  const view = await measure(tab);
  if (view.width === 0 || view.height === 0) throw new Error(t('error.tabNotVisible'));
  const size = modelImageSize(view.width, view.height, PixelRatio.get());
  const data = await captureRef(tab.container!, { format: 'jpg', quality: 0.7, result: 'base64', ...size });
  // view-shot sizes are in points; the image has that many points times the pixel ratio.
  const pixels = {
    width: Math.round(size.width * PixelRatio.get()),
    height: Math.round(size.height * PixelRatio.get()),
  };
  return { mediaType: 'image/jpeg', data, ...pixels };
}

/**
 * Saves the visible part of the tab to the photo library. Only add-only access is
 * requested, so the app never gets to read the user's photos.
 */
export async function saveScreenshot(tab: Tab): Promise<void> {
  if (!tab.container) throw new Error(t('error.tabNotReady'));

  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new PermissionDeniedError(t('error.photosPermission'), permission.canAskAgain);

  const uri = await captureRef(tab.container, { format: 'png', quality: 1, result: 'tmpfile' });
  try {
    await Asset.create(uri);
  } finally {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}

export type FullPageResult = {
  /** How many images were saved: 1, unless the page was too long for one image on this device. */
  images: number;
  /** How many screens were captured; with `truncated`, the end of the page after them is missing. */
  screens: number;
  truncated: boolean;
};

/**
 * Saves the whole page (scrolled and stitched) to the photo library as one image, made narrower
 * if needed to fit in memory. Only when the page is too long for one image on this device is it
 * split into several, cut between screens; the result says how many and whether the end is missing.
 */
export async function saveFullPageScreenshot(tab: Tab): Promise<FullPageResult> {
  if (!tab.container) throw new Error(t('error.tabNotReady'));

  // Asked before capturing, so a refusal doesn't waste a long capture.
  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new PermissionDeniedError(t('error.photosPermission'), permission.canAskAgain);

  return withFullPage(
    tab,
    async (capture) => {
      const { files, truncated } = await stitchCapture(capture);
      try {
        for (const file of files) await Asset.create(file.uri);
      } finally {
        files.forEach((file) => file.exists && file.delete());
      }
      return { images: files.length, screens: capture.pieces.length, truncated };
    },
    { oneImage: true },
  );
}
