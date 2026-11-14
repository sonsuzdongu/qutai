import { SELECTION_SCRIPT } from './selection';

/**
 * Reader mode: the page's main content, extracted by the page script (`readerArticle`), shown in a
 * separate WebView over the tab. The extracted HTML only ever contains allowlisted tags and
 * attributes; the reader document adds a Content-Security-Policy that runs no script of its own
 * and loads nothing but images, as a second line of defence.
 */

/** Below this much text, or this many real paragraphs, the page has no article to show. */
export const READER_MIN_CHARS = 600;
export const READER_MIN_PARAGRAPHS = 3;

/** What `readerArticle` returns; `ok` says whether it passed the thresholds above. */
export type ReaderArticle = {
  ok: boolean;
  title: string;
  byline: string;
  /** Publication date as found in the page (ISO or similar), or ''. */
  published: string;
  siteName: string;
  lang: string;
  dir: 'ltr' | 'rtl';
  url: string;
  /** The article body: allowlisted HTML whose read-aloud blocks carry data-s="n". */
  html: string;
  /** Read-aloud blocks in order: [0] is the title, [n] the block with data-s="n". */
  speech: string[];
  chars: number;
  paragraphs: number;
  images: number;
};

export type ReaderTheme = 'auto' | 'light' | 'dark' | 'sepia';
export type ReaderFont = 'serif' | 'sans';
export const READER_THEMES: ReaderTheme[] = ['auto', 'light', 'dark', 'sepia'];
export const READER_FONTS: ReaderFont[] = ['serif', 'sans'];

/** The reader's look, from settings and the system. */
export type ReaderLook = {
  /** 'auto' already resolved against the app's appearance. */
  scheme: 'light' | 'dark' | 'sepia';
  font: ReaderFont;
  /** Wider letter, word and line spacing (and Verdana where the system has it), for dyslexic readers. */
  easyReading: boolean;
  /** The app's text size setting in percent (shared with web pages). */
  textZoom: number;
  /** The system's font scale (large accessibility text sizes). */
  fontScale: number;
  reduceMotion: boolean;
};

export type ReaderColors = {
  bg: string;
  text: string;
  /** Byline, captions; 4.5:1 or better on bg and on the highlight. */
  muted: string;
  link: string;
  /** The paragraph being read aloud (with a link-coloured bar at its side). */
  mark: string;
  code: string;
  border: string;
  /** The reader's toolbar. */
  bar: string;
};

/**
 * Measured contrast (WCAG): light text 16.1:1, muted 6.5:1, links 6.1:1; dark text 14.0:1, muted 7.3:1,
 * links 7.8:1; sepia text 11.0:1, muted 5.6:1, links 5.8:1. Text, muted text and links stay above
 * 4.5:1 on the read-aloud highlight and on code backgrounds too.
 */
export const READER_COLORS: Record<ReaderLook['scheme'], ReaderColors> = {
  light: {
    bg: '#fdfcf9',
    text: '#1f1f1f',
    muted: '#5f5c56',
    link: '#1460b4',
    mark: '#fbe9a6',
    code: '#efede6',
    border: '#e0ddd4',
    bar: '#f5f4ef',
  },
  dark: {
    bg: '#1c1b22',
    text: '#e9e8ee',
    muted: '#a9a8b3',
    link: '#5cb8f0',
    mark: '#3d3620',
    code: '#2b2a33',
    border: '#3a3944',
    bar: '#24232b',
  },
  sepia: {
    bg: '#f4ecd8',
    text: '#3b2f22',
    muted: '#6b5a46',
    link: '#8a4b0f',
    mark: '#ecdcab',
    code: '#ebe1c6',
    border: '#dccfae',
    bar: '#ece2c9',
  },
};

export function resolveReaderScheme(theme: ReaderTheme, dark: boolean): ReaderLook['scheme'] {
  if (theme === 'auto') return dark ? 'dark' : 'light';
  return theme;
}

/** Base reading size in CSS pixels at 100% text size and the default system font scale. */
const BASE_FONT_PX = 19;

export function readerFontPx(look: Pick<ReaderLook, 'textZoom' | 'fontScale'>): number {
  return Math.round(BASE_FONT_PX * (look.textZoom / 100) * Math.max(1, look.fontScale) * 10) / 10;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function themeCss(): string {
  return (Object.keys(READER_COLORS) as ReaderLook['scheme'][])
    .map((scheme) => {
      const c = READER_COLORS[scheme];
      return `html[data-scheme="${scheme}"]{--bg:${c.bg};--text:${c.text};--muted:${c.muted};--link:${c.link};--mark:${c.mark};--code:${c.code};--border:${c.border};color-scheme:${scheme === 'dark' ? 'dark' : 'light'}}`;
    })
    .join('\n');
}

const READER_CSS = `
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font-size:var(--size);line-height:1.65;
  font-family:Charter,"Iowan Old Style",Georgia,"Noto Serif",serif;overflow-wrap:break-word;-webkit-tap-highlight-color:transparent}
html[data-font="sans"] body{font-family:-apple-system,system-ui,Roboto,"Noto Sans","Segoe UI",sans-serif}
html[data-easy="1"] body{font-family:Verdana,-apple-system,system-ui,Roboto,sans-serif;letter-spacing:.05em;word-spacing:.16em;line-height:1.9}
html[data-easy="1"] em,html[data-easy="1"] i{font-style:normal;font-weight:600}
main{max-width:34em;margin:0 auto;padding:20px 20px 96px}
header{margin-bottom:1.6em;padding-bottom:1em;border-bottom:1px solid var(--border)}
.site{font-family:-apple-system,system-ui,Roboto,sans-serif;font-size:.8em;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:0 0 .6em}
h1{font-size:1.6em;line-height:1.25;margin:0 0 .5em}
.meta{font-family:-apple-system,system-ui,Roboto,sans-serif;font-size:.85em;color:var(--muted);margin:0}
h2{font-size:1.3em;line-height:1.3;margin:1.6em 0 .6em}
h3{font-size:1.15em;line-height:1.35;margin:1.4em 0 .5em}
h4,h5,h6{font-size:1em;margin:1.2em 0 .4em}
p,ul,ol,dl,blockquote,figure,pre,table{margin:0 0 1.1em}
html[data-easy="1"] p{margin-bottom:1.5em}
ul,ol{padding-inline-start:1.4em}
li{margin:.3em 0}
a{color:var(--link);text-decoration:underline;text-underline-offset:.15em}
img{display:block;max-width:100%;height:auto;margin:0 auto;border-radius:4px}
figure{margin-inline:0}
figcaption{font-size:.85em;color:var(--muted);margin-top:.5em;line-height:1.5}
blockquote{margin-inline:0;padding-inline-start:1em;border-inline-start:3px solid var(--border);color:var(--text);font-style:italic}
pre,code,kbd,samp{font-family:ui-monospace,Menlo,"Roboto Mono",monospace;font-size:.85em}
code,kbd{background:var(--code);border-radius:4px;padding:.1em .3em}
pre{background:var(--code);border-radius:6px;padding:.8em 1em;overflow-x:auto;white-space:pre;line-height:1.5}
table{border-collapse:collapse;display:block;overflow-x:auto;font-size:.9em;max-width:100%}
th,td{border:1px solid var(--border);padding:.4em .6em;text-align:start;vertical-align:top}
hr{border:0;border-top:1px solid var(--border);margin:2em 0}
.qr-speaking{background:var(--mark);box-shadow:-6px 0 0 var(--mark),6px 0 0 var(--mark),-9px 0 0 var(--link);border-radius:2px;transition:background-color .2s}
html[data-motion="reduce"] .qr-speaking{transition:none}
mark[data-qutai-find]{color:inherit}
`;

/**
 * The reader document. Nothing in it can run script: the article HTML is allowlisted by the page
 * script and the policy allows no script at all (the app's own scripts are injected by the WebView,
 * which the policy doesn't govern). Only images load; no fonts, frames, media or requests.
 */
export function readerDocument(article: ReaderArticle, look: ReaderLook, meta: string): string {
  const csp =
    "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
  const lang = /^[a-z]{2,3}(-[a-z0-9-]+)?$/i.test(article.lang) ? article.lang : '';
  return `<!DOCTYPE html>
<html${lang ? ` lang="${lang}"` : ''} dir="${article.dir === 'rtl' ? 'rtl' : 'ltr'}" ${lookAttributes(look)}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(article.title)}</title>
<style>${themeCss()}${READER_CSS}</style>
</head>
<body>
<main>
<header>
${article.siteName ? `<p class="site">${escapeHtml(article.siteName)}</p>` : ''}
<h1 data-s="0">${escapeHtml(article.title)}</h1>
${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ''}
</header>
<article>${article.html}</article>
</main>
</body>
</html>`;
}

function lookAttributes(look: ReaderLook): string {
  return [
    `data-scheme="${look.scheme}"`,
    `data-font="${look.font}"`,
    `data-easy="${look.easyReading ? 1 : 0}"`,
    `data-motion="${look.reduceMotion ? 'reduce' : 'full'}"`,
    `style="--size:${readerFontPx(look)}px"`,
  ].join(' ');
}

/** Applies a new look to the open reader document without reloading it (the scroll position stays). */
export function readerLookScript(look: ReaderLook): string {
  return `(function () {
  var d = document.documentElement;
  d.setAttribute('data-scheme', ${JSON.stringify(look.scheme)});
  d.setAttribute('data-font', ${JSON.stringify(look.font)});
  d.setAttribute('data-easy', ${JSON.stringify(look.easyReading ? '1' : '0')});
  d.setAttribute('data-motion', ${JSON.stringify(look.reduceMotion ? 'reduce' : 'full')});
  d.style.setProperty('--size', ${JSON.stringify(`${readerFontPx(look)}px`)});
})(); true;`;
}

/** Highlights the block being read aloud (-1: none) and scrolls it into view when it is off screen. */
export function readerHighlightScript(index: number, reduceMotion: boolean): string {
  return `(function () {
  var old = document.querySelectorAll('.qr-speaking');
  for (var i = 0; i < old.length; i++) old[i].classList.remove('qr-speaking');
  var el = ${index} >= 0 ? document.querySelector('[data-s="${Math.floor(index)}"]') : null;
  if (!el) return;
  el.classList.add('qr-speaking');
  var r = el.getBoundingClientRect();
  if (r.top < 24 || r.bottom > window.innerHeight - 24) {
    el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: ${reduceMotion ? "'auto'" : "'smooth'"} });
  }
})(); true;`;
}

/** Injected into the reader WebView: reports text selections like a page does (Ask / Explain / Translate). */
export const READER_SETUP_SCRIPT = SELECTION_SCRIPT;

/** "Jane Doe · 2 October 2026" from the byline and a parsed publication date. */
export function readerMetaLine(article: ReaderArticle, formatDate: (date: Date) => string): string {
  const parts: string[] = [];
  if (article.byline) parts.push(article.byline);
  const time = Date.parse(article.published);
  if (!Number.isNaN(time)) parts.push(formatDate(new Date(time)));
  return parts.join(' · ');
}

/** The page address without its #fragment, to tell a new page from a jump within the same one. */
export function pageKey(url: string): string {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}
