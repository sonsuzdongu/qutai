/**
 * The sanitiser for user styles (docs/page-customisation.md › CSS sanitising). Pure code: no React Native, also runs
 * in Node.
 *
 * The CSS is tokenized as CSS Syntax Level 3 does (comments, escapes, strings, url tokens, functions, at-keywords;
 * escapes are decoded before any name is checked), parsed into rules and declarations, checked against a safe subset
 * and written back from the parse: comments are dropped and every declaration gets !important. Only the written-back
 * text is ever stored or injected. Anything outside the subset refuses the whole stylesheet with a reason, so what
 * the user approved is exactly what runs.
 *
 * The subset can't load anything from the network: no at-rule but @media and @supports, no url() but a raster
 * data: image, no function that takes an address (image-set, image, cross-fade, element, paint, src, attr…).
 */

export const MAX_CSS_LENGTH = 16 * 1024;
export const MAX_CSS_RULES = 200;
const MAX_DEPTH = 24;
/** A data: image in url() may be this long (characters of the address). */
const MAX_DATA_URL = 64 * 1024;

export type CssProblem =
  | 'empty'
  | 'tooLarge'
  | 'syntax'
  | 'atRule'
  | 'url'
  | 'function'
  | 'property'
  | 'selector'
  | 'nesting'
  | 'tooManyRules';

export type CssResult = { ok: true; css: string; rules: number } | { ok: false; problem: CssProblem; detail: string };

class Refused extends Error {
  constructor(
    readonly problem: CssProblem,
    readonly detail: string,
  ) {
    super(detail);
  }
}

// ---------- Tokenizer ----------

type Token =
  | { t: 'ws' }
  | { t: 'ident'; v: string }
  | { t: 'function'; v: string }
  | { t: 'at'; v: string }
  | { t: 'hash'; v: string }
  | { t: 'string'; v: string }
  | { t: 'url'; v: string }
  | { t: 'number'; v: string }
  | { t: 'percentage'; v: string }
  | { t: 'dimension'; v: string; unit: string }
  | { t: 'delim'; v: string }
  | { t: 'colon' }
  | { t: 'semicolon' }
  | { t: 'comma' }
  | { t: '(' }
  | { t: ')' }
  | { t: '[' }
  | { t: ']' }
  | { t: '{' }
  | { t: '}' };

const isDigit = (c: string) => c >= '0' && c <= '9';
const isHex = (c: string) => /^[0-9a-fA-F]$/.test(c);
const isNameStart = (c: string) => /^[a-zA-Z_]$/.test(c) || (c !== '' && c.charCodeAt(0) >= 0x80);
const isName = (c: string) => isNameStart(c) || isDigit(c) || c === '-';
const isWs = (c: string) => c === ' ' || c === '\t' || c === '\n';

function tokenize(input: string): Token[] {
  if (input.includes('\0')) throw new Refused('syntax', 'a NUL character');
  const s = input.replace(/\r\n|\r|\f/g, '\n');
  const out: Token[] = [];
  let i = 0;
  const at = (k = 0) => s[i + k] ?? '';
  const validEscape = (k = 0) => at(k) === '\\' && at(k + 1) !== '\n' && at(k + 1) !== '';
  const startsIdent = (k = 0) => {
    const c = at(k);
    if (c === '-') return isNameStart(at(k + 1)) || at(k + 1) === '-' || validEscape(k + 1);
    if (isNameStart(c)) return true;
    return validEscape(k);
  };
  const startsNumber = (k = 0) => {
    const c = at(k);
    if (c === '+' || c === '-') return isDigit(at(k + 1)) || (at(k + 1) === '.' && isDigit(at(k + 2)));
    if (c === '.') return isDigit(at(k + 1));
    return isDigit(c);
  };
  const escape = (): string => {
    // At the character after the backslash.
    let hex = '';
    while (hex.length < 6 && isHex(at())) hex += s[i++];
    if (hex) {
      if (isWs(at())) i++;
      const code = parseInt(hex, 16);
      if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '�';
      return String.fromCodePoint(code);
    }
    if (at() === '') return '�';
    const c = s[i];
    i += c.length;
    // Astral characters: take the whole code point.
    if (c >= '\ud800' && c <= '\udbff' && at() >= '\udc00' && at() <= '\udfff') return c + s[i++];
    return c;
  };
  const name = (): string => {
    let v = '';
    for (;;) {
      const c = at();
      if (isName(c)) {
        v += c;
        i++;
      } else if (validEscape()) {
        i++;
        v += escape();
      } else return v;
    }
  };
  const number = (): string => {
    let v = '';
    if (at() === '+' || at() === '-') v += s[i++];
    while (isDigit(at())) v += s[i++];
    if (at() === '.' && isDigit(at(1))) {
      v += s[i++];
      while (isDigit(at())) v += s[i++];
    }
    if ((at() === 'e' || at() === 'E') && (isDigit(at(1)) || ((at(1) === '+' || at(1) === '-') && isDigit(at(2))))) {
      v += s[i++];
      if (at() === '+' || at() === '-') v += s[i++];
      while (isDigit(at())) v += s[i++];
    }
    return v;
  };
  const string = (quote: string): string => {
    let v = '';
    for (;;) {
      const c = at();
      if (c === '') throw new Refused('syntax', 'a string that is not closed');
      if (c === quote) {
        i++;
        return v;
      }
      if (c === '\n') throw new Refused('syntax', 'a line break inside a string');
      if (c === '\\') {
        if (at(1) === '') {
          i++;
          continue;
        }
        if (at(1) === '\n') {
          i += 2;
          continue;
        }
        i++;
        v += escape();
        continue;
      }
      v += c;
      i++;
    }
  };
  const unquotedUrl = (): string => {
    let v = '';
    while (isWs(at())) i++;
    for (;;) {
      const c = at();
      if (c === '') throw new Refused('syntax', 'url( that is not closed');
      if (c === ')') {
        i++;
        return v;
      }
      if (isWs(c)) {
        while (isWs(at())) i++;
        if (at() === ')') {
          i++;
          return v;
        }
        throw new Refused('url', 'a malformed url()');
      }
      if (c === '"' || c === "'" || c === '(') throw new Refused('url', 'a malformed url()');
      if (c === '\\') {
        if (!validEscape()) throw new Refused('url', 'a malformed url()');
        i++;
        v += escape();
        continue;
      }
      v += c;
      i++;
    }
  };

  while (i < s.length) {
    const c = at();
    if (c === '/' && at(1) === '*') {
      const end = s.indexOf('*/', i + 2);
      if (end < 0) throw new Refused('syntax', 'a comment that is not closed');
      i = end + 2;
      continue;
    }
    if (isWs(c)) {
      while (isWs(at())) i++;
      if (out[out.length - 1]?.t !== 'ws') out.push({ t: 'ws' });
      continue;
    }
    if (c === '"' || c === "'") {
      i++;
      out.push({ t: 'string', v: string(c) });
      continue;
    }
    if (c === '#') {
      if (isName(at(1)) || validEscape(1)) {
        i++;
        out.push({ t: 'hash', v: name() });
      } else {
        i++;
        out.push({ t: 'delim', v: '#' });
      }
      continue;
    }
    if (startsNumber()) {
      const v = number();
      if (startsIdent()) out.push({ t: 'dimension', v, unit: name() });
      else if (at() === '%') {
        i++;
        out.push({ t: 'percentage', v });
      } else out.push({ t: 'number', v });
      continue;
    }
    if (c === '<' && s.startsWith('<!--', i)) throw new Refused('syntax', '<!--');
    if (c === '-' && s.startsWith('-->', i)) throw new Refused('syntax', '-->');
    if (startsIdent()) {
      const v = name();
      if (at() === '(') {
        i++;
        if (v.toLowerCase() === 'url') {
          let k = 0;
          while (isWs(at(k))) k++;
          if (at(k) === '"' || at(k) === "'") {
            out.push({ t: 'function', v });
          } else {
            out.push({ t: 'url', v: unquotedUrl() });
          }
        } else out.push({ t: 'function', v });
      } else out.push({ t: 'ident', v });
      continue;
    }
    if (c === '@') {
      i++;
      if (startsIdent()) out.push({ t: 'at', v: name() });
      else out.push({ t: 'delim', v: '@' });
      continue;
    }
    if (c === '\\') throw new Refused('syntax', 'a stray backslash');
    i += c.length;
    switch (c) {
      case ':':
        out.push({ t: 'colon' });
        break;
      case ';':
        out.push({ t: 'semicolon' });
        break;
      case ',':
        out.push({ t: 'comma' });
        break;
      case '(':
      case ')':
      case '[':
      case ']':
      case '{':
      case '}':
        out.push({ t: c });
        break;
      default:
        out.push({ t: 'delim', v: c });
    }
  }
  return out;
}

// ---------- Component values ----------

type Node =
  | Exclude<Token, { t: 'function' } | { t: '(' } | { t: ')' } | { t: '[' } | { t: ']' } | { t: '{' } | { t: '}' }>
  | { t: 'fn'; name: string; args: Node[] }
  | { t: 'block'; open: '(' | '[' | '{'; body: Node[] };

const CLOSE = { '(': ')', '[': ']', '{': '}' } as const;

/** Groups tokens into functions and blocks; refuses unbalanced brackets. */
function group(tokens: Token[]): Node[] {
  let i = 0;
  const list = (close: string | null, depth: number): Node[] => {
    if (depth > MAX_DEPTH) throw new Refused('nesting', 'brackets nested too deeply');
    const out: Node[] = [];
    while (i < tokens.length) {
      const tok = tokens[i++];
      if (tok.t === ')' || tok.t === ']' || tok.t === '}') {
        if (tok.t === close) return out;
        throw new Refused('syntax', `an unexpected "${tok.t}"`);
      }
      if (tok.t === '(' || tok.t === '[' || tok.t === '{') {
        out.push({ t: 'block', open: tok.t, body: list(CLOSE[tok.t], depth + 1) });
      } else if (tok.t === 'function') {
        out.push({ t: 'fn', name: tok.v, args: list(')', depth + 1) });
      } else out.push(tok);
    }
    if (close) throw new Refused('syntax', `a missing "${close}"`);
    return out;
  };
  return list(null, 0);
}

// ---------- The safe subset ----------

const VALUE_FUNCTIONS = new Set(
  [
    'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color', 'color-mix', 'light-dark',
    'calc', 'min', 'max', 'clamp', 'round', 'mod', 'rem', 'abs', 'sign', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
    'atan2', 'pow', 'sqrt', 'hypot', 'log', 'exp',
    'var', 'env',
    'linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient',
    'repeating-radial-gradient', 'repeating-conic-gradient',
    'translate', 'translatex', 'translatey', 'translatez', 'translate3d', 'scale', 'scalex', 'scaley', 'scalez',
    'scale3d', 'rotate', 'rotatex', 'rotatey', 'rotatez', 'rotate3d', 'skew', 'skewx', 'skewy', 'matrix', 'matrix3d',
    'perspective',
    'blur', 'brightness', 'contrast', 'drop-shadow', 'grayscale', 'hue-rotate', 'invert', 'opacity', 'saturate',
    'sepia',
    'cubic-bezier', 'steps', 'minmax', 'repeat', 'fit-content', 'counter', 'counters',
  ].map((n) => n.toLowerCase()),
);

/** Selector functions (pseudo-classes and pseudo-elements that take arguments). */
const SELECTOR_FUNCTIONS = new Set([
  'not', 'is', 'where', 'has', 'nth-child', 'nth-last-child', 'nth-of-type', 'nth-last-of-type', 'lang', 'dir',
]);

/** Properties that load or run something. */
const REFUSED_PROPERTIES = new Set(['behavior', '-moz-binding', 'src', '-ms-behavior']);

const RASTER_DATA_URL = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;

function checkUrl(address: string): string {
  const v = address.trim();
  if (v.length <= MAX_DATA_URL && RASTER_DATA_URL.test(v)) return v;
  throw new Refused(
    'url',
    `url(${JSON.stringify(v.length > 60 ? `${v.slice(0, 60)}…` : v)}): only data: PNG, JPEG, GIF or WebP images may be used`,
  );
}

function mentionsQutai(nodes: Node[]): boolean {
  return nodes.some((n) => {
    if ('v' in n && typeof n.v === 'string' && /qutai/i.test(n.v)) return true;
    if (n.t === 'dimension' && /qutai/i.test(n.unit)) return true;
    if (n.t === 'fn') return /qutai/i.test(n.name) || mentionsQutai(n.args);
    if (n.t === 'block') return mentionsQutai(n.body);
    return false;
  });
}

function checkSelector(nodes: Node[]): void {
  if (!nodes.some((n) => n.t !== 'ws')) throw new Refused('selector', 'a rule without a selector');
  if (mentionsQutai(nodes)) throw new Refused('selector', "a selector naming Qutai's own elements");
  const walk = (list: Node[], inAttr: boolean) => {
    for (const n of list) {
      switch (n.t) {
        case 'ws':
        case 'ident':
        case 'hash':
        case 'colon':
        case 'comma':
        case 'number':
        case 'dimension':
          break;
        case 'string':
          if (!inAttr) throw new Refused('selector', 'a string outside an attribute selector');
          break;
        case 'delim':
          if (!['.', '*', '>', '+', '~', '|', '=', '^', '$', '-'].includes(n.v))
            throw new Refused('selector', `"${n.v}" in a selector`);
          break;
        case 'block':
          if (n.open !== '[') throw new Refused('selector', `"${n.open}" in a selector`);
          walk(n.body, true);
          break;
        case 'fn':
          if (!SELECTOR_FUNCTIONS.has(n.name.toLowerCase())) throw new Refused('function', `:${n.name}() in a selector`);
          walk(n.args, inAttr);
          break;
        case 'url':
          throw new Refused('url', 'url() in a selector');
        default:
          throw new Refused('selector', `"${n.t}" in a selector`);
      }
    }
  };
  walk(nodes, false);
}

function checkValue(nodes: Node[], prop: string): void {
  for (const n of nodes) {
    switch (n.t) {
      case 'ws':
      case 'ident':
      case 'number':
      case 'percentage':
      case 'dimension':
      case 'hash':
      case 'string':
      case 'comma':
        break;
      case 'delim':
        if (!['/', '+', '-', '*'].includes(n.v)) throw new Refused('syntax', `"${n.v}" in the value of ${prop}`);
        break;
      case 'url':
        checkUrl(n.v);
        break;
      case 'block':
        if (n.open !== '(') throw new Refused(n.open === '{' ? 'nesting' : 'syntax', `"${n.open}" in the value of ${prop}`);
        checkValue(n.body, prop);
        break;
      case 'fn': {
        const fname = n.name.toLowerCase();
        if (fname === 'url') {
          const args = n.args.filter((a) => a.t !== 'ws');
          if (args.length !== 1 || args[0].t !== 'string') throw new Refused('url', 'a malformed url()');
          checkUrl(args[0].v);
          break;
        }
        if (!VALUE_FUNCTIONS.has(fname)) throw new Refused('function', `${n.name}() (it is not one of the allowed functions)`);
        checkValue(n.args, prop);
        break;
      }
      default:
        throw new Refused('syntax', `"${n.t === 'colon' ? ':' : n.t === 'semicolon' ? ';' : n.t}" in the value of ${prop}`);
    }
  }
}

/** Media and @supports conditions: words, numbers, comparisons and brackets; no functions. */
function checkCondition(nodes: Node[], rule: string): void {
  for (const n of nodes) {
    switch (n.t) {
      case 'ws':
      case 'ident':
      case 'number':
      case 'percentage':
      case 'dimension':
      case 'colon':
      case 'comma':
      case 'hash':
        break;
      case 'delim':
        if (!['<', '>', '=', '/', '-', '.'].includes(n.v)) throw new Refused('syntax', `"${n.v}" in @${rule}`);
        break;
      case 'block':
        if (n.open !== '(') throw new Refused('syntax', `"${n.open}" in @${rule}`);
        checkCondition(n.body, rule);
        break;
      case 'fn':
        throw new Refused('function', `${n.name}() in @${rule}`);
      case 'url':
        throw new Refused('url', `url() in @${rule}`);
      default:
        throw new Refused('syntax', `"${n.t}" in @${rule}`);
    }
  }
}

// ---------- Serialiser ----------

function escapeIdent(v: string): string {
  let out = '';
  for (let k = 0; k < v.length; k++) {
    const c = v[k];
    const code = c.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) out += `\\${code.toString(16)} `;
    else if (k === 0 && isDigit(c)) out += `\\${code.toString(16)} `;
    else if (k === 1 && isDigit(c) && v[0] === '-') out += `\\${code.toString(16)} `;
    else if (k === 0 && c === '-' && v.length === 1) out += '\\-';
    else if (isName(c) || code >= 0x80) out += c;
    else out += `\\${c}`;
  }
  return out;
}

/** A hash's name: like an identifier, but it may start with a digit (#fff, #1a2b3c). */
function escapeName(v: string): string {
  let out = '';
  for (const c of v) {
    const code = c.codePointAt(0)!;
    if (code < 0x20 || code === 0x7f) out += `\\${code.toString(16)} `;
    else if (isName(c) || code >= 0x80) out += c;
    else out += `\\${c}`;
  }
  return out;
}

function escapeString(v: string): string {
  return `"${v.replace(/[\\"\n<]/g, (c) => (c === '\n' ? '\\a ' : c === '<' ? '\\3c ' : `\\${c}`))}"`;
}

/**
 * Whether two pieces written next to each other would read back as different tokens (a comment separated them in
 * the input, such as "red", comment, "blue"): the boundary is tokenized together and apart.
 */
function wouldMerge(before: string, after: string): boolean {
  if (!before || !after) return false;
  const tail = before.slice(-12);
  const head = after.slice(0, 12);
  try {
    return tokenize(tail + head).length !== tokenize(tail).length + tokenize(head).length;
  } catch {
    return true;
  }
}

function write(nodes: Node[]): string {
  let out = '';
  for (const n of nodes) {
    const piece = writeOne(n);
    if (n.t !== 'ws' && out && !out.endsWith(' ') && wouldMerge(out, piece)) out += '/**/';
    out += piece;
  }
  return out;
}

function writeOne(n: Node): string {
  let out = '';
  {
    switch (n.t) {
      case 'ws':
        out += ' ';
        break;
      case 'ident':
        out += escapeIdent(n.v);
        break;
      case 'at':
        out += `@${escapeIdent(n.v)}`;
        break;
      case 'hash':
        out += `#${escapeName(n.v)}`;
        break;
      case 'string':
        out += escapeString(n.v);
        break;
      case 'url':
        out += `url(${escapeString(n.v)})`;
        break;
      case 'number':
        out += n.v;
        break;
      case 'percentage':
        out += `${n.v}%`;
        break;
      case 'dimension':
        // A unit starting with "e" right after the number would read as an exponent: escape it.
        out += n.v + (/^[eE][+-]?\d/.test(n.unit) ? `\\${n.unit.charCodeAt(0).toString(16)} ${escapeIdent(n.unit.slice(1))}` : escapeIdent(n.unit));
        break;
      case 'delim':
        out += n.v;
        break;
      case 'colon':
        out += ':';
        break;
      case 'semicolon':
        out += ';';
        break;
      case 'comma':
        out += ',';
        break;
      case 'fn': {
        // url("…") (checked already) is written like an unquoted url token.
        const only = n.args.filter((a) => a.t !== 'ws');
        if (n.name.toLowerCase() === 'url' && only.length === 1 && only[0].t === 'string') out += `url(${escapeString(only[0].v)})`;
        else out += `${escapeIdent(n.name)}(${write(n.args)})`;
        break;
      }
      case 'block':
        out += `${n.open}${write(n.body)}${CLOSE[n.open]}`;
        break;
    }
  }
  return out;
}

const trimWs = (nodes: Node[]): Node[] => {
  let a = 0;
  let b = nodes.length;
  while (a < b && nodes[a].t === 'ws') a++;
  while (b > a && nodes[b - 1].t === 'ws') b--;
  return nodes.slice(a, b);
};

// ---------- Parser ----------

type Decl = { prop: string; value: string };

/** The declarations of a style rule's block. */
function declarations(body: Node[]): Decl[] {
  const out: Decl[] = [];
  let k = 0;
  while (k < body.length) {
    // One declaration: up to the next top-level ";".
    let end = k;
    while (end < body.length && body[end].t !== 'semicolon') end++;
    const part = trimWs(body.slice(k, end));
    k = end + 1;
    if (!part.length) continue;
    const head = part[0];
    if (head.t === 'at') throw new Refused('atRule', `@${head.v} inside a rule`);
    if (head.t !== 'ident') {
      if (part.some((n) => n.t === 'block' && n.open === '{')) throw new Refused('nesting', 'a rule nested inside a rule');
      throw new Refused('syntax', `a declaration that does not start with a property name ("${write([head])}")`);
    }
    let c = 1;
    while (part[c]?.t === 'ws') c++;
    if (part[c]?.t !== 'colon') {
      if (part.some((n) => n.t === 'block' && n.open === '{')) throw new Refused('nesting', 'a rule nested inside a rule');
      throw new Refused('syntax', `"${head.v}" without a colon and a value`);
    }
    const prop = head.v.toLowerCase().startsWith('--') ? head.v : head.v.toLowerCase();
    if (!/^(--)?-?[a-z_][a-z0-9_-]*$/i.test(prop)) throw new Refused('property', `the property name ${JSON.stringify(head.v)}`);
    if (REFUSED_PROPERTIES.has(prop.toLowerCase())) throw new Refused('property', `the property ${prop}`);
    let value = trimWs(part.slice(c + 1));
    // A trailing !important (written back for every declaration anyway).
    const bang = value.findIndex((n) => n.t === 'delim' && n.v === '!');
    if (bang >= 0) {
      const rest = trimWs(value.slice(bang + 1));
      if (rest.length !== 1 || rest[0].t !== 'ident' || rest[0].v.toLowerCase() !== 'important')
        throw new Refused('syntax', `"!" in the value of ${prop}`);
      value = trimWs(value.slice(0, bang));
    }
    if (!value.length) throw new Refused('syntax', `${prop} without a value`);
    checkValue(value, prop);
    out.push({ prop, value: write(value) });
  }
  return out;
}

type Rule = { selector: string; decls: Decl[] };
type Block = { kind: 'rule'; rule: Rule } | { kind: 'at'; name: 'media' | 'supports'; prelude: string; rules: Rule[] };

function styleRule(prelude: Node[], body: Node[]): Rule {
  const selector = trimWs(prelude);
  checkSelector(selector);
  return { selector: write(selector), decls: declarations(body) };
}

/** Rules at one level: style rules, and (at the top only) @media / @supports. */
function rules(nodes: Node[], top: boolean, counter: { n: number }): Block[] {
  const out: Block[] = [];
  let k = 0;
  const bump = () => {
    if (++counter.n > MAX_CSS_RULES) throw new Refused('tooManyRules', `more than ${MAX_CSS_RULES} rules`);
  };
  while (k < nodes.length) {
    const n = nodes[k];
    if (n.t === 'ws') {
      k++;
      continue;
    }
    if (n.t === 'at') {
      const name = n.v.toLowerCase();
      // The prelude, up to its block (or a ";", which no allowed at-rule has).
      let end = k + 1;
      while (end < nodes.length && !(nodes[end].t === 'block' && (nodes[end] as { open: string }).open === '{') && nodes[end].t !== 'semicolon')
        end++;
      if (name !== 'media' && name !== 'supports') throw new Refused('atRule', `@${n.v}`);
      if (!top) throw new Refused('nesting', `@${name} inside another at-rule`);
      const block = nodes[end];
      if (!block || block.t !== 'block') throw new Refused('syntax', `@${name} without a block`);
      const prelude = trimWs(nodes.slice(k + 1, end));
      if (!prelude.length) throw new Refused('syntax', `@${name} without a condition`);
      checkCondition(prelude, name);
      const inner = rules(block.body, false, counter).map((b) => {
        if (b.kind !== 'rule') throw new Refused('nesting', `an at-rule inside @${name}`);
        return b.rule;
      });
      out.push({ kind: 'at', name, prelude: write(prelude), rules: inner });
      k = end + 1;
      continue;
    }
    if (n.t === 'semicolon') throw new Refused('syntax', 'a ";" outside a rule');
    // A style rule: its selector up to the block.
    let end = k;
    while (end < nodes.length && !(nodes[end].t === 'block' && (nodes[end] as { open: string }).open === '{')) {
      if (nodes[end].t === 'semicolon') throw new Refused('syntax', 'a declaration outside a rule');
      if (nodes[end].t === 'at') throw new Refused('atRule', `@${(nodes[end] as { v: string }).v} in a selector`);
      end++;
    }
    const block = nodes[end];
    if (!block || block.t !== 'block') throw new Refused('syntax', 'a selector without a { block }');
    bump();
    out.push({ kind: 'rule', rule: styleRule(nodes.slice(k, end), block.body) });
    k = end + 1;
  }
  return out;
}

function writeRule(rule: Rule, indent: string): string {
  if (!rule.decls.length) return `${indent}${rule.selector} {}\n`;
  const body = rule.decls.map((d) => `${indent}  ${d.prop}: ${d.value} !important;\n`).join('');
  return `${indent}${rule.selector} {\n${body}${indent}}\n`;
}

/**
 * Checks and rewrites a user stylesheet. ok: the CSS to store and inject (comments dropped, every declaration
 * !important), and how many style rules it has. Otherwise the problem (for the user's message) and a detail in
 * English (for the model and the Details line).
 */
export function sanitizeCss(input: string): CssResult {
  if (typeof input !== 'string' || !input.trim()) return { ok: false, problem: 'empty', detail: 'the stylesheet is empty' };
  if (input.length > MAX_CSS_LENGTH)
    return { ok: false, problem: 'tooLarge', detail: `the stylesheet is longer than ${MAX_CSS_LENGTH} characters` };
  try {
    const counter = { n: 0 };
    const blocks = rules(group(tokenize(input.replace(/^﻿/, ''))), true, counter);
    if (!counter.n) return { ok: false, problem: 'empty', detail: 'the stylesheet has no rules' };
    let css = '';
    for (const b of blocks) {
      if (b.kind === 'rule') css += writeRule(b.rule, '');
      else css += `@${b.name} ${b.prelude} {\n${b.rules.map((r) => writeRule(r, '  ')).join('')}}\n`;
    }
    if (css.length > MAX_CSS_LENGTH * 2)
      return { ok: false, problem: 'tooLarge', detail: `the stylesheet is longer than ${MAX_CSS_LENGTH} characters` };
    return { ok: true, css, rules: counter.n };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, problem: e.problem, detail: e.detail };
    return { ok: false, problem: 'syntax', detail: 'the stylesheet could not be read' };
  }
}
