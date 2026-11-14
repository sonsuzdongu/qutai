import { ID_NUMBER_CATEGORIES, MemoryCategory } from '../agent/memory';
import type { PersonalKind } from '../agent/personalData';
import { t } from '../i18n';
import type { IconName } from '../ui/Icon';

/** Each memory category's icon on the Memory screen and in setup. */
export const CATEGORY_ICONS: Record<MemoryCategory, IconName> = {
  identity: 'person',
  addresses: 'home',
  shopping: 'delivery',
  travel: 'travel',
  food: 'food',
  budget: 'wallet',
  general: 'preferences',
};

export const categoryName = (category: MemoryCategory) => t(`memory.category.${category}`);

/** Whether the warning about ID and passport numbers belongs under this category. */
export const warnsAboutIdNumbers = (category: MemoryCategory) => ID_NUMBER_CATEGORIES.has(category);

/** "your name, phone number and address", for the personal-information question. */
export function personalKindsLabel(kinds: PersonalKind[]): string {
  const names = kinds.map((kind) => t(`personal.kind.${kind}`));
  if (names.length <= 1) return names[0] ?? t('personal.kind.other');
  return `${names.slice(0, -1).join(', ')}${t('personal.and')}${names[names.length - 1]}`;
}
