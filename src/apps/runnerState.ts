import type { PreviewReport } from '../agent/appTool';

/**
 * Which app the runner shows (one at a time). Opening is always a user action or the assistant's preview; a preview
 * resolves once the app settled (docs/mini-apps.md › How the assistant builds an app).
 */
export type RunnerRequest = {
  appId: string;
  /** Bumped on every open, so opening the same app again (a new version) rebuilds it. */
  serial: number;
  preview?: (report: PreviewReport) => void;
};

let current: RunnerRequest | null = null;
let serial = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const appRunner = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  current: () => current,
  open(appId: string) {
    current?.preview?.({ loaded: false, diagnostics: [], notes: [], dropped: 0 });
    current = { appId, serial: ++serial };
    emit();
  },
  preview(appId: string): Promise<PreviewReport> {
    return new Promise((resolve) => {
      current?.preview?.({ loaded: false, diagnostics: [], notes: [], dropped: 0 });
      current = { appId, serial: ++serial, preview: resolve };
      emit();
    });
  },
  /** The preview finished: its report goes back once, the app stays open. */
  settle(request: RunnerRequest, report: PreviewReport) {
    if (!request.preview) return;
    const resolve = request.preview;
    request.preview = undefined;
    resolve(report);
  },
  close() {
    current?.preview?.({ loaded: false, diagnostics: [], notes: [], dropped: 0 });
    current = null;
    emit();
  },
};
