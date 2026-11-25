import type { StripDevice } from '../ui/tabStrip';

/**
 * What "Open" on a finished download tries on iOS, in order, until one works (DL-19):
 * - `app`: hand the file to the app the system picks for its type (a Mac's default app, as Finder would);
 * - `preview`: Quick Look inside Qutai (only when Quick Look can show the type);
 * - `share`: the share sheet (an iPhone's only way, and everyone's last resort).
 * A Mac opens the file in its own app first; an iPad previews it; an iPhone keeps the share sheet.
 */
export type OpenStep = 'app' | 'preview' | 'share';

export function openSteps(device: StripDevice, canPreview: boolean): OpenStep[] {
  if (device === 'mac') return canPreview ? ['app', 'preview', 'share'] : ['app', 'share'];
  if (device === 'tablet') return canPreview ? ['preview', 'share'] : ['share'];
  return ['share'];
}

/** "Save…" (the system's export picker, to the Mac's Downloads or any folder) is offered on a Mac only. */
export function offersSaveCopy(device: StripDevice): boolean {
  return device === 'mac';
}
