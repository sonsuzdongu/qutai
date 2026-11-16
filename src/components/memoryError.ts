import { t } from '../i18n';
import { HiddenLabelError, MemorySaveError } from '../storage/memory';
import { MAX_MEMORIES } from '../agent/memory';

/** Why a memory wasn't saved, in the app's language (the error's own message is English, for the model). */
export function memoryErrorText(e: unknown): string {
  if (e instanceof HiddenLabelError) return t('memory.hiddenLabelNeeded');
  if (e instanceof MemorySaveError) {
    switch (e.code) {
      case 'empty':
        return t('memory.errorEmpty');
      case 'sensitive':
        return t('memory.errorSensitive');
      case 'idOutsideCategory':
        return t('memory.errorIdCategory', {
          identity: t('memory.category.identity'),
          travel: t('memory.category.travel'),
        });
      case 'full':
        return t('memory.errorFull', { max: MAX_MEMORIES });
    }
  }
  return t('memory.errorUnknown');
}
