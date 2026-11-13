import { File } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { ToolImage } from '../ai/types';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';

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
export async function captureForModel(tab: Tab): Promise<ToolImage> {
  const view = await measure(tab);
  if (view.width === 0 || view.height === 0) throw new Error(t('error.tabNotVisible'));
  const size = modelImageSize(view.width, view.height, PixelRatio.get());
  const data = await captureRef(tab.container!, { format: 'jpg', quality: 0.7, result: 'base64', ...size });
  return { mediaType: 'image/jpeg', data };
}

/**
 * Saves the visible part of the tab to the photo library. Only add-only access is
 * requested, so the app never gets to read the user's photos.
 */
export async function saveScreenshot(tab: Tab): Promise<void> {
  if (!tab.container) throw new Error(t('error.tabNotReady'));

  const permission = await requestPermissionsAsync(true, ['photo']);
  if (!permission.granted) throw new Error(t('error.photosPermission'));

  const uri = await captureRef(tab.container, { format: 'png', quality: 1, result: 'tmpfile' });
  try {
    await Asset.create(uri);
  } finally {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}
