import { useState } from 'react';
import { StyleProp, StyleSheet, Text, TextLayoutEvent, TextStyle } from 'react-native';

const MIN_SCALE = 0.6;
const STEP = 0.1;

/**
 * A short label in a fixed width: an option of a segmented control (equal-width buttons side by side) or a menu
 * item. At a large text size a long word (French "Désactivé", German "Startbildschirm") would otherwise break
 * inside the word. Here the label wraps only between words: while a line ends inside a word, the text gets a
 * little smaller (down to 60%), so every word stays whole.
 */
export function WholeWordsText({
  children,
  style,
  maxFontSizeMultiplier,
}: {
  children: string;
  style?: StyleProp<TextStyle>;
  maxFontSizeMultiplier?: number;
}) {
  const [fit, setFit] = useState({ text: children, scale: 1 });
  const scale = fit.text === children ? fit.scale : 1;
  const fontSize = StyleSheet.flatten(style)?.fontSize ?? 14;

  const onTextLayout = (e: TextLayoutEvent) => {
    const { lines } = e.nativeEvent;
    // A line that wraps on to the next without a space or hyphen at its end was cut inside a word.
    const cut = lines.slice(0, -1).some((line) => !/[\s\-‐‑/]$/.test(line.text));
    if (cut && scale > MIN_SCALE) setFit({ text: children, scale: Math.max(MIN_SCALE, scale - STEP) });
  };

  return (
    <Text
      style={[style, scale < 1 && { fontSize: fontSize * scale }]}
      onTextLayout={onTextLayout}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
    >
      {children}
    </Text>
  );
}
