/**
 * The static check for scripts (docs/page-customisation.md › Scripts › The static check). Pure code: no React Native,
 * also runs in Node.
 *
 * A tokenizer for JavaScript (strings, template literals, comments, regular expressions, Unicode line terminators),
 * then rules over the tokens. It refuses code that loads or makes code, uses network channels other than the guarded
 * fetch, reads cookies or secrets, leaves the page or the frame, presses or submits, touches Qutai's own objects, or
 * hides what it does; and it raises flags (shown in red in the approval) for what may run but the user should know.
 *
 * It also guarantees the code can't break out of the function it is wrapped in (content/userScripts.ts wrapScript):
 * brackets must balance, and every place where this tokenizer and a JavaScript engine could read the code
 * differently is refused rather than guessed.
 *
 * This is a filter, not a sandbox: a determined author can hide behaviour in data-driven code. The approval with the
 * code shown, and the sealed copy for read-only work, are what the user relies on.
 */

/** Where a script runs: a sealed copy of the page, the live page (one-off), or the live page as a kept script. */
export type ScriptMode = 'copy' | 'page' | 'kept';

/** What an allowed script does that the user should know (red lines in the approval). */
export type ScriptFlag = 'changesPage' | 'loads' | 'network' | 'storage' | 'fields';

export const SCRIPT_FLAGS: readonly ScriptFlag[] = ['changesPage', 'loads', 'network', 'storage', 'fields'];

export const MAX_SCRIPT_BYTES = 16 * 1024;
export const MAX_SCRIPT_LINES = 400;

export type ScriptCheck =
  | { ok: true; code: string; flags: ScriptFlag[] }
  | { ok: false; problems: string[] };

type TokenType = 'id' | 'punct' | 'str' | 'tmpl' | 'num' | 'regex';
type Token = { type: TokenType; value: string; line: number };

class Refused extends Error {}

const KEYWORDS_BEFORE_EXPRESSION = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
]);
/** Words that are keywords in some places and names in others: a "/" after them is ambiguous. */
const CONTEXTUAL = new Set(['await', 'yield', 'of', 'let', 'async', 'get', 'set', 'static']);
const PUNCTUATORS = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '<<', '>>', '**',
  '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%', '&', '|', '^', '!', '~', '?', ':', '=',
  '.', '@',
];
const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;
// Invisible and direction-changing characters would make the code the user reads differ from the code that runs.
const HIDDEN_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufff9-\ufffb]/;
const ID_START = /[\p{ID_Start}$_]/u;
const ID_PART = /[\p{ID_Continue}$\u200c\u200d]/u;

/** Splits code into tokens; throws Refused with the reason when the code can't be read safely. */
export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  // Open brackets; '${' marks a template substitution. For '(' : whether it follows if / while / for / with.
  const stack: { ch: string; control: boolean }[] = [];
  let i = 0;
  let line = 1;
  const n = code.length;
  // Anywhere, strings and comments included: what the user reads in the approval must be what runs.
  const hidden = HIDDEN_CHARS.exec(code);
  if (hidden) throw new Refused(`line ${code.slice(0, hidden.index).split(/\r\n|[\n\r\u2028\u2029]/).length}: invisible or direction-changing characters`);
  const last = () => tokens[tokens.length - 1];
  const fail = (why: string): never => {
    throw new Refused(`line ${line}: ${why}`);
  };
  const isTerm = (ch: string) => LINE_TERMINATOR.test(ch);

  /** Reads an escape after "\" in a string or template; returns the character(s) and whether it spells plain ASCII. */
  const escape = (): string => {
    const ch = code[i];
    if (ch === undefined) return fail('unfinished text');
    if (ch === '\r') {
      i += code[i + 1] === '\n' ? 2 : 1;
      line++;
      return '';
    }
    if (isTerm(ch)) {
      i++;
      line++;
      return '';
    }
    const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' };
    if (ch in simple && !(ch === '0' && /[0-9]/.test(code[i + 1] ?? ''))) {
      i++;
      return simple[ch];
    }
    let cp = 0;
    if (ch === 'x') {
      const hex = code.slice(i + 1, i + 3);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) fail('a broken \\x escape');
      cp = parseInt(hex, 16);
      i += 3;
    } else if (ch === 'u') {
      if (code[i + 1] === '{') {
        const end = code.indexOf('}', i + 2);
        const hex = end < 0 ? '' : code.slice(i + 2, end);
        if (!/^[0-9a-fA-F]{1,6}$/.test(hex)) fail('a broken \\u escape');
        cp = parseInt(hex, 16);
        i = end + 1;
      } else {
        const hex = code.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('a broken \\u escape');
        cp = parseInt(hex, 16);
        i += 5;
      }
    } else if (/[1-9]/.test(ch)) {
      fail('octal escapes');
    } else {
      i++;
      return ch;
    }
    if (cp > 0x10ffff) fail('a broken escape');
    // Letters, digits and printable ASCII written as escapes only serve to hide words ('\x66etch').
    if (cp >= 0x20 && cp < 0x7f) fail(`an escape that spells "${String.fromCodePoint(cp)}": write the character itself`);
    return String.fromCodePoint(cp);
  };

  const readString = (quote: string) => {
    i++;
    let value = '';
    for (;;) {
      const ch = code[i];
      if (ch === undefined) fail('unfinished text in quotes');
      if (ch === quote) {
        i++;
        break;
      }
      if (ch === '\\') {
        i++;
        value += escape();
        continue;
      }
      if (ch === '\n' || ch === '\r') fail('a line break inside quotes');
      value += ch;
      i++;
    }
    tokens.push({ type: 'str', value, line });
  };

  /** Template text up to "`" (the template ends) or "${" (a substitution starts). */
  const readTemplateText = () => {
    let value = '';
    for (;;) {
      const ch = code[i];
      if (ch === undefined) fail('an unfinished template');
      if (ch === '`') {
        i++;
        tokens.push({ type: 'tmpl', value, line });
        return;
      }
      if (ch === '$' && code[i + 1] === '{') {
        i += 2;
        tokens.push({ type: 'tmpl', value, line });
        stack.push({ ch: '${', control: false });
        return;
      }
      if (ch === '\\') {
        i++;
        value += escape();
        continue;
      }
      if (isTerm(ch)) line++;
      value += ch;
      i++;
    }
  };

  const readRegex = () => {
    const start = i;
    i++;
    let inClass = false;
    for (;;) {
      const ch = code[i];
      if (ch === undefined || isTerm(ch)) fail('an unfinished regular expression');
      if (ch === '\\') {
        if (code[i + 1] === undefined || isTerm(code[i + 1])) fail('an unfinished regular expression');
        i += 2;
        continue;
      }
      if (ch === '[') inClass = true;
      else if (ch === ']') inClass = false;
      else if (ch === '/' && !inClass) {
        i++;
        break;
      }
      i++;
    }
    while (i < n && /[a-z]/i.test(code[i])) i++;
    tokens.push({ type: 'regex', value: code.slice(start, i), line });
  };

  /** Whether a "/" here starts a regular expression; throws where the engine's choice can't be known. */
  const slashStartsRegex = (): boolean => {
    const prev = last();
    if (!prev) return true;
    if (prev.type === 'num' || prev.type === 'str' || prev.type === 'regex') return false;
    if (prev.type === 'tmpl') return !templateEnded(prev);
    if (prev.type === 'id') {
      if (KEYWORDS_BEFORE_EXPRESSION.has(prev.value)) return true;
      if (CONTEXTUAL.has(prev.value)) fail(`a "/" right after "${prev.value}" (put it in parentheses)`);
      return false;
    }
    switch (prev.value) {
      case ']':
        return false;
      case '}':
        return fail('a "/" right after "}" (end the statement with ";" or wrap it in parentheses)');
      case '++':
      case '--':
        return fail(`a "/" right after "${prev.value}"`);
      case ')':
        return closedControl;
      default:
        return true;
    }
  };
  // Whether the last ")" closed the condition of if / while / for / with (a "/" after it starts a regular expression).
  let closedControl = false;
  // Template tokens that end their template ("`" read) versus ones that open a substitution.
  const ended = new WeakSet<Token>();
  const templateEnded = (tok: Token) => ended.has(tok);

  while (i < n) {
    const ch = code[i];
    if (HIDDEN_CHARS.test(ch)) fail('invisible or direction-changing characters');
    if (ch === '\n' || ch === '\u2028' || ch === '\u2029' || (ch === '\r' && code[i + 1] !== '\n')) {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(ch) || ch === '\ufeff') {
      i++;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      while (i < n && !isTerm(code[i])) i++;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end < 0) fail('an unfinished comment');
      for (const c of code.slice(i, end)) if (isTerm(c)) line++;
      i = end + 2;
      continue;
    }
    if (code.startsWith('<!--', i) || code.startsWith('-->', i)) fail('"<!--" or "-->" (old HTML comments in scripts)');
    if (ch === '#' && i === 0 && code[1] === '!') fail('a "#!" line');
    if (ch === '\\') fail('a backslash outside quotes (escaped names)');
    if (ch === '"' || ch === "'") {
      readString(ch);
      closedControl = false;
      continue;
    }
    if (ch === '`') {
      i++;
      const before = tokens.length;
      readTemplateText();
      const tok = tokens[before];
      if (tok && code[i - 1] === '`') ended.add(tok);
      closedControl = false;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(code[i + 1] ?? ''))) {
      const start = i;
      i++;
      while (i < n && /[0-9a-zA-Z_.]/.test(code[i])) {
        if ((code[i] === 'e' || code[i] === 'E') && (code[i + 1] === '+' || code[i + 1] === '-')) i++;
        i++;
      }
      tokens.push({ type: 'num', value: code.slice(start, i), line });
      closedControl = false;
      continue;
    }
    if (ID_START.test(ch) || ch === '#') {
      const start = i;
      i++;
      while (i < n && ID_PART.test(code[i])) i++;
      if (code[i] === '\\') fail('a backslash in a name (escaped names)');
      tokens.push({ type: 'id', value: code.slice(start, i), line });
      closedControl = false;
      continue;
    }
    if (ch === '/' && slashStartsRegex()) {
      readRegex();
      closedControl = false;
      continue;
    }
    const punct = PUNCTUATORS.find((p) => code.startsWith(p, i));
    if (!punct) fail(`an unexpected character "${ch}"`);
    i += punct!.length;
    const p = punct!;
    if (p === '(' || p === '[' || p === '{') {
      const prev = last();
      const before = tokens[tokens.length - 2];
      const control =
        p === '(' &&
        !!prev &&
        prev.type === 'id' &&
        (['if', 'while', 'for', 'with'].includes(prev.value) ||
          (prev.value === 'await' && before?.type === 'id' && before.value === 'for'));
      stack.push({ ch: p, control });
      tokens.push({ type: 'punct', value: p, line });
      closedControl = false;
      continue;
    }
    if (p === ')' || p === ']' || p === '}') {
      const open = stack.pop();
      if (!open) fail(`a "${p}" without its opening bracket`);
      if (open!.ch === '${') {
        if (p !== '}') fail('brackets that don\'t match');
        // Back in the template's text.
        const before = tokens.length;
        readTemplateText();
        const tok = tokens[before];
        if (tok && code[i - 1] === '`') ended.add(tok);
        closedControl = false;
        continue;
      }
      const expected = open!.ch === '(' ? ')' : open!.ch === '[' ? ']' : '}';
      if (p !== expected) fail('brackets that don\'t match');
      tokens.push({ type: 'punct', value: p, line });
      closedControl = p === ')' && open!.control;
      continue;
    }
    tokens.push({ type: 'punct', value: p, line });
    closedControl = false;
  }
  if (stack.length) fail('brackets that are not closed');
  return tokens;
}

// ---------- Rules ----------

/** Names refused wherever they appear (as a name or a property). */
const FORBIDDEN_NAMES = new Map<string, string>(Object.entries({
  eval: 'eval (running text as code)',
  Function: 'Function (making code from text)',
  constructor: '.constructor (a way to make code from text)',
  importScripts: 'importScripts (loading code)',
  Worker: 'workers',
  SharedWorker: 'workers',
  serviceWorker: 'service workers',
  WebAssembly: 'WebAssembly',
  XMLHttpRequest: 'XMLHttpRequest (use fetch, which Qutai guards)',
  sendBeacon: 'sendBeacon (sending data)',
  WebSocket: 'WebSocket (sending data)',
  EventSource: 'EventSource',
  WebTransport: 'WebTransport',
  cookie: 'cookies (never readable by scripts in Qutai)',
  cookieStore: 'cookies (never readable by scripts in Qutai)',
  createObjectURL: 'createObjectURL (a way to load made-up code)',
  srcdoc: 'srcdoc (frames with their own code)',
  contentWindow: 'frames (scripts stay in the main frame)',
  contentDocument: 'frames (scripts stay in the main frame)',
  frameElement: 'frames (scripts stay in the main frame)',
  defaultView: 'defaultView (a way around the checks)',
  opener: 'the window that opened this one',
  postMessage: 'postMessage (talking to other windows or to Qutai)',
  ReactNativeWebView: "Qutai's own bridge",
  messageHandlers: "the app's own bridge",
  submit: 'submitting forms (use the click tool, where approvals apply)',
  requestSubmit: 'submitting forms (use the click tool, where approvals apply)',
  dispatchEvent: 'made-up events (use the click and type tools)',
  clipboard: 'the clipboard',
  execCommand: 'execCommand (clipboard and editing commands)',
  click: 'pressing buttons or links (use the click tool, where approvals apply)',
  write: 'document.write (it can load code)',
  writeln: 'document.write (it can load code)',
  Reflect: 'Reflect (a way around the checks)',
  Proxy: 'Proxy (a way around the checks)',
  __defineGetter__: 'a way around the checks',
  __lookupGetter__: 'a way around the checks',
  getOwnPropertyDescriptor: 'a way around the checks',
  getOwnPropertyDescriptors: 'a way around the checks',
  atob: 'atob (hidden text)',
  fromCharCode: 'fromCharCode (hidden text)',
  fromCodePoint: 'fromCodePoint (hidden text)',
  unescape: 'unescape (hidden text)',
  showModalDialog: 'opening windows',
  RTCPeerConnection: 'WebRTC (sending data)',
  webkitRTCPeerConnection: 'WebRTC (sending data)',
  RTCDataChannel: 'WebRTC (sending data)',
  RTCIceCandidate: 'WebRTC (sending data)',
  Notification: 'notifications',
  geolocation: 'the location',
  getUserMedia: 'the camera or microphone',
  mediaDevices: 'the camera or microphone',
  credentials: 'saved passwords',
  globalThis: 'globalThis (a way around the checks)',
  import: 'import (loading code)',
  with: '"with"',
  debugger: '"debugger"',
}));
// An object literal's "__proto__:" sets the prototype instead of making a key, so this one is added on its own.
FORBIDDEN_NAMES.set('__proto__', '__proto__ (a way around the checks)');

/** Global objects: only `name.property` with a plain property is allowed (not computed, not as a value). */
const GLOBAL_OBJECTS = new Set(['window', 'self', 'document', 'navigator', 'location', 'top', 'parent', 'frames']);
/** Bare names refused (they are the window under another name): rename a variable that has one of them. */
const WINDOW_ALIASES = new Set(['self', 'top', 'parent', 'frames']);
/** Names reached only through Qutai's guard: never as a property of the window. */
const GUARDED = new Set(['fetch', 'setTimeout', 'setInterval', 'pageUrl']);
/** Properties of the window that leave or open pages. */
const WINDOW_LEAVING = new Set(['open', 'close', 'stop', 'print', 'alert', 'confirm', 'prompt', 'location', 'history', 'name']);

const NAVIGATOR_ONLY = new Set(['credentials', 'geolocation', 'clipboard', 'mediaDevices']);
/** Words before "[" that start an array literal, not an index. */
const NOT_OBJECTS = new Set(['return', 'typeof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'await', 'yield', 'instanceof']);
const STORAGE = new Set(['localStorage', 'sessionStorage', 'indexedDB', 'caches', 'storage']);
const DOM_WRITE_METHODS = new Set([
  'appendChild', 'append', 'prepend', 'after', 'before', 'replaceWith', 'replaceChildren', 'insertBefore', 'removeChild',
  'remove', 'replaceChild', 'setAttribute', 'setAttributeNS', 'removeAttribute', 'toggleAttribute', 'insertAdjacentHTML',
  'insertAdjacentElement', 'insertAdjacentText', 'attachShadow', 'pushState', 'replaceState', 'setProperty',
  'removeProperty', 'setHTMLUnsafe', 'showPopover', 'hidePopover', 'showModal',
]);
const DOM_WRITE_PROPS = new Set([
  'innerHTML', 'outerHTML', 'textContent', 'innerText', 'outerText', 'nodeValue', 'className', 'id', 'title', 'hidden',
  'checked', 'value', 'disabled', 'selected', 'selectedIndex', 'style', 'cssText', 'contentEditable', 'designMode',
  'dir', 'lang', 'data', 'open', 'placeholder', 'alt', 'width', 'height', 'scrollTop', 'scrollLeft',
]);
const LOADING_PROPS = new Set(['src', 'srcset', 'href', 'action', 'formAction', 'poster', 'background', 'data', 'codebase']);
const LOADING_ATTRS = new Set(['src', 'srcset', 'href', 'action', 'formaction', 'poster', 'background', 'data', 'xlink:href', 'ping', 'style']);
const FORBIDDEN_TAGS = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'link', 'meta', 'base', 'portal', 'applet']);
const DANGEROUS_TEXT: [RegExp, string][] = [
  [/<\s*(script|iframe|frame|object|embed|link|meta|base|portal)\b/i, 'markup that loads code or frames'],
  [/(java|vb)script\s*:/i, 'javascript: addresses'],
  [/<[^>]*\son[a-z]+\s*=/i, 'inline event handlers in markup'],
  [/password/i, 'password fields'],
  [/one-time-code/i, 'one-time code fields'],
  [/srcdoc/i, 'srcdoc'],
];

/** The engine's view of `.name` property tokens: an id right after "." or "?.". */
function isProperty(tokens: Token[], k: number): boolean {
  const prev = tokens[k - 1];
  return !!prev && prev.type === 'punct' && (prev.value === '.' || prev.value === '?.');
}

/** An object-literal key or a destructuring name ("{ top: 1 }"), not a use of the global. */
function isKey(tokens: Token[], k: number): boolean {
  const next = tokens[k + 1];
  const prev = tokens[k - 1];
  return !!next && next.type === 'punct' && next.value === ':' && !!prev && prev.type === 'punct' && (prev.value === '{' || prev.value === ',');
}

function isAssignment(tok: Token | undefined): boolean {
  return !!tok && tok.type === 'punct' && /^(=|\+=|-=|\*=|\/=|%=|\*\*=|<<=|>>=|>>>=|&=|\|=|\^=|&&=|\|\|=|\?\?=)$/.test(tok.value);
}

const at = (tokens: Token[], k: number, value: string) => tokens[k]?.type === 'punct' && tokens[k].value === value;

/**
 * Checks a script for `mode`. ok: the code exactly as given (never rewritten: the user approves what runs) and its
 * flags. Otherwise every problem found (for the model to fix), at most eight.
 */
export function checkScript(code: unknown, mode: ScriptMode): ScriptCheck {
  if (typeof code !== 'string' || !code.trim()) return { ok: false, problems: ['no code'] };
  const bytes = new TextEncoder().encode(code).length;
  if (bytes > MAX_SCRIPT_BYTES) return { ok: false, problems: [`the script is ${Math.ceil(bytes / 1024)} KB; at most 16 KB`] };
  if (code.split(/\r\n|[\n\r\u2028\u2029]/).length > MAX_SCRIPT_LINES) return { ok: false, problems: [`more than ${MAX_SCRIPT_LINES} lines`] };
  let tokens: Token[];
  try {
    tokens = tokenize(code);
  } catch (e) {
    return { ok: false, problems: [e instanceof Refused ? `can't be read safely: ${e.message}` : 'can\'t be read'] };
  }
  const problems = new Set<string>();
  const flags = new Set<ScriptFlag>();
  const refuse = (tok: Token, why: string) => problems.add(`line ${tok.line}: ${why}`);

  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    const prev = tokens[k - 1];
    const next = tokens[k + 1];
    if (tok.type === 'str' || tok.type === 'tmpl') {
      for (const [pattern, why] of DANGEROUS_TEXT) if (pattern.test(tok.value)) refuse(tok, `text naming ${why}`);
      // 'coo' + 'kie': joined text hides names.
      if (tok.type === 'str' && at(tokens, k + 1, '+') && tokens[k + 2]?.type === 'str') refuse(tok, 'text joined from pieces (write it whole)');
      // A computed key in quotes counts as the property it names.
      if (tok.type === 'str' && prev && at(tokens, k - 1, '[') && at(tokens, k + 1, ']')) checkName(tok.value, true, k);
      continue;
    }
    if (tok.type === 'punct' && tok.value === '[' && prev) {
      // Computed keys built from pieces: x['a' + b], x[`…${…}`].
      const close = matching(tokens, k);
      const inside = tokens.slice(k + 1, close);
      const indexing =
        (prev.type === 'id' && !NOT_OBJECTS.has(prev.value)) ||
        (prev.type === 'punct' && (prev.value === ')' || prev.value === ']' || prev.value === '?.'));
      if (indexing && inside.some((t) => (t.type === 'punct' && t.value === '+') || t.type === 'tmpl'))
        refuse(tok, 'a property name built from pieces');
      continue;
    }
    if (tok.type !== 'id') continue;
    const property = isProperty(tokens, k);
    checkName(tok.value, property, k);
    if (tok.value === 'this' && at(tokens, k + 1, '[')) refuse(tok, 'this[…] (a way around the checks)');
    if (prev?.type === 'id' && prev.value === 'new' && (tok.value === 'Image' || tok.value === 'Audio')) flags.add('loads');

    // Global objects: only window.<plain name>.
    if (!property && GLOBAL_OBJECTS.has(tok.value) && !isKey(tokens, k)) {
      if (WINDOW_ALIASES.has(tok.value)) {
        refuse(tok, `"${tok.value}" (it is the window under another name; rename a variable called that)`);
      } else if (!(next && next.type === 'punct' && (next.value === '.' || next.value === '?.'))) {
        refuse(tok, `"${tok.value}" used other than as ${tok.value}.something (computed or passed on, it can't be checked)`);
      } else {
        const member = tokens[k + 2];
        if (member?.type === 'id') {
          if (tok.value === 'window' && (GUARDED.has(member.value) || WINDOW_LEAVING.has(member.value)))
            refuse(member, member.value === 'location' ? 'changing the address (use the navigate tool)' : `window.${member.value} (use ${GUARDED.has(member.value) ? member.value : 'the tools'} directly)`);
          if (tok.value === 'window' && GLOBAL_OBJECTS.has(member.value) && member.value !== 'document' && member.value !== 'navigator' && member.value !== 'location')
            refuse(member, `window.${member.value}`);
          if (tok.value === 'document' && (member.value === 'open' || member.value === 'close' || member.value === 'location'))
            refuse(member, member.value === 'location' ? 'changing the address (use the navigate tool)' : `document.${member.value}`);
        }
      }
    }
    // Navigation: location = …, location.href = …, location.assign/replace/reload(…), history.back/forward/go(…).
    if (tok.value === 'location' && !isKey(tokens, k)) {
      if (isAssignment(next)) refuse(tok, 'changing the address (use the navigate tool)');
      const member = tokens[k + 2];
      if (at(tokens, k + 1, '.') && member?.type === 'id') {
        if (['assign', 'replace', 'reload'].includes(member.value) && at(tokens, k + 3, '('))
          refuse(member, 'leaving the page (use the navigate tool)');
        if (isAssignment(tokens[k + 3])) refuse(member, 'changing the address (use the navigate tool)');
      }
    }
    if (tok.value === 'history' && at(tokens, k + 1, '.') && ['back', 'forward', 'go'].includes(tokens[k + 2]?.value ?? ''))
      refuse(tok, 'leaving the page (use the go_back tool)');
    if (!property && tok.value === 'open' && at(tokens, k + 1, '(')) refuse(tok, 'opening windows');
    // Made-up input events.
    if (prev?.type === 'id' && prev.value === 'new' && /^(Mouse|Pointer|Keyboard|Submit|Input|Touch|Focus|Composition|Drag|Wheel|Clipboard)Event$/.test(tok.value))
      refuse(tok, 'made-up input events (use the click and type tools)');
    // createElement('script'…) and computed tags.
    if (property && (tok.value === 'createElement' || tok.value === 'createElementNS') && at(tokens, k + 1, '(')) {
      const arg = tok.value === 'createElement' ? tokens[k + 2] : tokens[k + 4];
      const argEnd = tok.value === 'createElement' ? tokens[k + 3] : tokens[k + 5];
      if (!arg || arg.type !== 'str' || !argEnd || argEnd.type !== 'punct' || (argEnd.value !== ')' && argEnd.value !== ','))
        refuse(tok, 'createElement with a tag that is not written out');
      else if (FORBIDDEN_TAGS.has(arg.value.trim().toLowerCase())) refuse(tok, `creating <${arg.value}> elements`);
    }
    // String timers.
    if (!property && (tok.value === 'setTimeout' || tok.value === 'setInterval') && at(tokens, k + 1, '(')) {
      const arg = tokens[k + 2];
      if (arg && (arg.type === 'str' || arg.type === 'tmpl')) refuse(tok, `${tok.value} with text (give it a function)`);
    }
    // Flags.
    if (!property && tok.value === 'fetch') {
      flags.add('network');
      // The guard allows this site only; a full address in the code is refused here already, so the user never
      // approves a script whose fetch can only fail (or that names another site).
      const arg = tokens[k + 2];
      if (at(tokens, k + 1, '(') && arg && (arg.type === 'str' || arg.type === 'tmpl') && /^\s*(https?:|\/\/)/i.test(arg.value))
        refuse(tok, 'fetch with a full address (give a path on this site, such as /api/items)');
    }
    if (property && tok.value === 'fetch') refuse(tok, 'fetch reached as a property (call fetch directly: Qutai guards it)');
    if (STORAGE.has(tok.value) && (property || !isKey(tokens, k)) && (tok.value !== 'storage' || (prev && at(tokens, k - 1, '.') && tokens[k - 2]?.value === 'navigator')))
      flags.add('storage');
    if (property && tok.value === 'value') flags.add('fields');
    if (property && DOM_WRITE_METHODS.has(tok.value) && at(tokens, k + 1, '(')) flags.add('changesPage');
    if (property && DOM_WRITE_PROPS.has(tok.value) && (isAssignment(next) || (tok.value === 'style' && at(tokens, k + 1, '.')))) {
      if (tok.value !== 'style' || isAssignment(tokens[k + 3]) || isAssignment(next)) flags.add('changesPage');
    }
    if (property && tok.value === 'classList' && at(tokens, k + 1, '.')) {
      const m = tokens[k + 2]?.value ?? '';
      if (['add', 'remove', 'toggle', 'replace'].includes(m)) flags.add('changesPage');
    }
    if (property && LOADING_PROPS.has(tok.value) && isAssignment(next)) {
      flags.add('loads');
      flags.add('changesPage');
      if (FULL_ADDRESS.test(literalAt(tokens, k + 2))) refuse(tok, 'making the page load a full address (that can carry data to another site)');
    }
    if (property && (tok.value === 'setAttribute' || tok.value === 'setAttributeNS') && at(tokens, k + 1, '(')) {
      const arg = tok.value === 'setAttribute' ? tokens[k + 2] : tokens[k + 4];
      if (!arg || arg.type !== 'str') flags.add('loads');
      else if (LOADING_ATTRS.has(arg.value.toLowerCase()) || /^on/i.test(arg.value)) {
        if (/^on/i.test(arg.value)) refuse(tok, 'setting event handler attributes');
        flags.add('loads');
        const value = tok.value === 'setAttribute' ? literalAt(tokens, k + 4) : literalAt(tokens, k + 6);
        if (FULL_ADDRESS.test(value)) refuse(tok, 'making the page load a full address (that can carry data to another site)');
      }
    }
    if (property && (tok.value === 'innerHTML' || tok.value === 'outerHTML') && isAssignment(next)) flags.add('loads');
    if (property && tok.value === 'insertAdjacentHTML') flags.add('loads');
  }

  function checkName(name: string, property: boolean, k: number) {
    const tok = tokens[k];
    if (name.startsWith('__qutai')) refuse(tok, "Qutai's own page objects");
    if (name === 'webkit' && !property) refuse(tok, "the app's own bridge");
    // Only dangerous as navigator.<name>; a local variable or an option key with that name is not.
    if (NAVIGATOR_ONLY.has(name)) {
      if (property && tokens[k - 2]?.value === 'navigator') refuse(tok, FORBIDDEN_NAMES.get(name)!);
      return;
    }
    // A class's constructor method (not .constructor or { constructor: … }).
    if (name === 'constructor' && !property && !isKey(tokens, k)) return;
    if (property && name === 'open') {
      if (at(tokens, k + 1, '(') || at(tokens, k + 1, '.')) refuse(tok, 'opening windows or documents');
      return;
    }
    if (property && name === 'view') refuse(tok, '.view (the window of an event: a way around the checks)');
    if (property && (name === 'with' || name === 'import' || name === 'debugger')) return;
    const why = FORBIDDEN_NAMES.get(name);
    // Keys count too: destructuring ({ cookie } = …) reads the property.
    if (why) refuse(tok, why);
  }

  // Mode rules for the flags.
  if (mode === 'copy') {
    if (flags.has('network')) problems.add('fetch: a copy of the page has no network (run it on the page with where "page" only if the user needs that)');
    if (flags.has('storage')) problems.add('site storage: a copy of the page has none');
  }
  if (mode === 'page' && flags.has('storage'))
    problems.add("the site's storage (it holds sign-in tokens, and the result goes to you); not in one-off scripts");
  if (problems.size) return { ok: false, problems: [...problems].slice(0, 8) };
  const shown: ScriptFlag[] = mode === 'copy' ? [] : SCRIPT_FLAGS.filter((f) => flags.has(f));
  return { ok: true, code, flags: shown };
}

/** A literal that starts with a full address (another site, or any site). */
const FULL_ADDRESS = /^\s*(https?:|\/\/)/i;

/** The text of a string or template literal at tokens[k] ('' for anything else). */
function literalAt(tokens: Token[], k: number): string {
  const tok = tokens[k];
  return tok && (tok.type === 'str' || tok.type === 'tmpl') ? tok.value : '';
}

/** The index of the bracket that closes tokens[k] (or the end). */
function matching(tokens: Token[], k: number): number {
  const open = tokens[k].value;
  const close = open === '[' ? ']' : open === '(' ? ')' : '}';
  let depth = 0;
  for (let j = k; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.type !== 'punct') continue;
    if (t.value === open) depth++;
    else if (t.value === close && --depth === 0) return j;
  }
  return tokens.length;
}
