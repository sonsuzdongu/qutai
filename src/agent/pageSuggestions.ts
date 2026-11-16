import type { PageSignals } from '../browser/pageKind';
import { SEARCH_ENGINES, searchResultsOf } from '../browser/search';
import { quoteSelection } from '../browser/selection';
import { t } from '../i18n';
import type { IconName } from '../ui/Icon';
import type { SiteLevel } from './sitePolicy';
import { cutText } from '../utils/wellFormed';

/**
 * Suggestions for the empty assistant panel that fit the page on screen, worked out on the phone from what the app
 * already knows (the page-kind flags of pageKind.ts, the address, the tab's state). Nothing is sent anywhere to pick
 * them, and nothing about them is logged: a suggestion's prompt goes to the AI only when the user taps it, like a
 * message they typed.
 */

/** id: what it does, so the quick chips under the conversation can leave out what a suggestion already offers. */
export type Suggestion = {
  id: string;
  icon: IconName;
  label: string;
  prompt: string;
  /** Not about the page: an example of what Qutai can do anywhere. */
  general?: boolean;
};

export type SuggestionContext = {
  /** The tab's address; null on the new tab page. */
  url: string | null;
  /** The page failed to load (the error page is on screen). */
  loadError: boolean;
  /** null until the page has been looked at (or when it didn't answer). */
  signals: PageSignals | null;
  /** The address bar's reader indicator (the same article check, kept up to date by the tab). */
  readerAvailable: boolean;
  /** Text the user selected on this page, or ''. */
  selectedText: string;
  /** Other open tabs of the same kind (normal or incognito) that show a product page. */
  otherProductTabs: number;
  /** Other open web pages of the same kind (not new tab pages). */
  otherTabs: number;
  /** The tab is in a tab group (one conversation for the group). */
  inGroup: boolean;
  incognito: boolean;
  /** The user's permission for this site. */
  siteLevel: SiteLevel;
};

const MAX = 5;
const MIN = 3;

const VIDEO_URL =
  /^https?:\/\/((www|m)\.)?(youtube\.com\/(watch|shorts\/|live\/)|youtu\.be\/|vimeo\.com\/\d|dailymotion\.com\/video\/|twitch\.tv\/videos\/)/i;
const CART_URL = /\/(cart|basket|bag|checkout|sepet|sepetim|odeme|ödeme)(\/|$|\?|#|\.)/i;
const PDF_URL = /^[^?#]+\.pdf([?#]|$)/i;

/** The suggestions for this page, best first: three to five. */
export function pageSuggestions(ctx: SuggestionContext): Suggestion[] {
  const out: Suggestion[] = [];
  const add = (s: Suggestion | null) => {
    if (s && out.length < MAX && !out.some((x) => x.id === s.id)) out.push(s);
  };
  const s = (id: string, icon: IconName, key: SuggestionKey, params?: Record<string, string>): Suggestion => ({
    id,
    icon,
    label: t(`suggest.${key}`),
    prompt: t(`suggest.${key}Prompt`, params),
  });

  // No page, or one Qutai may not read: what Qutai can do in general.
  if (!ctx.url || ctx.siteLevel === 'blocked') {
    general(add, s, ctx);
    return out;
  }

  if (ctx.loadError) {
    add(s('pageElsewhere', 'find', 'pageElsewhere', { url: cutText(ctx.url, 500) }));
    general(add, s, ctx);
    return out;
  }

  const sig = ctx.signals;
  const kinds = new Set(sig?.kinds ?? []);
  const readOnly = ctx.siteLevel === 'readonly';
  const article = !!sig?.article || ctx.readerAvailable || kinds.has('article');

  if (ctx.selectedText) {
    const text = quoteSelection(ctx.selectedText);
    add({
      id: 'explainSelection',
      icon: 'selectText',
      label: t('suggest.explainSelection'),
      prompt: t('selection.explainPrompt', { text }),
    });
    add({
      id: 'translateSelection',
      icon: 'translate',
      label: t('suggest.translateSelection'),
      prompt: t('selection.translatePrompt', { text }),
    });
  }

  const results = searchResultsOf(ctx.url);
  if (results) {
    const params = { query: cutText(results.query, 200), engine: SEARCH_ENGINES[results.engine].name };
    add(s('bestResult', 'review', 'bestResult', params));
    add({
      id: 'summarizeResults',
      icon: 'summarize',
      label: t('quick.summarizeResults'),
      prompt: t('quick.summarizeResultsPrompt', params),
    });
    add(s('searchDeeper', 'research', 'searchDeeper', params));
    return out;
  }

  if (sig?.pdf || PDF_URL.test(ctx.url)) {
    add(s('summarize', 'summarize', 'summarizePdf'));
    add(s('keyPoints', 'keyPoints', 'keyPointsPdf'));
    add(s('askPdf', 'document', 'askPdf'));
  }

  // A cart or a payment step comes before what the products on it are.
  if (sig?.payment || sig?.form === 'checkout' || CART_URL.test(ctx.url)) add(s('checkCart', 'wallet', 'checkCart'));

  if (kinds.has('product')) {
    add({ id: 'review', icon: 'review', label: t('suggest.goodBuy'), prompt: t('quick.reviewPrompt') });
    add(s('cheaper', 'find', 'cheaper'));
    if (ctx.otherProductTabs > 0) add(s('compare', 'compare', 'compareProducts'));
  }

  if (kinds.has('recipe')) {
    add(s('ingredients', 'food', 'ingredients'));
    add(s('scaleRecipe', 'food', 'scaleRecipe'));
  }

  // A video site, or a page whose main thing is a video (recipes, products and articles often carry one on the side).
  const mainKind = kinds.has('recipe') || kinds.has('product') || article;
  if (VIDEO_URL.test(ctx.url) || ((kinds.has('video') || sig?.video) && !mainKind)) {
    add(s('aboutVideo', 'play', 'aboutVideo'));
  }

  if (kinds.has('event') && !ctx.incognito) add(s('addEvent', 'tasks', 'addEvent'));

  if (kinds.has('jobPosting')) {
    add(s('jobRequirements', 'keyPoints', 'jobRequirements'));
    add(s('jobFit', 'person', 'jobFit'));
  }

  if (kinds.has('localBusiness') || (sig?.phone && sig.address)) {
    if (sig?.phone || kinds.has('localBusiness')) add(s('call', 'phone', 'call'));
    // Directions start from the user's location, which incognito conversations never share.
    if (!ctx.incognito) add(s('directions', 'location', 'directions'));
    add(s('openingHours', 'info', 'openingHours'));
  }

  if (sig?.form && sig.form !== 'checkout' && !readOnly) add(s('fillForm', 'person', 'fillForm'));

  if (article) {
    add({ id: 'summarize', icon: 'summarize', label: t('quick.summarize'), prompt: t('quick.summarizePrompt') });
    add({ id: 'keyPoints', icon: 'keyPoints', label: t('quick.keyPoints'), prompt: t('quick.keyPointsPrompt') });
    add(s('readAloud', 'readAloud', 'readAloud'));
  }

  if (sig?.table) add(s('tableCsv', 'download', 'tableCsv'));

  if (ctx.inGroup && ctx.otherTabs > 0) add(s('compare', 'compare', 'compareGroup'));

  if (sig?.long && !article) add(s('findImportant', 'keyPoints', 'findImportant'));

  // Nothing particular found (or too little): what works on any page.
  if (out.length < MIN) {
    add({ id: 'summarize', icon: 'summarize', label: t('quick.summarize'), prompt: t('quick.summarizePrompt') });
    add(s('whatCanIDo', 'assistant', 'whatCanIDo'));
    add({ id: 'keyPoints', icon: 'keyPoints', label: t('quick.keyPoints'), prompt: t('quick.keyPointsPrompt') });
  }
  return out;
}

type SuggestionKey =
  | 'pageElsewhere'
  | 'bestResult'
  | 'searchDeeper'
  | 'summarizePdf'
  | 'keyPointsPdf'
  | 'askPdf'
  | 'checkCart'
  | 'cheaper'
  | 'compareProducts'
  | 'ingredients'
  | 'scaleRecipe'
  | 'aboutVideo'
  | 'addEvent'
  | 'jobRequirements'
  | 'jobFit'
  | 'call'
  | 'directions'
  | 'openingHours'
  | 'fillForm'
  | 'readAloud'
  | 'tableCsv'
  | 'compareGroup'
  | 'findImportant'
  | 'whatCanIDo'
  | 'webFlights'
  | 'webRecipe'
  | 'webNews'
  | 'webNearby';

/** What Qutai can do without a page: a few varied tasks. */
function general(
  add: (s: Suggestion) => void,
  s: (id: string, icon: IconName, key: SuggestionKey) => Suggestion,
  ctx: SuggestionContext,
) {
  const g = (id: SuggestionKey, icon: IconName) => ({ ...s(id, icon, id), general: true });
  add(g('webFlights', 'travel'));
  add(g('webRecipe', 'food'));
  add(g('webNews', 'research'));
  // Nearby places start from the user's location, which incognito conversations never share.
  if (!ctx.incognito) add(g('webNearby', 'location'));
}
