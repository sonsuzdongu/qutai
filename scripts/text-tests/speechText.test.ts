import assert from 'node:assert/strict';
import { test } from 'node:test';
import { speechText } from '../../src/chat/speechText';

test('emphasis, headings and code marks are not read out', () => {
  assert.equal(speechText('## En uygun seçenek\n\n**iPhone 16** için _en düşük_ fiyat ~~1.200~~ `1.034,91 TL`.'),
    'En uygun seçenek.\niPhone 16 için en düşük fiyat 1.200 1.034,91 TL.');
});

test('list items and headings end with a pause', () => {
  assert.equal(speechText('# Özet\n\n- Birinci madde\n- İkinci madde!\n\n1. Bir\n2. İki'), 'Özet.\nBirinci madde.\nİkinci madde!\nBir.\nİki.');
});

test('links read their text; bare addresses read their host', () => {
  assert.equal(speechText('Bakın: [ürün sayfası](https://www.hepsiburada.com/x-p-1).'), 'Bakın: ürün sayfası.');
  assert.equal(speechText('<https://www.trendyol.com/abc?x=1>'), 'trendyol.com');
  assert.equal(speechText('Kaynak: https://www.example.com/a/b?c=d sayfası.'), 'Kaynak: example.com sayfası.');
  assert.equal(speechText('[https://shop.example.org/x](https://shop.example.org/x)'), 'shop.example.org');
});

test('tables are read row by row, cells joined with commas', () => {
  assert.equal(speechText('| Mağaza | Fiyat |\n|---|---|\n| Amazon | 1.099 TL |\n| **Trendyol** | 1.034,91 TL |'),
    'Mağaza, Fiyat.\nAmazon, 1.099 TL.\nTrendyol, 1.034,91 TL.');
});

test('citation markers are dropped', () => {
  assert.equal(speechText('Fiyat düştü [1]. Stokta var [2, 3].[^4] Kargo ücretsiz【5†source】.'), 'Fiyat düştü. Stokta var. Kargo ücretsiz.');
});

test('quotes, images, HTML and entities', () => {
  assert.equal(speechText('> Alıntı **burada**\n\n![Ürün fotoğrafı](https://x.com/a.png)\n\n<b>Kalın</b> &amp; düz'),
    'Alıntı burada\nÜrün fotoğrafı\nKalın & düz');
});

test('numbers, prices and dates are left as written', () => {
  assert.equal(speechText('Toplam 1.034,91 TL, teslimat 17.11.2026 saat 14:30.'), 'Toplam 1.034,91 TL, teslimat 17.11.2026 saat 14:30.');
  assert.equal(speechText('Price: $1,034.91 (save 15%)'), 'Price: $1,034.91 (save 15%)');
});

test('plain text comes through unchanged, and empty stays empty', () => {
  assert.equal(speechText('Merhaba, size nasıl yardımcı olabilirim?'), 'Merhaba, size nasıl yardımcı olabilirim?');
  assert.equal(speechText(''), '');
  assert.equal(speechText('---'), '');
});
