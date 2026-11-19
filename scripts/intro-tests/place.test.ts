// "Use my location" on the city question (INTRO-31): the geocoder's answer becomes district, city or province and
// country, in each language's usual order; anything that goes wrong is a short line and the text field stays.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LANGUAGES, t, tIn } from '../../src/i18n';
import { formatPlace, isEmptyPlace, LOCATION_PROBLEM_TEXT, placeFromAddress } from '../../src/intro/place';

test('Türkiye: ilçe, il, ülke; never the mahalle (neighbourhood)', () => {
  const kadikoy = placeFromAddress({ district: 'Caferağa', city: 'Kadıköy', subregion: 'Kadıköy', region: 'İstanbul', country: 'Türkiye', isoCountryCode: 'TR' });
  assert.deepEqual(kadikoy, { district: 'Kadıköy', city: 'İstanbul', country: 'Türkiye' });
  // The geocoder gives the il as the city and no subregion: no ilçe, no "İstanbul, İstanbul".
  assert.deepEqual(placeFromAddress({ city: 'İstanbul', region: 'İstanbul', country: 'Türkiye', isoCountryCode: 'tr' }), { district: null, city: 'İstanbul', country: 'Türkiye' });
  // The ilçe only as the city.
  assert.deepEqual(placeFromAddress({ city: 'Çankaya', region: 'Ankara', country: 'Türkiye', isoCountryCode: 'TR' }), { district: 'Çankaya', city: 'Ankara', country: 'Türkiye' });
  // Turkish case rules when comparing (İ / i).
  assert.equal(placeFromAddress({ subregion: 'İzmir', region: 'izmir', country: 'Türkiye', isoCountryCode: 'TR' }).district, null);
});

test('elsewhere: district, city (else county, else state), country; streets never', () => {
  assert.deepEqual(
    placeFromAddress({ district: 'Mitte', city: 'Berlin', region: 'Berlin', country: 'Deutschland', isoCountryCode: 'DE' }),
    { district: 'Mitte', city: 'Berlin', country: 'Deutschland' },
  );
  assert.deepEqual(placeFromAddress({ subregion: 'Kings County', region: 'NY', country: 'United States' }), { district: null, city: 'Kings County', country: 'United States' });
  assert.deepEqual(placeFromAddress({ region: 'Bali', country: 'Indonesia' }), { district: null, city: 'Bali', country: 'Indonesia' });
  // A city-state: the city equal to the country is left out.
  assert.deepEqual(placeFromAddress({ city: 'Singapore', country: 'Singapore' }), { district: null, city: null, country: 'Singapore' });
  const withStreet = placeFromAddress({ city: 'Lyon', country: 'France', ...{ street: 'Rue X', streetNumber: '4', name: '4 Rue X' } });
  assert.ok(!Object.values(withStreet).some((v) => v && /Rue/.test(v)));
});

test('the line in each language’s usual order: smallest first with commas, largest first in Japanese and Korean', () => {
  const place = { district: 'D', city: 'C', country: 'K' };
  const expected: Record<string, string> = { ja: 'K C D', ko: 'K C D' };
  for (const language of LANGUAGES) assert.equal(formatPlace(place, language), expected[language] ?? 'D, C, K', language);
  assert.equal(formatPlace({ district: 'Kadıköy', city: 'İstanbul', country: 'Türkiye' }, 'tr'), 'Kadıköy, İstanbul, Türkiye');
  assert.equal(formatPlace({ district: '渋谷区', city: '東京都', country: '日本' }, 'ja'), '日本 東京都 渋谷区');
  assert.equal(formatPlace({ district: null, city: 'Москва', country: 'Россия' }, 'ru'), 'Москва, Россия');
});

test('no usable name is a failure, not an empty answer', () => {
  assert.ok(isEmptyPlace(placeFromAddress({})));
  assert.ok(isEmptyPlace(placeFromAddress({ district: '  ', city: null, country: '' })));
  assert.ok(!isEmptyPlace(placeFromAddress({ country: 'France' })));
});

test('every problem (denied, location off, no fix, no module, no name or no network) has its line in all ten languages', () => {
  for (const key of Object.values(LOCATION_PROBLEM_TEXT)) {
    const english = t(key);
    assert.ok(english.length > 10, key);
    for (const language of LANGUAGES) {
      const text = tIn(language, key);
      assert.ok(text && text !== key, `${language}: ${key}`);
      if (language !== 'en') assert.notEqual(text, english, `${language}: ${key} is still English`);
    }
  }
});
