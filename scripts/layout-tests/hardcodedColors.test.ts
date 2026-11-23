// Interface colours come from the app's palette (src/ui/theme.ts), so every screen, sheet, bar and toast follows the
// light or dark theme (UI-48). This counts the colours written as literals ('#rrggbb', rgb()/rgba()) in each interface
// file and allows no more than the baseline below: a new literal fails here, and so does a file that lost some until
// its number is lowered, so the list only shrinks. Shadows ('#000') don't count; theme.ts is where colours belong.
//
// What the baseline holds (docs/design/27-interface.md › UI-48):
// - follows the theme through a dark sheet picked by `incognito || darkMode` (copies of the dark palette, kept for
//   incognito, which is always dark): AddressBar, FindBar, OmniboxSuggestions, PageMenu, TabSwitcher (with the purple
//   incognito look), NewTabPage, MarkdownText, chatStyles, VoiceLanguageSheet, NavigationStatus, ErrorPage, LockScreen,
//   AppCard, pageScripts, pageCustomisation, OptionCards, ChatRows, ActionMarkerLayer, App (screen background);
// - intentional, the same in both themes: over photos, video or the camera (AttachmentViews and its Slider, QrScanner),
//   the QR code itself (dark on white for scanners: QrCodeSheet), the listening curtain over the dimmed page
//   (AssistantGlass, AssistantIntro's dim), brand art (BrandGradient, QutaiMark, Aurora), white on the brand-blue or
//   coloured buttons and tiles (ChatComposer, MyApps, BuyCredits, Onboarding, ProfileQuestions), and the green
//   "works / key saved" marks (AiProviderFields, CustomEndpointFields, CreditsScreen, BuyCredits).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const BASELINE: Record<string, number> = {
  'src/components/ActionMarkerLayer.tsx': 10,
  'src/components/AddressBar.tsx': 11,
  'src/components/AiProviderFields.tsx': 1,
  'src/components/AppCard.tsx': 2,
  'src/components/AssistantGlass.tsx': 7,
  'src/components/AssistantIntro.tsx': 1,
  'src/components/AttachmentViews.tsx': 30,
  'src/components/BuyCredits.tsx': 3,
  'src/components/ChatComposer.tsx': 7,
  'src/components/ChatRows.tsx': 2,
  'src/components/CreditsScreen.tsx': 1,
  'src/components/CustomEndpointFields.tsx': 2,
  'src/components/ErrorPage.tsx': 3,
  'src/components/FindBar.tsx': 6,
  'src/components/LockScreen.tsx': 3,
  'src/components/MarkdownText.tsx': 6,
  'src/components/MyApps.tsx': 1,
  'src/components/NavigationStatus.tsx': 2,
  'src/components/NewTabPage.tsx': 13,
  'src/components/OmniboxSuggestions.tsx': 3,
  'src/components/Onboarding.tsx': 1,
  'src/components/OptionCards.tsx': 12,
  'src/components/PageMenu.tsx': 8,
  'src/components/ProfileQuestions.tsx': 1,
  'src/components/QrCodeSheet.tsx': 3,
  'src/components/QrScanner.tsx': 8,
  'src/components/TabSwitcher.tsx': 44,
  'src/components/VoiceLanguageSheet.tsx': 5,
  'src/components/chatStyles.ts': 26,
  'src/components/pageCustomisation.tsx': 2,
  'src/components/pageScripts.tsx': 2,
  'src/ui/Aurora.tsx': 1,
  'src/ui/BrandGradient.tsx': 11,
  'src/ui/QutaiMark.tsx': 2,
  'src/ui/Slider.tsx': 2,
  'App.tsx': 2,
};

const COLOR = /(['"`])#[0-9a-fA-F]{3,8}\1|rgba?\(/g;
const SHADOW = /shadowColor:\s*(['"])#000(000)?\1/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const files = [...sources('src/components'), ...sources('src/ui'), 'App.tsx'].filter((f) => f !== 'src/ui/theme.ts');
const counts = new Map(files.map((f) => [f, (readFileSync(f, 'utf8').replace(SHADOW, '').match(COLOR) ?? []).length]));

test('no new hard-coded colours outside the palette', () => {
  for (const [file, count] of counts) {
    const allowed = BASELINE[file] ?? 0;
    assert.ok(
      count <= allowed,
      `${file}: ${count} hard-coded colours, ${allowed} allowed. Use the palette (makeStyles / usePalette in ` +
        `src/ui/theme.ts; makeStyles(…, forceDark) for incognito) instead of '#…' or rgba(), or record why in UI-48.`,
    );
  }
});

test('the baseline only shrinks', () => {
  for (const [file, allowed] of Object.entries(BASELINE)) {
    const count = counts.get(file) ?? 0;
    assert.ok(count >= allowed, `${file} now has ${count} hard-coded colours: lower its baseline here to ${count}.`);
  }
});

test('the toast, the capture pill, the push-to-talk bubble, the selection bar and the action sheet use the palette', () => {
  for (const file of [
    'src/components/Toast.tsx',
    'src/components/CaptureOverlay.tsx',
    'src/components/PushToTalk.tsx',
    'src/components/SelectionBar.tsx',
    'src/components/ActionSheet.tsx',
  ]) {
    assert.equal(counts.get(file), 0, file);
  }
});
