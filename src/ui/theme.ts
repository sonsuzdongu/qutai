import { useMemo } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

/**
 * Semantic colours for both appearances. Text pairs are chosen for at least 4.5:1 contrast
 * on the surfaces they sit on (measured, not eyeballed).
 */
export type Palette = {
  dark: boolean;
  /** Screen background. */
  bg: string;
  /** Browser chrome (address bar, toolbars). */
  chrome: string;
  /** Cards, rows, inputs. */
  surface: string;
  /** Recessed areas: segmented controls, code, placeholders. */
  sunken: string;
  /** Pressed state of rows and buttons. */
  pressed: string;
  text: string;
  /** Hints and metadata; 4.5:1 or better on bg and surface. */
  textSecondary: string;
  separator: string;
  border: string;
  /** Brand colour (the logo's blue) as a fill: buttons, selected states; white text on it is 5.75:1. */
  tint: string;
  /** Brand colour as text and links on bg and surface. */
  tintText: string;
  onTint: string;
  danger: string;
  /** Destructive buttons with white text. */
  dangerFill: string;
  backdrop: string;
};

export const lightPalette: Palette = {
  dark: false,
  bg: '#faf9f5',
  chrome: '#f5f4ef',
  surface: '#ffffff',
  sunken: '#ebe8e0',
  pressed: '#f1efe8',
  text: '#222222',
  textSecondary: '#6b6862',
  separator: '#e0ddd4',
  border: '#d6d3c9',
  tint: '#1565c0',
  tintText: '#1460b4',
  onTint: '#ffffff',
  danger: '#b3261e',
  dangerFill: '#b3261e',
  backdrop: 'rgba(0,0,0,0.3)',
};

export const darkPalette: Palette = {
  dark: true,
  bg: '#1c1b22',
  chrome: '#24232b',
  surface: '#2b2a33',
  sunken: '#35343e',
  pressed: '#3a3944',
  text: '#f2f1f5',
  textSecondary: '#a9a8b3',
  separator: '#3a3944',
  border: '#42414d',
  tint: '#1565c0',
  tintText: '#5cb8f0',
  onTint: '#ffffff',
  danger: '#ff8a80',
  dangerFill: '#b3261e',
  backdrop: 'rgba(0,0,0,0.5)',
};

/** The palette for the current appearance (the app's theme setting overrides the system's). */
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? darkPalette : lightPalette;
}

/**
 * Builds a style sheet per appearance from a palette, created once each:
 * `const useStyles = makeStyles((c) => ({ title: { color: c.text } }))`, then `useStyles()` in the component.
 */
type StyleObject = Parameters<typeof StyleSheet.create>[0];

export function makeStyles<S extends StyleObject>(build: (c: Palette) => S & StyleObject) {
  let light: Readonly<S> | null = null;
  let dark: Readonly<S> | null = null;
  /** forceDark: always dark (incognito tabs), whatever the app's appearance. */
  return function useStyles(forceDark = false): Readonly<S> {
    const system = usePalette();
    const palette = forceDark ? darkPalette : system;
    return useMemo(() => {
      if (palette.dark) return (dark ??= StyleSheet.create(build(palette)));
      return (light ??= StyleSheet.create(build(palette)));
    }, [palette]);
  };
}

/**
 * A full-screen page's content on a tablet or a phone on its side: a readable column in the middle (680 pt, as the
 * legal and licence pages) instead of rows stretched across the screen. No effect on a phone held upright.
 */
export const readableColumn = { width: '100%', maxWidth: 680, alignSelf: 'center' } as const;
