import { MaterialSymbols_400Regular_Filled } from '@expo-google-fonts/material-symbols/400Regular_Filled';
import type { SymbolViewProps } from 'expo-symbols';

/**
 * Android: the filled Material Symbols font, for icons that are filled on iOS (iconNames.ts); expo-symbols takes the
 * font as its "weight". Regular weight, like the outlined default, so filled and outlined icons sit side by side evenly.
 */
export const FILLED_WEIGHT: SymbolViewProps['weight'] = {
  ios: 'unspecified',
  android: { name: 'MaterialSymbols_400Regular_Filled', font: MaterialSymbols_400Regular_Filled },
};
