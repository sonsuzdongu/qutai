import type { SymbolViewProps } from 'expo-symbols';

/**
 * iOS: the SF Symbol's own name is the filled one (`stop.fill`), so nothing more is needed. Android's filled font is in
 * filledIcons.android.ts, which keeps it out of the iOS app.
 */
export const FILLED_WEIGHT: SymbolViewProps['weight'] = undefined;
