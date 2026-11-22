import { SymbolView } from 'expo-symbols';
import { ColorValue, Platform, StyleProp, Text, useWindowDimensions, ViewStyle } from 'react-native';
import { FILLED_WEIGHT } from './filledIcons';
import { ICONS, iconFilled, type IconName } from './iconNames';

export type { IconName };

/** A line of text with an optional icon before it; the icon is decorative (the text says the same thing). */
export type IconLine = {
  icon?: IconName;
  text: string;
  /** 'danger': shown in red (a script's flags); the text must say the same on its own. */
  tone?: 'danger';
};

/**
 * A confirmation's message as lines with icons; spaced: a paragraph's space between the lines instead of none.
 * The text alone (lines joined) must still read in full, e.g. for a screen reader.
 */
export type IconLines = { lines: IconLine[]; spaced?: boolean };

type Props = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 20, color, style }: Props) {
  // On Android the symbol is a glyph of the Material Symbols font in a size×size box, and text follows the
  // system font size: at large text it would outgrow the box and be cut off. Icons keep their size instead.
  const { fontScale } = useWindowDimensions();
  const glyph = Platform.OS === 'android' && fontScale > 0 ? size / fontScale : size;
  const filled = iconFilled(name);
  return (
    <SymbolView
      // expo-symbols loads its font once, when it first draws: an icon that turns filled (bookmark → bookmarked)
      // starts over so the other font is loaded too.
      key={filled ? 'filled' : 'outlined'}
      name={ICONS[name]}
      weight={filled ? FILLED_WEIGHT : undefined}
      size={glyph}
      tintColor={color}
      style={[{ width: size, height: size }, style]}
      // Decorative: the label or text beside it says what it is.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      // Shown only where neither symbol set is available (e.g. tests, very old systems).
      fallback={<Text style={{ width: size, height: size, color, fontSize: size * 0.8 }}>•</Text>}
    />
  );
}
