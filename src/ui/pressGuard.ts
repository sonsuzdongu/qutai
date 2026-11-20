/**
 * One press at a time for a button whose action takes a while (saving, signing in, buying): while the promise an
 * action returned is pending, further presses are ignored, so a double tap cannot save the same thing twice
 * (design record UI-28). A press that returns nothing is never held. Pure, so it is tested without React.
 */
export type PressAction = () => void | Promise<unknown>;

export function createPressGuard(onBusyChange: (busy: boolean) => void = () => {}) {
  let pending = false;
  return {
    isBusy: () => pending,
    /** Runs the action unless one is still running; resolves when it settles (errors are the action's own). */
    press(action: PressAction): Promise<void> | void {
      if (pending) return;
      const result = action();
      if (!result || typeof (result as Promise<unknown>).then !== 'function') return;
      pending = true;
      onBusyChange(true);
      return Promise.resolve(result).then(
        () => {
          pending = false;
          onBusyChange(false);
        },
        (error: unknown) => {
          pending = false;
          onBusyChange(false);
          throw error;
        },
      );
    },
  };
}
