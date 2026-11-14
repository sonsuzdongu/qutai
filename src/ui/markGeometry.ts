/**
 * The Qutai mark, in a 100×100 box: a rounded gradient square, a gradient Q and an orange orbit.
 * Plain data, so the in-app component and the script that renders the launcher icon draw the same thing.
 */
export const MARK = {
  corner: 23,
  background: {
    from: [0, 0],
    to: [100, 100],
    colors: ['#4c45e0', '#2a1f8f', '#0c0a30'],
    positions: [0, 0.48, 1],
  },
  /** Soft light spots over the background (radial, fading to transparent). */
  glows: [
    { center: [92, 6], radius: 58, color: '#c4b5fd', opacity: 0.55 },
    { center: [-6, 58], radius: 46, color: '#818cf8', opacity: 0.45 },
  ],
  /** The Q's bowl: an outer and an inner oval, filled even-odd. */
  bowl: {
    center: [50, 46],
    outer: [29, 30],
    inner: [17.5, 19],
  },
  /** The Q's tail, a tapered swoosh out of the bottom of the bowl. */
  tail: 'M 45 68.5 C 54 75 67 80 89 79.5 C 67 89 50 85.5 40 73.5 Z',
  letter: {
    from: [26, 18],
    to: [80, 84],
    colors: ['#ffffff', '#e6defe', '#a78bfa'],
    positions: [0, 0.55, 1],
  },
  orbit: {
    center: [50, 50],
    radii: [46, 13],
    rotation: -16,
    width: 2.6,
    colors: ['#ff6a2b', '#ffb24d', '#fff0c4'],
  },
} as const;
