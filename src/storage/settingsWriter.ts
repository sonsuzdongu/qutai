import type { Settings, SettingsPatch } from './settings';

/**
 * Applies settings changes as patches on the settings as they are now, never on a copy from an earlier render
 * (DATA-28): a switch flipped while a dialog awaited Face ID, or a change by the assistant's settings tool, is kept.
 * Writes go one after another, each with the latest settings, so an older write never lands last.
 */
export class SettingsWriter {
  private writes: Promise<void> = Promise.resolve();

  constructor(
    /** The settings as they are now. */
    private read: () => Settings,
    /** Makes these the settings now (the screen's state and its live reference). */
    private apply: (next: Settings) => void,
    private save: (settings: Settings) => Promise<void>,
    private failed: (error: unknown) => void,
  ) {}

  change(patch: SettingsPatch): Promise<void> {
    const current = this.read();
    this.apply({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
    const write = this.writes.then(() => this.save(this.read()).catch(this.failed));
    this.writes = write;
    return write;
  }
}
