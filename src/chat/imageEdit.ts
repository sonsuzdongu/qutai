/**
 * Image edits (edit_image, and the "Resize or crop" sheet): what was asked, the geometry, and the search for a file
 * size under a byte budget. Pure and without dependencies, so it can be exercised outside the app; the pixels are
 * handled by src/device/imageEdit.ts.
 *
 * Operations always apply in this order, whatever order the request names them in:
 *   1. crop: an explicit rectangle in source pixels, or the largest rectangle of an aspect ratio, placed by gravity
 *      (centre, top, bottom, left, right) or centred on a focus point;
 *   2. rotate clockwise by quarter turns, then flip;
 *   3. resize: fit within a box, cover a box exactly (cropping the overflow like step 1), stretch to exact
 *      dimensions, or set one side and keep the aspect ratio; never enlarged unless allowUpscale;
 *   4. flatten transparency onto the background colour when the output is JPEG;
 *   5. encode (JPEG, PNG or WebP at a quality);
 *   6. meet maxBytes: lower the quality (JPEG, WebP), then scale down in steps.
 *
 * Coordinates: the source is the image as it is displayed (orientation applied), in its own pixels; crop rectangles,
 * gravity and focus refer to it before rotation. An aspect ratio, a box and output dimensions refer to the result,
 * after rotation (a 90° turn of a 4:3 crop is a 3:4 picture).
 *
 * Rounding: every rectangle and every output size is in whole pixels. An aspect crop keeps one full side of the area
 * it is cut from and rounds the other to the nearest pixel (so 1:1 is exactly square); its offset is the floor of
 * half the spare pixels for centre, 0 or all of them for an edge, and the focus point minus half the crop, rounded and
 * clamped inside the area. The cropped area is always drawn to fill the whole output, so no edge strip is ever empty.
 */

export type Gravity = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type FitMode = 'fit' | 'cover' | 'exact';
export type OutputFormat = 'jpeg' | 'png' | 'webp';
export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

export type EditRequest = {
  crop?: Rect;
  /** Width over height of the result. */
  aspect?: number;
  /** As written ("16:9"), for the report. */
  aspectLabel?: string;
  gravity: Gravity;
  /** Fractions (0–1) of the source's width and height. */
  focus?: { x: number; y: number };
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  width?: number;
  height?: number;
  fit: FitMode;
  allowUpscale: boolean;
  /** Absent: the source's format where it is one of the three, otherwise JPEG. */
  format?: OutputFormat;
  /** 1–100. */
  quality: number;
  /** CSS hex colour under transparent pixels in a JPEG. */
  background: string;
  maxBytes?: number;
};

export type EditPlan = {
  /** The part of the source that ends up in the result, in source pixels. */
  region: Rect;
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  /** The result's size before any scaling for maxBytes. */
  out: Size;
  /** What was done, in order, for the model and the card. */
  steps: string[];
  /** Things the model should know (not enlarged, stretched, clamped). */
  notes: string[];
};

/** Larger results are refused: about 64 MB of pixels while drawing, and far beyond what forms take. */
export const MAX_OUTPUT_PIXELS = 4096 * 4096;
/** The whole picture is decoded on the phone at most this large (a 48 MP photo fits; 200 MP ones are decoded smaller). */
export const MAX_DECODE_PIXELS = 50_000_000;
/** The cropped, rotated piece handed to the drawing step is at most this large. */
export const MAX_INTERMEDIATE_PIXELS = 24_000_000;
/** JPEG and WebP quality is never lowered below this to meet maxBytes; the image is made smaller instead. */
export const MIN_BUDGET_QUALITY = 40;
export const DEFAULT_QUALITY = 90;
/** A size budget is never met by going below this many pixels on the longest side. */
export const MIN_BUDGET_EDGE = 32;
/** Bytes, the smallest maxBytes taken: below this nothing useful fits. */
export const MIN_MAX_BYTES = 2048;

const GRAVITIES: Gravity[] = ['center', 'top', 'bottom', 'left', 'right'];
const COLOR_NAMES: Record<string, string> = { white: '#ffffff', black: '#000000' };

export const FORMAT_MIME: Record<OutputFormat, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
export const FORMAT_EXT: Record<OutputFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const FORMAT_LABEL: Record<OutputFormat, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };

export const formatLabel = (f: OutputFormat) => FORMAT_LABEL[f];

/** "JPEG", "PNG", "WebP", "HEIC" for a MIME type, for cards and dialogs. */
export function imageFormatLabel(mimeType: string): string {
  const known = (Object.keys(FORMAT_MIME) as OutputFormat[]).find((f) => FORMAT_MIME[f] === mimeType);
  return known ? FORMAT_LABEL[known] : mimeType.replace(/^image\//, '').toUpperCase();
}

/** The output format for a source when none is asked for. */
export function defaultFormat(mimeType: string): OutputFormat {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpeg';
}

/** Whether a file of this type can hold transparent pixels (then it is decoded and kept with alpha). */
export function mayHaveAlpha(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/gif';
}

/** "16:9", "4/3", "1.91:1", "1.5" → width over height. */
export function parseAspect(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 && Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:[:/x×]\s*(\d+(?:\.\d+)?))?\s*$/i.exec(value);
  if (!m) return null;
  const w = Number(m[1]);
  const h = m[2] === undefined ? 1 : Number(m[2]);
  return w > 0 && h > 0 ? w / h : null;
}

function int(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

function fraction(value: unknown): number | null | 'bad' {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : 'bad';
}

/** Reads edit_image's arguments; a string is the error to give back. */
export function parseEditRequest(input: Record<string, unknown>): EditRequest | string {
  const req: EditRequest = {
    gravity: 'center',
    rotate: 0,
    flipH: false,
    flipV: false,
    fit: 'fit',
    allowUpscale: input.allow_upscale === true,
    quality: DEFAULT_QUALITY,
    background: '#ffffff',
  };

  const cx = int(input.crop_x);
  const cy = int(input.crop_y);
  const cw = int(input.crop_width);
  const ch = int(input.crop_height);
  const cropGiven = [cx, cy, cw, ch].some((v) => v !== null);
  if (cropGiven) {
    if ([cx, cy, cw, ch].some((v) => v === null || Number.isNaN(v)))
      return 'An explicit crop needs all four of crop_x, crop_y, crop_width and crop_height, in source pixels.';
    if (cw! < 1 || ch! < 1) return 'crop_width and crop_height must be at least 1.';
    req.crop = { x: cx!, y: cy!, width: cw!, height: ch! };
  }

  if (input.aspect !== undefined && input.aspect !== null && input.aspect !== '') {
    const aspect = parseAspect(input.aspect);
    if (!aspect || aspect > 100 || aspect < 0.01) return 'aspect must be a ratio such as "1:1", "4:3", "16:9" or "3:2".';
    if (req.crop) return 'Give either an explicit crop (crop_x…crop_height) or aspect, not both.';
    req.aspect = aspect;
    req.aspectLabel = String(input.aspect).trim();
  }

  if (input.gravity !== undefined && input.gravity !== null && input.gravity !== '') {
    const g = String(input.gravity).toLowerCase().replace('centre', 'center') as Gravity;
    if (!GRAVITIES.includes(g)) return 'gravity must be one of center, top, bottom, left, right.';
    req.gravity = g;
  }
  const fx = fraction(input.focus_x);
  const fy = fraction(input.focus_y);
  if (fx === 'bad' || fy === 'bad') return 'focus_x and focus_y are fractions of the image from 0 to 1 (0.5 is the middle).';
  if ((fx === null) !== (fy === null)) return 'Give both focus_x and focus_y, or neither.';
  if (fx !== null && fy !== null) req.focus = { x: fx, y: fy };

  if (input.rotate !== undefined && input.rotate !== null && input.rotate !== '') {
    const r = ((Math.round(Number(input.rotate)) % 360) + 360) % 360;
    if (![0, 90, 180, 270].includes(r)) return 'rotate takes 90, 180 or 270 (degrees clockwise; -90 is 270).';
    req.rotate = r as EditRequest['rotate'];
  }
  if (input.flip !== undefined && input.flip !== null && input.flip !== '' && input.flip !== 'none') {
    const f = String(input.flip).toLowerCase();
    if (f !== 'horizontal' && f !== 'vertical' && f !== 'both') return 'flip takes horizontal, vertical or both.';
    req.flipH = f !== 'vertical';
    req.flipV = f !== 'horizontal';
  }

  const w = int(input.width);
  const h = int(input.height);
  if (Number.isNaN(w) || Number.isNaN(h) || (w !== null && w < 1) || (h !== null && h < 1))
    return 'width and height are whole numbers of pixels, at least 1.';
  if (w !== null) req.width = w;
  if (h !== null) req.height = h;
  if (input.fit !== undefined && input.fit !== null && input.fit !== '') {
    const f = String(input.fit).toLowerCase() as FitMode;
    if (!['fit', 'cover', 'exact'].includes(f)) return 'fit takes fit, cover or exact.';
    if (w === null || h === null) return `fit="${f}" needs both width and height.`;
    req.fit = f;
  }

  if (input.format !== undefined && input.format !== null && input.format !== '') {
    const f = String(input.format).toLowerCase().replace('jpg', 'jpeg') as OutputFormat;
    if (!(f in FORMAT_MIME)) return 'format takes jpeg, png or webp.';
    req.format = f;
  }
  if (input.quality !== undefined && input.quality !== null && input.quality !== '') {
    const q = Number(input.quality);
    if (!Number.isFinite(q) || q < 1 || q > 100) return 'quality is 1–100 (JPEG and WebP; PNG ignores it).';
    req.quality = Math.round(q);
  }
  if (input.background !== undefined && input.background !== null && input.background !== '') {
    const raw = String(input.background).trim().toLowerCase();
    const color = COLOR_NAMES[raw] ?? raw;
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(color)) return 'background is a hex colour such as "#ffffff".';
    req.background = color;
  }
  if (input.max_bytes !== undefined && input.max_bytes !== null && input.max_bytes !== '') {
    const b = Math.floor(Number(input.max_bytes));
    if (!Number.isFinite(b) || b < MIN_MAX_BYTES) return `max_bytes is a number of bytes, at least ${MIN_MAX_BYTES}.`;
    req.maxBytes = b;
  }
  return req;
}

/** Whether the request changes anything at all besides re-encoding. */
export function changesPixels(req: EditRequest): boolean {
  return !!(req.crop || req.aspect || req.rotate || req.flipH || req.flipV || req.width || req.height);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Where a crop of `size` starts inside [start, start + length): by gravity (0, 0.5, 1) or around a focus point. */
function place(start: number, length: number, size: number, anchor: number, focus?: number): number {
  const spare = length - size;
  if (spare <= 0) return start;
  if (focus !== undefined) return start + clamp(Math.round(focus - start - size / 2), 0, spare);
  if (anchor === 0) return start;
  if (anchor === 1) return start + spare;
  return start + Math.floor(spare / 2);
}

/**
 * The largest rectangle of `ratio` (width over height) inside `area`, in whole pixels: one full side of the area,
 * the other rounded to the nearest pixel, placed by gravity or centred on the focus point (source pixels).
 */
export function aspectCrop(
  area: Rect,
  ratio: number,
  gravity: Gravity,
  focus?: { x: number; y: number },
): Rect {
  let width: number;
  let height: number;
  if (area.width / area.height > ratio) {
    height = area.height;
    width = clamp(Math.round(area.height * ratio), 1, area.width);
  } else {
    width = area.width;
    height = clamp(Math.round(area.width / ratio), 1, area.height);
  }
  const ax = gravity === 'left' ? 0 : gravity === 'right' ? 1 : 0.5;
  const ay = gravity === 'top' ? 0 : gravity === 'bottom' ? 1 : 0.5;
  return {
    x: place(area.x, area.width, width, ax, focus?.x),
    y: place(area.y, area.height, height, ay, focus?.y),
    width,
    height,
  };
}

const dims = (s: Size) => `${s.width}×${s.height}`;
const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

function where(req: EditRequest): string {
  if (req.focus) return `centred on (${req.focus.x}, ${req.focus.y})`;
  return req.gravity === 'center' ? 'centre' : `keeping the ${req.gravity}`;
}

/**
 * The geometry of an edit for a source of `source` pixels (as displayed), or an error to give back.
 * The output size is what the request asks for; maxBytes may make it smaller later (fitToBudget).
 */
export function planEdit(req: EditRequest, source: Size): EditPlan | string {
  if (!(source.width >= 1 && source.height >= 1)) return 'The size of this image is unknown, so it cannot be edited.';
  const full: Rect = { x: 0, y: 0, width: source.width, height: source.height };
  const steps: string[] = [];
  const notes: string[] = [];
  const focus = req.focus ? { x: req.focus.x * source.width, y: req.focus.y * source.height } : undefined;
  const quarter = req.rotate === 90 || req.rotate === 270;
  // A ratio of the result, turned into one of the source when a quarter turn follows.
  const sourceRatio = (r: number) => (quarter ? 1 / r : r);

  let region = full;
  if (req.crop) {
    const x0 = clamp(req.crop.x, 0, source.width);
    const y0 = clamp(req.crop.y, 0, source.height);
    const x1 = clamp(req.crop.x + req.crop.width, 0, source.width);
    const y1 = clamp(req.crop.y + req.crop.height, 0, source.height);
    if (x1 - x0 < 1 || y1 - y0 < 1)
      return `The crop rectangle lies outside the image, which is ${dims(source)} pixels (x 0–${source.width}, y 0–${source.height}).`;
    region = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    if (!sameRect(region, req.crop)) notes.push(`The crop rectangle went past the image's edge; it was cut to ${region.width}×${region.height} at (${region.x}, ${region.y}).`);
    steps.push(`cropped to ${region.width}×${region.height} at (${region.x}, ${region.y})`);
  } else if (req.aspect) {
    region = aspectCrop(full, sourceRatio(req.aspect), req.gravity, focus);
    steps.push(
      sameRect(region, full)
        ? `already ${req.aspectLabel ?? 'that shape'}, nothing cropped`
        : `cropped to ${req.aspectLabel ?? 'the ratio'}: ${region.width}×${region.height} at (${region.x}, ${region.y}), ${where(req)}`,
    );
  }

  if (req.rotate) steps.push(`rotated ${req.rotate}° clockwise`);
  if (req.flipH || req.flipV) steps.push(`flipped ${req.flipH && req.flipV ? 'both ways' : req.flipH ? 'horizontally' : 'vertically'}`);

  const turned = (r: Rect): Size => (quarter ? { width: r.height, height: r.width } : { width: r.width, height: r.height });
  let size = turned(region);
  let out: Size = size;
  const W = req.width;
  const H = req.height;
  if (W && H && req.fit === 'cover') {
    const covered = aspectCrop(region, sourceRatio(W / H), req.gravity, focus);
    if (!sameRect(covered, region)) {
      steps.push(`cropped to ${W}:${H} for cover: ${covered.width}×${covered.height} at (${covered.x}, ${covered.y}), ${where(req)}`);
      region = covered;
      size = turned(region);
    }
    if ((W > size.width || H > size.height) && !req.allowUpscale) {
      out = size;
      notes.push(
        `The picture (${dims(size)} after cropping) is smaller than ${W}×${H} and was not enlarged, so the result is ` +
          `${dims(out)}. If the form needs exactly ${W}×${H}, call again with allow_upscale: true (it will look softer).`,
      );
    } else {
      out = { width: W, height: H };
    }
  } else if (W && H && req.fit === 'exact') {
    out = { width: W, height: H };
    if ((W > size.width || H > size.height) && !req.allowUpscale) {
      const f = Math.min(1, size.width / W, size.height / H);
      out = { width: Math.max(1, Math.floor(W * f)), height: Math.max(1, Math.floor(H * f)) };
      notes.push(
        `The picture (${dims(size)}) is smaller than ${W}×${H} and was not enlarged; the result is ${dims(out)}. ` +
          'Call again with allow_upscale: true to enlarge it.',
      );
    }
    const from = size.width / size.height;
    const to = out.width / out.height;
    if (Math.abs(to / from - 1) > 0.01)
      notes.push(`The aspect ratio changes from ${from.toFixed(3)} to ${to.toFixed(3)}, so the picture is stretched. Use fit "cover" to crop instead.`);
  } else if (W && H) {
    let s = Math.min(W / size.width, H / size.height);
    if (s > 1 && !req.allowUpscale) {
      s = 1;
      notes.push(`It already fits within ${W}×${H}; it was not enlarged.`);
    }
    out = {
      width: clamp(Math.round(size.width * s), 1, Math.max(W, size.width)),
      height: clamp(Math.round(size.height * s), 1, Math.max(H, size.height)),
    };
    if (s < 1) out = { width: Math.min(out.width, W), height: Math.min(out.height, H) };
  } else if (W || H) {
    let s = W ? W / size.width : H! / size.height;
    if (s > 1 && !req.allowUpscale) {
      s = 1;
      notes.push(`It is already ${dims(size)}, smaller than asked; it was not enlarged.`);
    }
    out = W && s !== 1
      ? { width: W, height: Math.max(1, Math.round(size.height * s)) }
      : H && s !== 1
        ? { width: Math.max(1, Math.round(size.width * s)), height: H }
        : size;
  }
  if (out.width !== size.width || out.height !== size.height) {
    const mode = W && H ? req.fit : 'keeping the aspect ratio';
    steps.push(`resized from ${dims(size)} to ${dims(out)} (${mode}${out.width > size.width ? ', enlarged' : ''})`);
  }
  if (out.width * out.height > MAX_OUTPUT_PIXELS) {
    return (
      `The result would be ${dims(out)} (${Math.round((out.width * out.height) / 1e6)} MP); at most ` +
      `${Math.round(MAX_OUTPUT_PIXELS / 1e6)} MP can be made on the phone. Give a smaller width and height.`
    );
  }
  return { region, rotate: req.rotate, flipH: req.flipH, flipV: req.flipV, out, steps, notes };
}

/**
 * How much of the source's resolution to decode: `scale` of its size (1: full). Enough that the drawing step only
 * reduces by up to 2× more (where its filter is sharp and free of aliasing), and within the memory limits; an error
 * when the result needs more detail than the phone can decode.
 */
export function decodeScale(plan: EditPlan, source: Size): { scale: number } | string {
  const quarter = plan.rotate === 90 || plan.rotate === 270;
  const regionOut = quarter
    ? { width: plan.region.height, height: plan.region.width }
    : { width: plan.region.width, height: plan.region.height };
  // The scale of the source the result needs (above 1 when enlarging).
  const needed = Math.max(plan.out.width / regionOut.width, plan.out.height / regionOut.height);
  let scale = Math.min(1, needed * 2);
  const regionPixels = plan.region.width * plan.region.height;
  scale = Math.min(scale, Math.sqrt(MAX_INTERMEDIATE_PIXELS / regionPixels));
  scale = Math.min(scale, Math.sqrt(MAX_DECODE_PIXELS / (source.width * source.height)));
  const enough = Math.min(1, needed);
  if (scale < enough * 0.999) {
    const most = {
      width: Math.max(1, Math.floor(regionOut.width * scale)),
      height: Math.max(1, Math.floor(regionOut.height * scale)),
    };
    return (
      `The photo is too large (${dims(source)}) to keep that much detail from this part of it on the phone. ` +
      `The most this crop can give is about ${dims(most)}: crop a larger area or ask for a smaller size.`
    );
  }
  return { scale: Math.min(1, Math.max(scale, enough)) };
}

/**
 * Maps a rectangle in source pixels to an image decoded at another size, rounding each edge (not the size) to the
 * nearest pixel, so neighbouring rectangles still meet and the whole source maps to the whole decoded image.
 */
export function mapRect(r: Rect, source: Size, decoded: Size): Rect {
  const sx = decoded.width / source.width;
  const sy = decoded.height / source.height;
  const x0 = clamp(Math.round(r.x * sx), 0, decoded.width - 1);
  const y0 = clamp(Math.round(r.y * sy), 0, decoded.height - 1);
  const x1 = clamp(Math.round((r.x + r.width) * sx), x0 + 1, decoded.width);
  const y1 = clamp(Math.round((r.y + r.height) * sy), y0 + 1, decoded.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The size after scaling `size` by `factor`, aspect kept, whole pixels, at least 1×1. */
export function scaleSize(size: Size, factor: number): Size {
  const width = Math.max(1, Math.floor(size.width * factor));
  return { width, height: Math.max(1, Math.round((width * size.height) / size.width)) };
}

export type Encoded = { bytes: number };

export type BudgetResult<T extends Encoded> = {
  result: T;
  quality: number;
  size: Size;
  /** The quality had to be lowered. */
  qualityLowered: boolean;
  /** The picture had to be made smaller. */
  scaled: boolean;
  encodes: number;
};

/**
 * Meets a size budget: the requested quality if it fits; otherwise the highest quality from MIN_BUDGET_QUALITY up
 * that fits (binary search to within 2 points); otherwise smaller and smaller sizes (each step aimed at the budget
 * from the last size, between 50 % and 90 % of it) with the same search at each. Formats without a quality (PNG)
 * only get smaller. `encode` makes the file and reports its size; the chosen one is returned.
 * Without maxBytes it encodes once.
 */
export async function fitToBudget<T extends Encoded>(
  options: { maxBytes?: number; quality: number; lossy: boolean; size: Size; maxEncodes?: number },
  encode: (quality: number, size: Size) => Promise<T>,
): Promise<BudgetResult<T> | string> {
  const { maxBytes, lossy } = options;
  const limit = options.maxEncodes ?? 30;
  let encodes = 0;
  const run = async (q: number, s: Size) => {
    encodes++;
    return encode(q, s);
  };
  const start = options.quality;
  let size = options.size;
  let first = await run(start, size);
  if (!maxBytes || first.bytes <= maxBytes)
    return { result: first, quality: start, size, qualityLowered: false, scaled: false, encodes };

  const floor = Math.min(start, MIN_BUDGET_QUALITY);
  for (let step = 0; ; step++) {
    if (step > 0) {
      // A smaller size, at the starting quality first.
      first = await run(start, size);
      if (first.bytes <= maxBytes)
        return { result: first, quality: start, size, qualityLowered: false, scaled: true, encodes };
    }
    let largest = first;
    if (lossy && start > floor) {
      const low = await run(floor, size);
      largest = low;
      if (low.bytes <= maxBytes) {
        let lo = floor;
        let hi = start;
        let best = low;
        while (hi - lo > 2 && encodes < limit) {
          const mid = Math.floor((lo + hi) / 2);
          const r = await run(mid, size);
          if (r.bytes <= maxBytes) {
            lo = mid;
            best = r;
          } else hi = mid;
        }
        return { result: best, quality: lo, size, qualityLowered: true, scaled: step > 0, encodes };
      }
    }
    if (encodes >= limit) break;
    const factor = clamp(Math.sqrt(maxBytes / largest.bytes) * 0.95, 0.5, 0.9);
    const next = scaleSize(size, factor);
    if (Math.max(next.width, next.height) < MIN_BUDGET_EDGE) break;
    size = next;
  }
  return (
    `Could not get the image under ${maxBytes} bytes: even at ${dims(size)}${lossy ? ` and quality ${floor}` : ''} it ` +
    `is larger. ${lossy ? '' : 'Try format "jpeg" or "webp", which can be compressed further, or '}Ask for a smaller size.`
  );
}

/** "1.2 MB", "412 KB", "980 bytes" (decimal units, as forms state them). */
export function bytesLabel(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} MB`;
  if (n >= 1000) return `${Math.round(n / 1000)} KB`;
  return `${n} bytes`;
}

/** A file name for the result: the source's name without its extension (and an earlier size suffix), the size, the format. */
export function editedName(sourceName: string, out: Size, format: OutputFormat): string {
  const base = sourceName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/-\d+x\d+$/, '') || 'image';
  return `${base.slice(0, 80)}-${out.width}x${out.height}.${FORMAT_EXT[format]}`;
}

/** The shapes and sizes offered in the "Resize or crop" sheet (without the assistant). */
export type ResizePreset = {
  shape: 'original' | 'square' | '4:3' | '16:9';
  /** Longest side in pixels; null keeps the size. */
  edge: number | null;
  /** Exact size (cover); replaces shape and edge. */
  custom?: Size;
  maxBytes: number | null;
};

/**
 * edit_image's arguments for a preset. 4:3 and 16:9 follow the picture's orientation (3:4 and 9:16 for a portrait
 * photo), so a preset never turns a portrait into a thin strip; the crop is centred.
 */
export function presetInput(preset: ResizePreset, source: Size): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if (preset.maxBytes) input.max_bytes = preset.maxBytes;
  if (preset.custom) return { ...input, width: preset.custom.width, height: preset.custom.height, fit: 'cover' };
  const portrait = source.height > source.width;
  const ratio =
    preset.shape === 'square' ? 1 : preset.shape === '4:3' ? 4 / 3 : preset.shape === '16:9' ? 16 / 9 : null;
  if (ratio === null) {
    if (preset.edge) Object.assign(input, { width: preset.edge, height: preset.edge, fit: 'fit' });
    return input;
  }
  const r = portrait ? 1 / ratio : ratio;
  if (!preset.edge) {
    const [w, h] = preset.shape === 'square' ? ['1', '1'] : preset.shape.split(':');
    return { ...input, aspect: portrait ? `${h}:${w}` : `${w}:${h}` };
  }
  const width = r >= 1 ? preset.edge : Math.max(1, Math.round(preset.edge * r));
  const height = r >= 1 ? Math.max(1, Math.round(preset.edge / r)) : preset.edge;
  return { ...input, width, height, fit: 'cover' };
}

/**
 * Whether a file input's `accept` takes a file of this name and type (as browsers match it: extensions, exact
 * types, "image/*"); an empty accept takes anything. The page script checks the same before assigning.
 */
export function acceptsFile(accept: string, name: string, mimeType: string): boolean {
  if (!accept.trim()) return true;
  const ext = (/\.[^.]+$/.exec(name)?.[0] ?? '').toLowerCase();
  const mime = mimeType.toLowerCase();
  return accept.split(',').some((raw) => {
    const a = raw.trim().toLowerCase();
    if (!a) return false;
    if (a.startsWith('.')) return a === ext || (a === '.jpeg' && ext === '.jpg') || (a === '.jpg' && ext === '.jpeg');
    if (a.endsWith('/*')) return mime.startsWith(a.slice(0, -1));
    return a === mime || (a === 'image/jpg' && mime === 'image/jpeg');
  });
}

/** The edit_image format that an `accept` list takes, preferring JPEG, then PNG, then WebP; null for none. */
export function formatForAccept(accept: string): OutputFormat | null {
  const order: OutputFormat[] = ['jpeg', 'png', 'webp'];
  return order.find((f) => acceptsFile(accept, `x.${FORMAT_EXT[f]}`, FORMAT_MIME[f])) ?? null;
}
