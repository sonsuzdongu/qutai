import { Lexer, type Token, type Tokens } from 'marked';

/**
 * What the speech engine gets for an assistant answer, which is Markdown: the words, without the marks. Pure (tested
 * in scripts/text-tests/speechText.test.ts); Copy, Share and PDF keep the Markdown.
 *
 * - `**bold**`, `_italic_`, `~~struck~~`, `` `code` ``, `#` headings, `>` quotes: their text.
 * - Links: the link's text; a bare address: its host ("hepsiburada.com"), not the whole URL letter by letter.
 * - Images: their description. HTML tags and horizontal rules: nothing.
 * - Headings, list items and table rows end with a full stop when they have no punctuation of their own, so the
 *   voice pauses between them instead of running items together; table cells are joined with commas.
 * - Citation markers ("[1]", "[^2]", "【3†source】") are dropped.
 * Numbers, prices and dates ("1.034,91 TL", "17.11.2026") are left as written: the voice of the text's language
 * reads them the way that language does.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** "https://www.hepsiburada.com/iphone-16-p-123" → "hepsiburada.com". */
function host(url: string): string {
  const match = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?([^/?#\s:]+)/i.exec(url.replace(/^mailto:/i, ''));
  return match ? match[1] : url;
}

const isAddress = (text: string) => /^(?:https?:\/\/|www\.)\S+$/i.test(text.trim());

/** Ends a block with a full stop unless it already ends in punctuation. */
function stop(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return /[.!?…:;,。！？]$/.test(t) ? t : `${t}.`;
}

function inline(tokens: Token[] | undefined): string {
  return (tokens ?? []).map(inlineToken).join('');
}

function inlineToken(token: Token): string {
  switch (token.type) {
    case 'text': {
      const t = token as Tokens.Text;
      return t.tokens ? inline(t.tokens) : decode(t.text);
    }
    case 'escape':
      return (token as Tokens.Escape).text;
    case 'strong':
    case 'em':
    case 'del':
      return inline((token as Tokens.Strong).tokens);
    case 'codespan':
      return decode((token as Tokens.Codespan).text);
    case 'link': {
      const link = token as Tokens.Link;
      const text = inline(link.tokens);
      return isAddress(text) || text === link.href || !text.trim() ? host(link.href) : text;
    }
    case 'image':
      return (token as Tokens.Image).text;
    case 'br':
      return '\n';
    case 'html':
      return '';
    default:
      return 'text' in token && typeof token.text === 'string' ? decode(token.text) : '';
  }
}

function blocks(tokens: Token[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'space':
      case 'hr':
      case 'html':
      case 'def':
        break;
      case 'heading':
        out.push(stop(inline((token as Tokens.Heading).tokens)));
        break;
      case 'paragraph':
        out.push(inline((token as Tokens.Paragraph).tokens).trim());
        break;
      case 'text': {
        const t = token as Tokens.Text;
        out.push((t.tokens ? inline(t.tokens) : decode(t.text)).trim());
        break;
      }
      case 'code':
        out.push((token as Tokens.Code).text.trim());
        break;
      case 'blockquote':
        out.push(...blocks((token as Tokens.Blockquote).tokens));
        break;
      case 'list':
        for (const item of (token as Tokens.List).items) {
          const parts = blocks(item.tokens).filter(Boolean);
          if (parts.length) out.push(...parts.slice(0, -1), stop(parts[parts.length - 1]));
        }
        break;
      case 'table': {
        const table = token as Tokens.Table;
        const row = (cells: Tokens.TableCell[]) =>
          stop(
            cells
              .map((cell) => inline(cell.tokens).trim())
              .filter(Boolean)
              .join(', '),
          );
        out.push(row(table.header), ...table.rows.map(row));
        break;
      }
      default:
        if ('text' in token && typeof token.text === 'string') out.push(decode(token.text).trim());
    }
  }
  return out;
}

export function speechText(markdown: string): string {
  const text = blocks(Lexer.lex(markdown))
    .filter(Boolean)
    .join('\n')
    // Citation markers: [1], [1, 2], [^3], 【4†source】.
    .replace(/\s*\[\^?\d+(?:\s*[,–-]\s*\d+)*\]/g, '')
    .replace(/\s*【[^】]*】/g, '')
    // A bare address the Markdown didn't link.
    .replace(/\b(?:https?:\/\/|www\.)[^\s)\]]+/gi, (url) => host(url))
    // Leftover marks the lexer kept as text (an unclosed ** or a stray #), and bullets typed as characters.
    .replace(/\*{2,}|_{2,}|~~|`+/g, '')
    .replace(/^[ \t]*(?:[•·▪◦‣–-]|#{1,6})[ \t]+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1');
  return text.trim();
}
