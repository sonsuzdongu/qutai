// Page zoom (UI-84): src/browser/pageZoom.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  baseZoomFor,
  DEFAULT_ZOOM_LEVEL,
  MAC_BASE_PAGE_ZOOM,
  normalizeZoomLevel,
  SiteZoomLevels,
  pageZoomTextSize,
  stepZoom,
  textSizeByPageZoom,
  webViewPageZoom,
  ZOOM_LEVELS,
  zoomReplacesTextSize,
} from '../../src/browser/pageZoom';

test("the steps are Safari's, 50% to 300%, with 100% among them", () => {
  assert.deepEqual([...ZOOM_LEVELS], [50, 75, 85, 100, 115, 125, 150, 175, 200, 250, 300]);
  assert.equal(DEFAULT_ZOOM_LEVEL, 100);
});

test('⌘+ and ⌘− move one step and stop at the ends', () => {
  assert.equal(stepZoom(100, 'in'), 115);
  assert.equal(stepZoom(100, 'out'), 85);
  assert.equal(stepZoom(85, 'out'), 75);
  assert.equal(stepZoom(250, 'in'), 300);
  assert.equal(stepZoom(300, 'in'), 300);
  assert.equal(stepZoom(50, 'out'), 50);
  // Between steps: the next one either way.
  assert.equal(stepZoom(110, 'in'), 115);
  assert.equal(stepZoom(110, 'out'), 100);
});

test('only a Mac starts pages zoomed in, to make up for the 77% iPad scale', () => {
  assert.equal(baseZoomFor('mac'), MAC_BASE_PAGE_ZOOM);
  assert.ok(MAC_BASE_PAGE_ZOOM > 1.29 && MAC_BASE_PAGE_ZOOM < 1.31);
  assert.equal(baseZoomFor('tablet'), 1);
  assert.equal(baseZoomFor('phone'), 1);
  assert.equal(baseZoomFor('android'), 1);
});

test('the WebView gets the base times the level', () => {
  assert.equal(webViewPageZoom(100, 1), 1);
  assert.equal(webViewPageZoom(125, 1), 1.25);
  assert.equal(webViewPageZoom(100, MAC_BASE_PAGE_ZOOM), MAC_BASE_PAGE_ZOOM);
  assert.equal(webViewPageZoom(50, 1.299), 0.65);
});

test('on a Mac and an iPad the Settings text size is part of the page zoom; iPhone keeps text-size-adjust', () => {
  assert.equal(textSizeByPageZoom('mac'), true);
  assert.equal(textSizeByPageZoom('tablet'), true);
  assert.equal(textSizeByPageZoom('phone'), false);
  assert.equal(textSizeByPageZoom('android'), false);
  assert.equal(webViewPageZoom(100, MAC_BASE_PAGE_ZOOM, 150), 1.949);
  assert.equal(webViewPageZoom(125, 1, 120), 1.5);
  assert.equal(webViewPageZoom(100, 1, 100), 1);
});

test('stored levels snap to a step; anything else is not a level', () => {
  assert.equal(normalizeZoomLevel(125), 125);
  assert.equal(normalizeZoomLevel('150'), 150);
  assert.equal(normalizeZoomLevel(120), 115);
  assert.equal(normalizeZoomLevel(1000), 300);
  assert.equal(normalizeZoomLevel(0), 50);
  assert.equal(normalizeZoomLevel('x'), null);
  assert.equal(normalizeZoomLevel(''), null);
  assert.equal(normalizeZoomLevel(null), null);
  assert.equal(normalizeZoomLevel(NaN), null);
});

test('levels are remembered per site; 100% forgets the site', () => {
  const levels = new SiteZoomLevels();
  assert.equal(levels.get('example.com'), 100);
  assert.equal(levels.get(null), 100);
  assert.equal(levels.set('example.com', 125), true);
  assert.equal(levels.set('example.com', 125), false);
  assert.equal(levels.get('example.com'), 125);
  assert.equal(levels.get('other.org'), 100);
  levels.set('other.org', 75);
  assert.deepEqual(levels.toJson(), { 'example.com': 125, 'other.org': 75 });
  assert.equal(levels.set('example.com', 100), true);
  assert.deepEqual(levels.toJson(), { 'other.org': 75 });
  assert.equal(levels.size, 1);
});

test('a saved list is read back, leaving out what is unreadable', () => {
  const levels = SiteZoomLevels.fromJson({ 'a.com': 150, 'b.com': 'x', 'c.com': 100, 'd.com': 118 });
  assert.deepEqual(levels.toJson(), { 'a.com': 150, 'd.com': 115 });
  assert.equal(SiteZoomLevels.fromJson(null).size, 0);
  assert.equal(SiteZoomLevels.fromJson([1, 2]).size, 0);
  assert.equal(SiteZoomLevels.fromJson('{}').size, 0);
});

test("a Mac's menu Zoom replaces the text size: one value per site", () => {
  assert.equal(zoomReplacesTextSize('mac'), true);
  assert.equal(zoomReplacesTextSize('tablet'), false);
  assert.equal(zoomReplacesTextSize('phone'), false);
  // The Settings text size never reaches a Mac's page zoom; an iPad's does; iPhone and Android use their own paths.
  assert.equal(pageZoomTextSize('mac', 150), 100);
  assert.equal(pageZoomTextSize('tablet', 150), 150);
  assert.equal(pageZoomTextSize('phone', 150), 100);
  assert.equal(pageZoomTextSize('android', 150), 100);
  assert.equal(webViewPageZoom(125, MAC_BASE_PAGE_ZOOM, pageZoomTextSize('mac', 150)), 1.624);
});
