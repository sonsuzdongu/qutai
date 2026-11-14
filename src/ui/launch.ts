import * as SplashScreen from 'expo-splash-screen';

/**
 * The native splash screen: a plain colour, the theme's screen background in the system's light or dark appearance
 * (app.json, expo-splash-screen with no image; on Android 12+ the icon the system always draws is a transparent
 * drawable). It stays until the first real frame is ready (settings and session read), at most SPLASH_MAX_MS after
 * JavaScript starts, so a slow database never leaves the user looking at it; then it fades out over SPLASH_FADE_MS
 * (on Android the fade is the system splash view's own exit animation, on iOS a cross-dissolve).
 */
export const SPLASH_FADE_MS = 200;
const SPLASH_MAX_MS = 1200;

let hidden = false;
const listeners = new Set<() => void>();

/** Called once at startup, in module scope (inside a component it could run after the splash already hid). */
export function holdSplash(): void {
  SplashScreen.setOptions({ duration: SPLASH_FADE_MS, fade: true });
  SplashScreen.preventAutoHideAsync().catch(() => {});
  setTimeout(hideSplash, SPLASH_MAX_MS);
}

/** Fades the native splash out; later calls do nothing. */
export function hideSplash(): void {
  if (hidden) return;
  hidden = true;
  try {
    SplashScreen.hide();
  } catch {
    // A build without the module: there is no splash to hide.
  }
  listeners.forEach((listener) => listener());
  listeners.clear();
}

/** Runs `listener` once the splash has started hiding (right away if it already has). */
export function onSplashHidden(listener: () => void): () => void {
  if (hidden) {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}
