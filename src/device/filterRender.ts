import type { SkImage, SkPaint, SkRuntimeEffect } from '@shopify/react-native-skia';
import type { Size } from '../chat/imageEdit';
import { autoLevels, blurSigma, colourMatrix, type Filters, type Levels, luminance, SHARPEN_MAX } from '../chat/imageFilters';

/**
 * Image filters drawn with Skia (the maths and the order are in src/chat/imageFilters.ts). Only types come from
 * react-native-skia here: the Skia API is passed in, so the same code runs on the phone and, with CanvasKit, in the
 * Node tests (`npm run test:image`), which check its pixels.
 *
 * - Colour: one ColorFilter.MakeMatrix. Skia applies it to unpremultiplied colours and its alpha row is the
 *   identity, so transparency is kept.
 * - Blur: ImageFilter.MakeBlur with clamped edges (an opaque picture keeps opaque borders), taking the colour
 *   filter as its input, so colour comes first.
 * - Sharpen: a second pass with a small runtime shader (SHARPEN_SKSL) over the colour-filtered result: an unsharp
 *   mask on the 3×3 neighbourhood (1-2-1 Gaussian, as sharpenKernel), computed on unpremultiplied colours with the
 *   pixel's own alpha kept; a fully transparent neighbour counts as the pixel itself, so no dark fringe grows along
 *   transparent edges.
 */

type SkiaApi = typeof import('@shopify/react-native-skia').Skia;

/** Skia's enum values, written out so that this file needs no runtime import of react-native-skia. */
const TILE_CLAMP = 0;
const FILTER_NEAREST = 0;
const FILTER_LINEAR = 1;
const MIPMAP_NONE = 0;
const COLOR_RGBA_8888 = 4;
const ALPHA_UNPREMUL = 3;
/** Auto enhance measures a copy at most this wide or tall. */
const MEASURE_EDGE = 128;

const SHARPEN_SKSL = `
uniform shader image;
uniform float amount;

float3 unpremul(half4 c, float3 fallback) {
  return c.a > 0.0 ? float3(c.rgb) / float(c.a) : fallback;
}

half4 main(float2 p) {
  half4 c = image.eval(p);
  float a = float(c.a);
  if (a <= 0.0) return half4(0);
  float3 centre = float3(c.rgb) / a;
  float3 sum = centre * 4.0;
  sum += 2.0 * unpremul(image.eval(p + float2(-1.0, 0.0)), centre);
  sum += 2.0 * unpremul(image.eval(p + float2(1.0, 0.0)), centre);
  sum += 2.0 * unpremul(image.eval(p + float2(0.0, -1.0)), centre);
  sum += 2.0 * unpremul(image.eval(p + float2(0.0, 1.0)), centre);
  sum += unpremul(image.eval(p + float2(-1.0, -1.0)), centre);
  sum += unpremul(image.eval(p + float2(1.0, -1.0)), centre);
  sum += unpremul(image.eval(p + float2(-1.0, 1.0)), centre);
  sum += unpremul(image.eval(p + float2(1.0, 1.0)), centre);
  float3 sharp = clamp(centre + amount * (centre - sum / 16.0), 0.0, 1.0);
  return half4(half3(sharp * a), half(a));
}
`;

const effects = new WeakMap<object, SkRuntimeEffect>();
function sharpenEffect(skia: SkiaApi): SkRuntimeEffect {
  let effect = effects.get(skia);
  if (!effect) {
    const made = skia.RuntimeEffect.Make(SHARPEN_SKSL);
    if (!made) throw new Error('The sharpen shader could not be compiled.');
    effect = made;
    effects.set(skia, effect);
  }
  return effect;
}

/**
 * Auto enhance's levels: the picture drawn at most 128 px across, the luminance of its pixels at least half opaque
 * counted, and the stretch worked out (null: left as it is).
 */
export function measureLevels(skia: SkiaApi, image: SkImage): ReturnType<typeof autoLevels> {
  const f = Math.min(1, MEASURE_EDGE / Math.max(image.width(), image.height()));
  const width = Math.max(1, Math.round(image.width() * f));
  const height = Math.max(1, Math.round(image.height() * f));
  const surface = skia.Surface.Make(width, height);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.clear(skia.Color('transparent'));
    canvas.drawImageRectOptions(
      image,
      skia.XYWHRect(0, 0, image.width(), image.height()),
      skia.XYWHRect(0, 0, width, height),
      FILTER_LINEAR as never,
      MIPMAP_NONE as never,
      skia.Paint(),
    );
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    const pixels = snapshot.readPixels(0, 0, { width, height, colorType: COLOR_RGBA_8888, alphaType: ALPHA_UNPREMUL } as never);
    snapshot.dispose();
    if (!pixels) return null;
    const histogram = new Array<number>(256).fill(0);
    for (let i = 0; i + 3 < pixels.length; i += 4) {
      if (pixels[i + 3] < 128) continue;
      histogram[Math.min(255, Math.max(0, luminance(pixels[i], pixels[i + 1], pixels[i + 2])))]++;
    }
    return autoLevels(histogram);
  } finally {
    surface.dispose();
  }
}

/**
 * A paint for drawing an image with the colour filters and the blur, for a result of `size` pixels; null when
 * neither is to be done. Sharpen is a separate pass (sharpenImage). `levels`: auto enhance's measured stretch.
 */
export function filterPaint(skia: SkiaApi, filters: Filters, size: Size, levels?: Levels | null): SkPaint | null {
  const matrix = colourMatrix(filters, levels);
  const colour = matrix ? skia.ColorFilter.MakeMatrix(matrix) : null;
  const sigma = blurSigma(filters.blur, size);
  if (!colour && sigma < 0.3) return null;
  const paint = skia.Paint();
  if (sigma >= 0.3)
    paint.setImageFilter(
      skia.ImageFilter.MakeBlur(sigma, sigma, TILE_CLAMP as never, colour ? skia.ImageFilter.MakeColorFilter(colour, null) : null),
    );
  else if (colour) paint.setColorFilter(colour);
  return paint;
}

/** `image` sharpened (0–100) at its own size, over `background` (null: transparent). The caller disposes both. */
export function sharpenImage(skia: SkiaApi, image: SkImage, sharpen: number, background: string | null): SkImage {
  const width = image.width();
  const height = image.height();
  const surface = skia.Surface.Make(width, height);
  if (!surface) throw new Error('Not enough memory to sharpen this image.');
  const canvas = surface.getCanvas();
  canvas.clear(skia.Color(background ?? 'transparent'));
  const child = image.makeShaderOptions(TILE_CLAMP as never, TILE_CLAMP as never, FILTER_NEAREST as never, MIPMAP_NONE as never);
  const paint = skia.Paint();
  paint.setShader(sharpenEffect(skia).makeShaderWithChildren([(SHARPEN_MAX * sharpen) / 100], [child]));
  canvas.drawRect(skia.XYWHRect(0, 0, width, height), paint);
  surface.flush();
  const result = surface.makeImageSnapshot();
  surface.dispose();
  return result;
}

/**
 * `image` drawn at `size` with the filters, bilinear when the size differs, over `background` (null: transparent).
 * Used for the sheet's live preview and the tests; the saved result is drawn by src/device/imageEdit.ts with its own
 * resampling and the same paint and sharpen pass. The caller disposes the result.
 */
export function renderFiltered(
  skia: SkiaApi,
  image: SkImage,
  size: Size,
  filters: Filters,
  levels?: Levels | null,
  background: string | null = null,
): SkImage | null {
  const surface = skia.Surface.Make(size.width, size.height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(skia.Color(filters.sharpen ? 'transparent' : (background ?? 'transparent')));
  const paint = filterPaint(skia, filters, size, levels) ?? skia.Paint();
  const same = image.width() === size.width && image.height() === size.height;
  canvas.drawImageRectOptions(
    image,
    skia.XYWHRect(0, 0, image.width(), image.height()),
    skia.XYWHRect(0, 0, size.width, size.height),
    (same ? FILTER_NEAREST : FILTER_LINEAR) as never,
    MIPMAP_NONE as never,
    paint,
  );
  surface.flush();
  const drawn = surface.makeImageSnapshot();
  surface.dispose();
  if (!filters.sharpen) return drawn;
  try {
    return sharpenImage(skia, drawn, filters.sharpen, background);
  } finally {
    drawn.dispose();
  }
}
