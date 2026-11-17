/**
 * TRIAL: the looks of the two assistant moments (listening while the Q button is held, working on the page), chosen
 * in Settings › Assistant so they can be compared on a real phone. One of them becomes the only look before launch
 * and this choice goes away.
 *
 *   classic  today's: a dark bubble next to the button, the aurora glow around the screen, a plain strip
 *   band     frosted glass: a glass sheet rises from the address bar's edge with the words in it; a glass strip
 *            with a thread of light around it while working (system blur on iOS, a milky tint on Android)
 *   curtain  light, no blur anywhere: the page dims from the bar's edge and northern-lights rays rise with the
 *            voice, the words large on the dark; while working a line of light travels around the screen's edge
 */
export const ASSISTANT_LOOKS = ['classic', 'band', 'curtain'] as const;
export type AssistantLook = (typeof ASSISTANT_LOOKS)[number];

/** Shown in Settings as they are: a trial switch only the owner uses, so in Turkish and not in the translations. */
export const ASSISTANT_LOOK_TITLE = 'Asistan görünümü (deneme)';
export const ASSISTANT_LOOK_LABELS: Record<AssistantLook, string> = {
  classic: 'Klasik',
  band: 'Cam',
  curtain: 'Işık',
};
