import { getLocale, t } from '../i18n';
import { formatList } from '../i18n/format';
import type { Filters } from './imageFilters';

/**
 * What the filters did, in the app's language, for an edited image's card and the sheet's message: "Greyscale,
 * sharpened". Same order as they apply (src/chat/imageFilters.ts); '' when there are none.
 */
export function describeFilters(f: Partial<Filters> | undefined): string {
  if (!f) return '';
  const parts: string[] = [];
  if (f.auto) parts.push(t('filters.done.auto'));
  if (f.brightness) parts.push(t(f.brightness > 0 ? 'filters.done.brighter' : 'filters.done.darker'));
  if (f.contrast) parts.push(t(f.contrast > 0 ? 'filters.done.moreContrast' : 'filters.done.lessContrast'));
  if (f.saturation) parts.push(t(f.saturation > 0 ? 'filters.done.moreSaturated' : 'filters.done.lessSaturated'));
  if (f.warmth) parts.push(t(f.warmth > 0 ? 'filters.done.warmer' : 'filters.done.cooler'));
  if (f.greyscale) parts.push(t('filters.done.greyscale'));
  if (f.sepia) parts.push(t('filters.done.sepia'));
  if (f.invert) parts.push(t('filters.done.inverted'));
  if (f.blur) parts.push(t('filters.done.blurred'));
  if (f.sharpen) parts.push(t('filters.done.sharpened'));
  if (!parts.length) return '';
  const text = formatList(parts);
  return text.charAt(0).toLocaleUpperCase(getLocale()) + text.slice(1);
}
