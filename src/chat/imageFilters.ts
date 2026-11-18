/**
 * Image filters for edit_image and the edit sheet: what was asked, the numbers, and the colour maths. Pure and
 * without dependencies (tested in Node: `npm run test:image`); src/device/filterRender.ts draws them with Skia.
 *
 * Filters apply after the geometry (crop, rotate, flip, resize), at the result's size, in this fixed order whatever
 * order they are named in:
 *   1. colour, as one 4×5 colour matrix on unpremultiplied colours (alpha untouched), its parts in this order:
 *      auto enhance → brightness → contrast → saturation → warmth → greyscale → sepia → invert.
 *      The parts are multiplied into one matrix, so values are clamped to 0–1 once, at the end (not between parts);
 *   2. detail: blur or sharpen (one or the other, not both);
 *   3. then, as before, transparency flattened onto the background for JPEG, encoding, and the size budget.
 *
 * Amounts (whole numbers; out-of-range values are clamped, with a note):
 *   brightness  -100…100, 0 = none: colours × (1 + v/100), so +25 is ×1.25 and -100 black;
 *   contrast    -100…100, 0 = none: (c − ½) × (1 + v/100) + ½, so -100 is flat grey;
 *   saturation  -100…100, 0 = none: the colour's distance from its grey × (1 + v/100), so -100 is greyscale;
 *   warmth      -100…100, 0 = none: red × (1 + 0.2·v/100) and blue × (1 − 0.2·v/100) (negative: cooler);
 *   sharpen     0…100, 0 = none: unsharp mask on a 3×3 neighbourhood, amount 2·v/100 (alpha kept as it is);
 *   blur        0…100, 0 = none: Gaussian, sigma v/100 × 2 % of the result's shorter side;
 *   greyscale, sepia, invert, auto: on or off.
 * Named without a number: brightness, contrast, saturation and warmth +25, sharpen 40, blur 20 ("a little");
 * about ±60 / 70 reads as "much".
 *
 * Auto enhance is a levels stretch, nothing more: on a copy at most 128 px across, the luminance (Rec. 709) of the
 * pixels at least half opaque is counted; the darkest 0.5 % and the brightest 0.5 % are set aside, and the range
 * between is stretched to 0–255 with the same gain and offset for red, green and blue (so hues stay). The gain is at
 * most 2 (a very flat picture is stretched around its middle); a picture already spanning 2–253, or with a range of
 * less than 8 levels, is left as it is.
 */

export type Filters = {
  greyscale: boolean;
  sepia: boolean;
  invert: boolean;
  auto: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpen: number;
  blur: number;
};

export type Adjustable = 'brightness' | 'contrast' | 'saturation' | 'warmth' | 'sharpen' | 'blur';
export type Toggle = 'greyscale' | 'sepia' | 'invert' | 'auto';

export const NO_FILTERS: Filters = {
  greyscale: false,
  sepia: false,
  invert: false,
  auto: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  sharpen: 0,
  blur: 0,
};

export const RANGES: Record<Adjustable, { min: number; max: number; named: number }> = {
  brightness: { min: -100, max: 100, named: 25 },
  contrast: { min: -100, max: 100, named: 25 },
  saturation: { min: -100, max: 100, named: 25 },
  warmth: { min: -100, max: 100, named: 25 },
  sharpen: { min: 0, max: 100, named: 40 },
  blur: { min: 0, max: 100, named: 20 },
};

export const ADJUSTABLE: Adjustable[] = ['brightness', 'contrast', 'saturation', 'warmth', 'sharpen', 'blur'];
export const TOGGLES: Toggle[] = ['greyscale', 'sepia', 'invert', 'auto'];

/** The colour parts in the order they apply (see the top of this file). */
export const COLOUR_ORDER = ['auto', 'brightness', 'contrast', 'saturation', 'warmth', 'greyscale', 'sepia', 'invert'] as const;

/** Rec. 709 luma weights, used for greyscale, saturation and auto enhance. */
export const LUMA = [0.2126, 0.7152, 0.0722] as const;
/** The usual sepia matrix (as CSS sepia(1)). */
const SEPIA = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
];
const WARMTH_SCALE = 0.2;
/** Unsharp amount at sharpen 100. */
export const SHARPEN_MAX = 2;
/** Blur sigma at blur 100, as a fraction of the shorter side. */
const BLUR_MAX_FRACTION = 0.02;

const ALIASES: Record<string, Toggle | Adjustable> = {
  greyscale: 'greyscale',
  grayscale: 'greyscale',
  grey: 'greyscale',
  gray: 'greyscale',
  bw: 'greyscale',
  'black and white': 'greyscale',
  'black-and-white': 'greyscale',
  monochrome: 'greyscale',
  sepia: 'sepia',
  invert: 'invert',
  negative: 'invert',
  auto: 'auto',
  'auto enhance': 'auto',
  'auto-enhance': 'auto',
  enhance: 'auto',
  brightness: 'brightness',
  bright: 'brightness',
  contrast: 'contrast',
  saturation: 'saturation',
  saturate: 'saturation',
  warmth: 'warmth',
  warm: 'warmth',
  temperature: 'warmth',
  sharpen: 'sharpen',
  sharp: 'sharpen',
  sharpness: 'sharpen',
  blur: 'blur',
};

const isToggle = (k: string): k is Toggle => (TOGGLES as string[]).includes(k);

export function isNeutral(f: Filters): boolean {
  return TOGGLES.every((k) => !f[k]) && ADJUSTABLE.every((k) => f[k] === 0);
}

/** A value of an adjustable filter kept in its range, whole. */
export function clampAmount(key: Adjustable, value: number): number {
  const { min, max } = RANGES[key];
  return Math.round(Math.min(max, Math.max(min, value)));
}

/**
 * Reads edit_image's `filters`: a string such as "greyscale, sharpen 30, brightness -20" (also "+20" and "=20"), an
 * object ({ greyscale: true, sharpen: 30 }) or a list of such strings. A string is the error to give back.
 */
export function parseFilters(value: unknown): { filters: Filters; notes: string[] } | string {
  const filters: Filters = { ...NO_FILTERS };
  const notes: string[] = [];
  const entries: [string, unknown][] = [];
  if (value === undefined || value === null || value === '') return { filters, notes };
  if (typeof value === 'string' || Array.isArray(value)) {
    const parts = (Array.isArray(value) ? value.map(String) : [value]).flatMap((s) => s.split(/[,;]+/));
    for (const raw of parts) {
      const part = raw.trim().toLowerCase();
      if (!part || part === 'none' || part === 'original') continue;
      const m = /^([a-z][a-z -]*?)\s*(?:[:=]\s*)?([+-]?\d+(?:\.\d+)?)?\s*%?$/.exec(part);
      if (!m) return `Could not read the filter "${raw.trim()}". ${FILTERS_HELP}`;
      entries.push([m[1].trim(), m[2] === undefined ? undefined : Number(m[2])]);
    }
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) entries.push([k.toLowerCase(), v]);
  } else {
    return `filters is a list such as "greyscale, sharpen 30". ${FILTERS_HELP}`;
  }
  for (const [name, amount] of entries) {
    const key = ALIASES[name];
    if (!key) return `Unknown filter "${name}". ${FILTERS_HELP}`;
    if (isToggle(key)) {
      if (amount === false || amount === 0) continue;
      if (typeof amount === 'number' && amount !== 1 && amount !== 100)
        notes.push(`${key} is on or off; the amount ${amount} was ignored.`);
      filters[key] = true;
      continue;
    }
    if (amount === false) continue;
    const n = amount === undefined || amount === true ? RANGES[key].named : Number(amount);
    if (!Number.isFinite(n)) return `${key} takes a number. ${FILTERS_HELP}`;
    const clamped = clampAmount(key, n);
    if (clamped !== Math.round(n)) notes.push(`${key} ${n} is outside ${RANGES[key].min}…${RANGES[key].max}; ${clamped} was used.`);
    filters[key] = clamped;
  }
  if (filters.sharpen && filters.blur)
    return 'Give either sharpen or blur, not both (one undoes the other).';
  return { filters, notes };
}

export const FILTERS_HELP =
  'Filters: greyscale, sepia, invert, auto, brightness/contrast/saturation/warmth -100…100, sharpen/blur 0…100.';

// --- Colour matrices: 4 rows (R, G, B, A) × 5 columns (r, g, b, a, offset), offsets in 0–1, as Skia takes them. ---

export type ColourMatrix = number[];

const IDENTITY: ColourMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** `outer` applied after `inner`, as one matrix. */
export function multiply(outer: ColourMatrix, inner: ColourMatrix): ColourMatrix {
  const out: number[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? outer[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += outer[r * 5 + k] * inner[k * 5 + c];
      out.push(v);
    }
  }
  return out;
}

/** Same scale and offset on red, green and blue; alpha untouched. */
const scaleOffset = (k: number, o: number): ColourMatrix => [k, 0, 0, 0, o, 0, k, 0, 0, o, 0, 0, k, 0, o, 0, 0, 0, 1, 0];

function saturationMatrix(k: number): ColourMatrix {
  const m: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) m.push((1 - k) * LUMA[c] + (r === c ? k : 0));
    m.push(0, 0);
  }
  return [...m, 0, 0, 0, 1, 0];
}

/** Gain and offset (0–1 units) of an auto enhance levels stretch. */
export type Levels = { gain: number; offset: number };

/**
 * The parts of the colour matrix, in order, each with its own matrix (for tests and the summary). `levels` is
 * auto enhance's measured stretch (none: auto does nothing).
 */
export function colourParts(f: Filters, levels?: Levels | null): { part: (typeof COLOUR_ORDER)[number]; matrix: ColourMatrix }[] {
  const parts: { part: (typeof COLOUR_ORDER)[number]; matrix: ColourMatrix }[] = [];
  if (f.auto && levels && (levels.gain !== 1 || levels.offset !== 0))
    parts.push({ part: 'auto', matrix: scaleOffset(levels.gain, levels.offset) });
  if (f.brightness) parts.push({ part: 'brightness', matrix: scaleOffset(1 + f.brightness / 100, 0) });
  if (f.contrast) {
    const k = 1 + f.contrast / 100;
    parts.push({ part: 'contrast', matrix: scaleOffset(k, 0.5 * (1 - k)) });
  }
  if (f.saturation) parts.push({ part: 'saturation', matrix: saturationMatrix(1 + f.saturation / 100) });
  if (f.warmth) {
    const w = (WARMTH_SCALE * f.warmth) / 100;
    parts.push({ part: 'warmth', matrix: [1 + w, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1 - w, 0, 0, 0, 0, 0, 1, 0] });
  }
  if (f.greyscale) parts.push({ part: 'greyscale', matrix: saturationMatrix(0) });
  if (f.sepia)
    parts.push({ part: 'sepia', matrix: [...SEPIA[0], 0, 0, ...SEPIA[1], 0, 0, ...SEPIA[2], 0, 0, 0, 0, 0, 1, 0] });
  if (f.invert) parts.push({ part: 'invert', matrix: [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0] });
  return parts;
}

/** The whole colour step as one matrix; null when it changes nothing. */
export function colourMatrix(f: Filters, levels?: Levels | null): ColourMatrix | null {
  const parts = colourParts(f, levels);
  if (!parts.length) return null;
  return parts.reduce((m, p) => multiply(p.matrix, m), IDENTITY);
}

/**
 * One unpremultiplied RGBA pixel (0–255) through a colour matrix, as Skia does it: computed in 0–1, clamped, then
 * rounded. The reference for the tests.
 */
export function applyMatrix(m: ColourMatrix, rgba: readonly number[]): number[] {
  const v = rgba.map((x) => x / 255);
  const out: number[] = [];
  for (let r = 0; r < 4; r++) {
    let s = m[r * 5 + 4];
    for (let k = 0; k < 4; k++) s += m[r * 5 + k] * v[k];
    out.push(Math.round(Math.min(1, Math.max(0, s)) * 255));
  }
  return out;
}

/**
 * Auto enhance's levels stretch from a luminance histogram (256 counts of pixels at least half opaque). Null when
 * the picture is left as it is (already full range, flat, or nothing counted). See the top of this file.
 */
export function autoLevels(histogram: readonly number[]): (Levels & { low: number; high: number }) | null {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const cut = total * 0.005;
  let low = 0;
  for (let seen = 0; low < 255 && seen + histogram[low] <= cut; low++) seen += histogram[low];
  let high = 255;
  for (let seen = 0; high > 0 && seen + histogram[high] <= cut; high--) seen += histogram[high];
  if (high - low < 8) return null;
  if (low <= 2 && high >= 253) return null;
  let gain = 255 / (high - low);
  let offset = -low / (high - low);
  if (gain > 2) {
    // Stretch by 2 around the middle of the range.
    gain = 2;
    const mid = (low + high) / 2 / 255;
    offset = 0.5 - mid * 2;
  }
  return { low, high, gain, offset };
}

/** Rec. 709 luminance (0–255) of an RGB pixel, rounded. */
export const luminance = (r: number, g: number, b: number) => Math.round(LUMA[0] * r + LUMA[1] * g + LUMA[2] * b);

/**
 * The sharpen kernel (3×3, row by row): (1 + a)·pixel − a·(a 1-2-1 Gaussian of its neighbourhood), a = 2·v/100.
 * It sums to 1, so flat areas stay as they are.
 */
export function sharpenKernel(sharpen: number): number[] {
  const a = (SHARPEN_MAX * sharpen) / 100;
  const g = [1, 2, 1, 2, 4, 2, 1, 2, 1].map((x) => x / 16);
  return g.map((x, i) => (i === 4 ? 1 + a : 0) - a * x);
}

/** The blur's sigma in pixels for a result of this size (0: none). */
export function blurSigma(blur: number, size: { width: number; height: number }): number {
  if (!blur) return 0;
  return (blur / 100) * BLUR_MAX_FRACTION * Math.min(size.width, size.height);
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** What the filters did, in English, for the model's result and the stored edit line. */
export function filterSteps(f: Filters, levels?: (Levels & { low: number; high: number }) | null): string[] {
  const steps: string[] = [];
  if (f.auto)
    steps.push(
      levels
        ? `auto enhance: tones ${levels.low}–${levels.high} stretched${levels.gain >= 2 ? ' (by 2× at most)' : ' to 0–255'}`
        : 'auto enhance: the tones already span the full range, nothing changed',
    );
  if (f.brightness) steps.push(`brightness ${signed(f.brightness)} (×${(1 + f.brightness / 100).toFixed(2)})`);
  if (f.contrast) steps.push(`contrast ${signed(f.contrast)}`);
  if (f.saturation) steps.push(`saturation ${signed(f.saturation)}`);
  if (f.warmth) steps.push(`${f.warmth > 0 ? 'warmer' : 'cooler'} (warmth ${signed(f.warmth)})`);
  if (f.greyscale) steps.push('greyscale');
  if (f.sepia) steps.push('sepia');
  if (f.invert) steps.push('inverted');
  if (f.blur) steps.push(`blurred (${f.blur})`);
  if (f.sharpen) steps.push(`sharpened (${f.sharpen})`);
  return steps;
}

/** Only what is set (for storing with an edited image). */
export function compactFilters(f: Filters): Partial<Filters> {
  const out: Partial<Filters> = {};
  for (const k of TOGGLES) if (f[k]) out[k] = true;
  for (const k of ADJUSTABLE) if (f[k]) out[k] = f[k];
  return out;
}

/** edit_image's `filters` argument for these filters ("greyscale, sharpen 40"); '' for none. */
export function filtersArgument(f: Filters): string {
  return [...TOGGLES.filter((k) => f[k]), ...ADJUSTABLE.filter((k) => f[k]).map((k) => `${k} ${f[k]}`)].join(', ');
}

/** One-tap presets of the edit sheet; each sets what it names and leaves the rest. */
export type FilterPreset = 'original' | 'greyscale' | 'sepia' | 'sharpen' | 'brighter' | 'contrast' | 'blur' | 'auto';
export const FILTER_PRESETS: FilterPreset[] = ['original', 'auto', 'greyscale', 'sepia', 'sharpen', 'brighter', 'contrast', 'blur'];

const PRESET_CHANGE: Record<Exclude<FilterPreset, 'original'>, Partial<Filters>> = {
  auto: { auto: true },
  greyscale: { greyscale: true, sepia: false },
  sepia: { sepia: true, greyscale: false },
  sharpen: { sharpen: RANGES.sharpen.named, blur: 0 },
  brighter: { brightness: RANGES.brightness.named },
  contrast: { contrast: RANGES.contrast.named },
  blur: { blur: RANGES.blur.named, sharpen: 0 },
};

/** Whether a preset is what the filters now have (its chip shows as chosen). */
export function presetActive(f: Filters, preset: FilterPreset): boolean {
  if (preset === 'original') return isNeutral(f);
  return Object.entries(PRESET_CHANGE[preset]).every(([k, v]) => !v || f[k as keyof Filters] === v);
}

/** Tapping a preset: Original clears everything; another turns its change on, or off again when it is on. */
export function togglePreset(f: Filters, preset: FilterPreset): Filters {
  if (preset === 'original') return { ...NO_FILTERS };
  const change = PRESET_CHANGE[preset];
  if (presetActive(f, preset)) {
    const off = { ...f };
    for (const [k, v] of Object.entries(change)) if (v) (off as Record<string, unknown>)[k] = NO_FILTERS[k as keyof Filters];
    return off;
  }
  return { ...f, ...change };
}

/** A slider's next value for a screen reader's increment/decrement: steps of 5 (sharpen and blur too), clamped. */
export function stepAmount(key: Adjustable, value: number, direction: 1 | -1): number {
  return clampAmount(key, Math.round(value / 5) * 5 + direction * 5);
}
