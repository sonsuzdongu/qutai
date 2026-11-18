// Image filters as planned (src/chat/imageFilters.ts) and as edit_image reads them (src/chat/imageEdit.ts): ranges,
// clamping, the fixed order, combining with crop and resize, the sheet's presets, and the card's summary sentence
// in the ten languages (src/chat/filterSummary.ts). The pixels are checked in pixels.test.ts.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { parseEditRequest, planEdit, type EditRequest } from '../../src/chat/imageEdit.ts';
import {
  applyMatrix,
  autoLevels,
  blurSigma,
  colourMatrix,
  colourParts,
  COLOUR_ORDER,
  filtersArgument,
  type Filters,
  filterSteps,
  NO_FILTERS,
  parseFilters,
  presetActive,
  sharpenKernel,
  stepAmount,
  togglePreset,
} from '../../src/chat/imageFilters.ts';
import { describeFilters } from '../../src/chat/filterSummary.ts';
import { setLanguage } from '../../src/i18n/index.ts';
import { LANGUAGES } from '../../src/i18n/languages.ts';

afterEach(() => setLanguage('en'));

const f = (change: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...change });
const parsed = (value: unknown) => {
  const r = parseFilters(value);
  assert.notEqual(typeof r, 'string', String(r));
  return r as Exclude<ReturnType<typeof parseFilters>, string>;
};

test('filters are read from a list, an object or an array, with aliases and signs', () => {
  assert.deepEqual(parsed('greyscale, sharpen 30, brightness -20').filters, f({ greyscale: true, sharpen: 30, brightness: -20 }));
  assert.deepEqual(parsed('Black and white; contrast=+15; warm: 40').filters, f({ greyscale: true, contrast: 15, warmth: 40 }));
  assert.deepEqual(parsed({ sepia: true, blur: 10, invert: false }).filters, f({ sepia: true, blur: 10 }));
  assert.deepEqual(parsed(['auto', 'saturation -100']).filters, f({ auto: true, saturation: -100 }));
  assert.deepEqual(parsed('').filters, NO_FILTERS);
  assert.deepEqual(parsed(undefined).filters, NO_FILTERS);
  assert.deepEqual(parsed('none').filters, NO_FILTERS);
});

test('a filter named without a number gets the documented "a little" amount', () => {
  assert.deepEqual(parsed('brightness, contrast, saturation, warmth').filters, f({ brightness: 25, contrast: 25, saturation: 25, warmth: 25 }));
  assert.equal(parsed('sharpen').filters.sharpen, 40);
  assert.equal(parsed('blur').filters.blur, 20);
});

test('out-of-range amounts are clamped and the model is told', () => {
  const r = parsed('brightness 250, sharpen -5, contrast -300, blur 0');
  assert.deepEqual(r.filters, f({ brightness: 100, contrast: -100 }));
  assert.equal(r.notes.length, 3);
  assert.match(r.notes[0], /brightness 250 is outside -100…100; 100 was used/);
  assert.equal(parsed('saturation 12.6').filters.saturation, 13);
  assert.match(parsed('greyscale 50').notes[0], /on or off/);
});

test('unknown filters, bad amounts and sharpen with blur are refused', () => {
  assert.match(String(parseFilters('vintage')), /Unknown filter "vintage"/);
  assert.match(String(parseFilters('brightness 1x0')), /Could not read the filter/);
  assert.match(String(parseFilters({ contrast: 'x' })), /contrast takes a number/);
  assert.match(String(parseFilters('sharpen 20, blur 10')), /either sharpen or blur/);
  assert.match(String(parseFilters(42)), /filters is a list/);
});

test('the colour parts always apply in the documented order, whatever order they were named in', () => {
  const all = parsed('invert, sepia, greyscale, warmth 10, saturation 10, contrast 10, brightness 10, auto').filters;
  const order = colourParts(all, { gain: 1.2, offset: -0.1 }).map((p) => p.part);
  assert.deepEqual(order, [...COLOUR_ORDER]);
  // And the model hears them in that order too, detail last.
  assert.deepEqual(
    filterSteps(parsed('sharpen 20, invert, brightness 10').filters),
    ['brightness +10 (×1.10)', 'inverted', 'sharpened (20)'],
  );
});

test('colour maths: greyscale of a known colour, invert twice, identities', () => {
  // Rec. 709 luma of (200, 100, 50) is 117.6.
  assert.deepEqual(applyMatrix(colourMatrix(f({ greyscale: true }))!, [200, 100, 50, 255]), [118, 118, 118, 255]);
  const inv = colourMatrix(f({ invert: true }))!;
  for (const c of [[200, 100, 50, 255], [0, 255, 7, 128], [255, 255, 255, 0]])
    assert.deepEqual(applyMatrix(inv, applyMatrix(inv, c)), c);
  assert.equal(colourMatrix(f({ brightness: 0 })), null, 'brightness 0 changes nothing');
  assert.equal(colourMatrix(NO_FILTERS), null);
  // Saturation -100 is greyscale; contrast -100 is flat grey; brightness -100 is black; alpha never changes.
  assert.deepEqual(applyMatrix(colourMatrix(f({ saturation: -100 }))!, [200, 100, 50, 77]), [118, 118, 118, 77]);
  assert.deepEqual(applyMatrix(colourMatrix(f({ contrast: -100 }))!, [200, 10, 90, 255]), [128, 128, 128, 255]);
  assert.deepEqual(applyMatrix(colourMatrix(f({ brightness: -100 }))!, [200, 10, 90, 40]), [0, 0, 0, 40]);
  assert.deepEqual(applyMatrix(colourMatrix(f({ brightness: 25 }))!, [100, 200, 240, 255]), [125, 250, 255, 255]);
  // Warmth moves red up and blue down by 20 % at 100.
  assert.deepEqual(applyMatrix(colourMatrix(f({ warmth: 100 }))!, [100, 100, 100, 255]), [120, 100, 80, 255]);
});

test('sharpen keeps flat areas (its kernel sums to 1); blur follows the picture size', () => {
  for (const v of [1, 40, 100]) assert.ok(Math.abs(sharpenKernel(v).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(sharpenKernel(100)[4], 2.5);
  assert.equal(blurSigma(0, { width: 4000, height: 3000 }), 0);
  assert.equal(blurSigma(100, { width: 4000, height: 3000 }), 60);
  assert.equal(blurSigma(20, { width: 1000, height: 500 }), 2);
});

test('auto enhance: a predictable levels stretch, or nothing', () => {
  const hist = (lo: number, hi: number) => Array.from({ length: 256 }, (_, i) => (i >= lo && i <= hi ? 10 : 0));
  const l = autoLevels(hist(30, 220))!;
  assert.equal(l.low, 30);
  assert.equal(l.high, 220);
  assert.ok(Math.abs(l.gain - 255 / 190) < 1e-9);
  // A narrow range is stretched by 2 at most, around its middle.
  const n = autoLevels(hist(100, 140))!;
  assert.equal(n.gain, 2);
  assert.ok(Math.abs(applyMatrix(colourMatrix(f({ auto: true }), n)!, [120, 120, 120, 255])[0] - 128) <= 1);
  assert.equal(autoLevels(hist(0, 255)), null, 'already full range');
  assert.equal(autoLevels(hist(120, 124)), null, 'flat');
  assert.equal(autoLevels(new Array(256).fill(0)), null, 'nothing counted');
  // A few stray pixels (under 0.5 %) do not hold the stretch back.
  const stray = hist(50, 200);
  stray[0] = 2;
  stray[255] = 2;
  assert.equal(autoLevels(stray)!.low, 50);
  assert.equal(autoLevels(stray)!.high, 200);
  // Without measured levels auto adds nothing to the matrix.
  assert.equal(colourMatrix(f({ auto: true }), null), null);
});

test('edit_image combines filters with crop and resize; filters alone are an edit', () => {
  const req = parseEditRequest({ aspect: '1:1', width: 512, height: 512, filters: 'greyscale, sharpen 300' }) as EditRequest;
  assert.notEqual(typeof req, 'string');
  assert.deepEqual(req.filters, f({ greyscale: true, sharpen: 100 }));
  const plan = planEdit(req, { width: 4000, height: 3000 });
  assert.notEqual(typeof plan, 'string');
  if (typeof plan === 'string') return;
  assert.deepEqual(plan.out, { width: 512, height: 512 });
  assert.deepEqual(plan.region, { x: 500, y: 0, width: 3000, height: 3000 });
  assert.ok(plan.notes.some((n) => /sharpen 300 is outside/.test(n)), 'the clamp note reaches the model');
  const only = parseEditRequest({ filters: 'sepia' }) as EditRequest;
  const p2 = planEdit(only, { width: 640, height: 480 });
  assert.deepEqual(typeof p2 !== 'string' && p2.out, { width: 640, height: 480 });
  assert.equal(parseEditRequest({ filters: 'none' }) && (parseEditRequest({ filters: 'none' }) as EditRequest).filters, undefined);
  assert.match(String(parseEditRequest({ filters: 'blur, sharpen' })), /either sharpen or blur/);
});

test('sheet presets toggle what they name; Original resets; a slider steps by 5 within range', () => {
  let s = togglePreset(NO_FILTERS, 'greyscale');
  assert.ok(presetActive(s, 'greyscale'));
  assert.ok(!presetActive(s, 'original'));
  s = togglePreset(s, 'sepia');
  assert.deepEqual([s.sepia, s.greyscale], [true, false], 'sepia replaces greyscale');
  s = togglePreset(togglePreset(s, 'sharpen'), 'brighter');
  assert.deepEqual([s.sharpen, s.brightness], [40, 25]);
  s = togglePreset(s, 'blur');
  assert.deepEqual([s.blur, s.sharpen], [20, 0], 'blur replaces sharpen');
  s = togglePreset(s, 'brighter');
  assert.equal(s.brightness, 0, 'tapping again turns it off');
  assert.equal(filtersArgument(s), 'sepia, blur 20');
  assert.deepEqual(parsed(filtersArgument(s)).filters, s, "the sheet's argument reads back the same");
  assert.deepEqual(togglePreset(s, 'original'), NO_FILTERS);
  assert.equal(stepAmount('brightness', 98, 1), 100);
  assert.equal(stepAmount('sharpen', 0, -1), 0);
  assert.equal(stepAmount('contrast', 12, -1), 5);
});

test('the summary sentence, in every interface language', () => {
  const look = { greyscale: true, sharpen: 40 };
  const expected: Record<string, string> = {
    en: 'Greyscale, sharpened',
    tr: 'Siyah beyaz, keskinleştirildi',
    de: 'Graustufen, geschärft',
    fr: 'Noir et blanc, plus nette',
    es: 'Blanco y negro, más nítida',
    'pt-BR': 'Preto e branco, mais nítida',
    ja: 'モノクロ、シャープに',
    ko: '흑백, 선명하게',
    ru: 'Чёрно-белое, резче',
    id: 'Hitam putih, dipertajam',
  };
  for (const language of LANGUAGES) {
    setLanguage(language);
    assert.equal(describeFilters(look), expected[language], language);
    // Every filter has words in every language, in the order they apply.
    const all = describeFilters({ auto: true, brightness: -5, contrast: 5, saturation: -5, warmth: -5, sepia: true, invert: true, blur: 5 });
    assert.ok(all.length > 20 && !/filters\./.test(all), `${language}: ${all}`);
  }
  setLanguage('en');
  assert.equal(
    describeFilters({ auto: true, brightness: 10, contrast: -10, saturation: 10, warmth: -10, invert: true, blur: 10 }),
    'Auto-enhanced, brighter, less contrast, more vivid colours, cooler, inverted, blurred',
  );
  assert.equal(describeFilters({}), '');
  assert.equal(describeFilters(undefined), '');
});
