import { useMemo } from 'react';
import { StyleSheet, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

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
 * Corner radii of everything that opens inside Qutai and of its buttons (design record UI-27): change a value here and
 * every window, card and button of that kind follows. Bigger surfaces stay rounder than what sits on them. Things round
 * on purpose (circular icon buttons, avatars, the Qutai button, switches, radios, progress lines, dots, chips) keep
 * `size / 2` and do not use these; nor do web content, page pictures and tab thumbnails.
 */
export const radii = {
  /** The assistant's glass sheet and the working strip over the page (was 26). */
  sheet: 18,
  /** Windows: dialogs, bottom sheets, the side panel, the answer card over the page, floating bars, toasts (was 16 to 22). */
  window: 14,
  /** Menus, the address bar's suggestion list, chat bubbles and the voice bubble (was 14 to 18). */
  popover: 12,
  /** Cards and grouped lists inside a window or a screen (was 14 to 16). */
  card: 12,
  /** Main text buttons that were capsules, 40 to 52 pt tall (was 20 to 26). */
  button: 14,
  /** Smaller buttons and controls: secondary buttons, inputs, notices, segmented controls, menu icon buttons (was 10 to 12). */
  control: 8,
  /** What sits inside a control: a segment's selected part (3 pt in from an 8 pt corner), a checkbox (was 6 to 8). */
  inner: 5,
} as const;

/**
 * Style pieces several screens repeat, so a change to how a card, a notice, a text field or a segmented control looks is
 * one edit here. Spread one into a style and override what that screen does differently:
 * `notice: { ...common(c).notice, marginTop: 8 }`. Values are the ones most screens used before (design record UI-27).
 */
export function common(c: Palette) {
  const card: ViewStyle = { backgroundColor: c.surface, borderRadius: radii.card };
  /** A grey box with a short message in it (the text style is on the box itself). */
  const notice: TextStyle = {
    fontSize: 14,
    lineHeight: 19,
    color: c.text,
    backgroundColor: c.sunken,
    borderRadius: radii.control,
    padding: 12,
  };
  /** A grey box holding an icon beside its text. */
  const noticeRow: ViewStyle = {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: c.sunken,
    borderRadius: radii.control,
    padding: 12,
  };
  /** A one-line text field; it grows with large text sizes instead of clipping the text. */
  const input: TextStyle = {
    color: c.text,
    minHeight: 44,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 15,
  };
  const segment: ViewStyle = { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: radii.control, padding: 3 };
  const segmentButton: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radii.inner,
  };
  const segmentSelected: ViewStyle = { backgroundColor: c.surface };
  const segmentText: TextStyle = { fontSize: 14, color: c.textSecondary };
  const segmentTextSelected: TextStyle = { color: c.text, fontWeight: '700' };
  const checkbox: ViewStyle = {
    width: 24,
    height: 24,
    borderRadius: radii.inner,
    borderWidth: 2,
    borderColor: c.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return { card, notice, noticeRow, input, segment, segmentButton, segmentSelected, segmentText, segmentTextSelected, checkbox };
}

/**
 * A full-screen page's content on a tablet or a phone on its side: a readable column in the middle (680 pt, as the
 * legal and licence pages) instead of rows stretched across the screen. No effect on a phone held upright.
 */
export const readableColumn = { width: '100%', maxWidth: 680, alignSelf: 'center' } as const;
