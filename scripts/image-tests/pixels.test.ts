// The filters' pixels, drawn by the app's own Skia code (src/device/filterRender.ts) on CanvasKit, Skia's
// WebAssembly build that react-native-skia uses on the web: the same Skia operations as on the phone, run in Node.
// Each result is compared with the reference maths in src/chat/imageFilters.ts (applyMatrix).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, test } from 'node:test';
import { applyMatrix, colourMatrix, type Filters, NO_FILTERS } from '../../src/chat/imageFilters.ts';
import { filterPaint, measureLevels, renderFiltered } from '../../src/device/filterRender.ts';

const require = createRequire(import.meta.url);
type SkiaApi = typeof import('@shopify/react-native-skia').Skia;
type SkImage = import('@shopify/react-native-skia').SkImage;
let Skia: SkiaApi;

before(async () => {
  const init = require('canvaskit-wasm/bin/full/canvaskit.js');
  const CanvasKit = await init();
  const { JsiSkApi } = require('@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia.js');
  Skia = JsiSkApi(CanvasKit);
});

const RGBA = 4;
const UNPREMUL = 3;

/** An image from unpremultiplied RGBA rows. */
function imageOf(width: number, height: number, pixel: (x: number, y: number) => number[]): SkImage {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) bytes.set(pixel(x, y), (y * width + x) * 4);
  const data = Skia.Data.fromBytes(bytes);
  const img = Skia.Image.MakeImage({ width, height, colorType: RGBA, alphaType: UNPREMUL } as never, data, width * 4);
  assert.ok(img, 'image made');
  return img!;
}

function pixels(img: SkImage): Uint8Array {
  const out = img.readPixels(0, 0, { width: img.width(), height: img.height(), colorType: RGBA, alphaType: UNPREMUL } as never);
  assert.ok(out);
  return out as Uint8Array;
}

const at = (p: Uint8Array, w: number, x: number, y: number) => [...p.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];
const f = (change: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...change });

function render(img: SkImage, filters: Filters): Uint8Array {
  const out = renderFiltered(Skia, img, { width: img.width(), height: img.height() }, filters, null);
  assert.ok(out);
  const p = pixels(out!);
  out!.dispose();
  return p;
}

/** Within `tol` per channel (Skia's float pipeline and 8-bit rounding). */
function close(actual: number[], expected: number[], tol: number, what: string) {
  assert.ok(
    actual.every((v, i) => Math.abs(v - expected[i]) <= tol),
    `${what}: got ${actual.join(',')}, expected ${expected.join(',')} (±${tol})`,
  );
}

const COLOURS = [
  [200, 100, 50, 255],
  [12, 240, 130, 255],
  [255, 255, 255, 255],
  [0, 0, 0, 255],
  [90, 60, 200, 128],
];

test('every colour filter on the phone matches the reference matrix maths', () => {
  const img = imageOf(COLOURS.length, 1, (x) => COLOURS[x]);
  const cases: Partial<Filters>[] = [
    { greyscale: true },
    { sepia: true },
    { invert: true },
    { brightness: 40 },
    { brightness: -60 },
    { contrast: 50 },
    { contrast: -50 },
    { saturation: 80 },
    { saturation: -100 },
    { warmth: 60 },
    { warmth: -60 },
    { brightness: 20, contrast: 30, saturation: -20, warmth: 10, sepia: true },
  ];
  for (const change of cases) {
    const p = render(img, f(change));
    const m = colourMatrix(f(change))!;
    COLOURS.forEach((c, x) => close(at(p, COLOURS.length, x, 0), applyMatrix(m, c), 2, JSON.stringify(change)));
  }
});

test('greyscale of a known colour, invert twice, and brightness 0', () => {
  const img = imageOf(1, 1, () => [200, 100, 50, 255]);
  // Rec. 709: 0.2126·200 + 0.7152·100 + 0.0722·50 = 117.6
  close(at(render(img, f({ greyscale: true })), 1, 0, 0), [118, 118, 118, 255], 1, 'greyscale');
  const inverted = render(img, f({ invert: true }));
  close(at(inverted, 1, 0, 0), [55, 155, 205, 255], 1, 'invert');
  const back = imageOf(1, 1, () => at(inverted, 1, 0, 0));
  close(at(render(back, f({ invert: true })), 1, 0, 0), [200, 100, 50, 255], 0, 'invert twice');
  assert.equal(filterPaint(Skia, f({ brightness: 0 }), { width: 1, height: 1 }), null, 'brightness 0 is no filter at all');
  close(at(render(img, f({ brightness: 0 })), 1, 0, 0), [200, 100, 50, 255], 0, 'brightness 0');
});

test('transparency is kept: colour filters and sharpen leave alpha as it was', () => {
  // A half-transparent disc on a fully transparent background.
  const w = 16;
  const alphaOf = (x: number, y: number) => ((x - 8) ** 2 + (y - 8) ** 2 < 25 ? 160 : 0);
  const img = imageOf(w, w, (x, y) => [(x * 16) % 256, (y * 16) % 256, 120, alphaOf(x, y)]);
  for (const change of [{ invert: true }, { sepia: true, brightness: 50 }, { sharpen: 100 }, { sharpen: 60, greyscale: true }]) {
    const p = render(img, f(change));
    for (let y = 0; y < w; y++)
      for (let x = 0; x < w; x++) assert.equal(at(p, w, x, y)[3], alphaOf(x, y), `alpha at ${x},${y} for ${JSON.stringify(change)}`);
  }
});

test('sharpen raises an edge and leaves flat areas alone; blur softens it and keeps an opaque picture opaque', () => {
  const w = 12;
  const img = imageOf(w, w, (x) => (x < 6 ? [80, 80, 80, 255] : [160, 160, 160, 255]));
  const sharp = render(img, f({ sharpen: 50 }));
  assert.deepEqual(at(sharp, w, 1, 5), [80, 80, 80, 255], 'flat dark area unchanged');
  assert.deepEqual(at(sharp, w, 10, 5), [160, 160, 160, 255], 'flat light area unchanged');
  assert.ok(at(sharp, w, 5, 5)[0] < 80, 'dark side of the edge darker');
  assert.ok(at(sharp, w, 6, 5)[0] > 160, 'light side of the edge lighter');
  // Blur's sigma follows the picture's size (2 % of the shorter side at 100): 2 px here.
  const b = 100;
  const wide = imageOf(b, b, (x) => (x < 50 ? [80, 80, 80, 255] : [160, 160, 160, 255]));
  const soft = render(wide, f({ blur: 100 }));
  assert.ok(at(soft, b, 49, 5)[0] > 85 && at(soft, b, 50, 5)[0] < 155, 'edge softened');
  assert.deepEqual(at(soft, b, 10, 5), [80, 80, 80, 255], 'far from the edge unchanged');
  for (const [x, y] of [[0, 0], [99, 0], [0, 99], [99, 99], [50, 0]]) assert.equal(at(soft, b, x, y)[3], 255, `opaque at ${x},${y}`);
});

test('colour comes before sharpen: greyscale then sharpen is grey', () => {
  const w = 8;
  const img = imageOf(w, w, (x) => (x < 4 ? [200, 30, 30, 255] : [20, 30, 200, 255]));
  const p = render(img, f({ greyscale: true, sharpen: 80 }));
  for (let x = 0; x < w; x++) {
    const [r, g, b] = at(p, w, x, 3);
    assert.ok(Math.abs(r - g) <= 1 && Math.abs(g - b) <= 1, `grey at ${x}: ${r},${g},${b}`);
  }
});

test('auto enhance measures the tones and stretches them to the full range', () => {
  // A dull picture from 40 to 200.
  const w = 64;
  const img = imageOf(w, w, (x) => {
    const v = 40 + Math.round((x / (w - 1)) * 160);
    return [v, v, v, 255];
  });
  const levels = measureLevels(Skia, img);
  assert.ok(levels, 'levels found');
  assert.ok(levels!.low <= 43 && levels!.high >= 197, `range ${levels!.low}–${levels!.high}`);
  const out = renderFiltered(Skia, img, { width: w, height: w }, f({ auto: true }), levels);
  const p = pixels(out!);
  assert.ok(at(p, w, 0, 0)[0] <= 4, `darkest now ${at(p, w, 0, 0)[0]}`);
  assert.ok(at(p, w, w - 1, 0)[0] >= 251, `brightest now ${at(p, w, w - 1, 0)[0]}`);
  // A picture that already spans the range is left alone.
  const full = imageOf(w, w, (x) => {
    const v = Math.round((x / (w - 1)) * 255);
    return [v, v, v, 255];
  });
  assert.equal(measureLevels(Skia, full), null);
});
