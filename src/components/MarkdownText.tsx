import { Lexer, Token, Tokens } from 'marked';
import { memo, ReactNode, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextStyle, View } from 'react-native';

type Props = {
  text: string;
  /** Base text style (color, size, line height); markdown styles are layered on top. */
  style: TextStyle;
  /** Called for http(s) links; other schemes are shown as plain text. */
  onOpenLink: (url: string) => void;
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

/** Resolves the HTML entities marked leaves in text ("&amp;", "&#39;"). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

export const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

/** Rough column width for tables, from the longest cell (tables scroll sideways when wide). */
export function columnWidths(table: { header: { text: string }[]; rows: { text: string }[][] }): number[] {
  return table.header.map((cell, col) => {
    const longest = Math.max(cell.text.length, ...table.rows.map((row) => row[col]?.text.length ?? 0));
    return Math.min(220, Math.max(64, longest * 7.5 + 20));
  });
}

/** Renders the assistant's markdown with native components: selectable text, tappable links. */
export const MarkdownText = memo(function MarkdownText({ text, style, onOpenLink }: Props) {
  const tokens = useMemo(() => Lexer.lex(text), [text]);
  const inline = (items: Token[] | undefined, key: string): ReactNode[] =>
    (items ?? []).map((token, i) => renderInline(token, `${key}.${i}`));

  function renderInline(token: Token, key: string): ReactNode {
    switch (token.type) {
      case 'text': {
        const t = token as Tokens.Text;
        return t.tokens ? <Text key={key}>{inline(t.tokens, key)}</Text> : decodeEntities(t.text);
      }
      case 'escape':
        return decodeEntities((token as Tokens.Escape).text);
      case 'strong':
        return (
          <Text key={key} style={styles.bold}>
            {inline((token as Tokens.Strong).tokens, key)}
          </Text>
        );
      case 'em':
        return (
          <Text key={key} style={styles.italic}>
            {inline((token as Tokens.Em).tokens, key)}
          </Text>
        );
      case 'del':
        return (
          <Text key={key} style={styles.strike}>
            {inline((token as Tokens.Del).tokens, key)}
          </Text>
        );
      case 'codespan':
        return (
          <Text key={key} style={styles.codespan}>
            {decodeEntities((token as Tokens.Codespan).text)}
          </Text>
        );
      case 'br':
        return '\n';
      case 'link':
      case 'image': {
        const link = token as Tokens.Link | Tokens.Image;
        const label = link.type === 'image' ? decodeEntities(link.text) || link.href : inline(link.tokens, key);
        if (!isWebUrl(link.href)) return <Text key={key}>{label}</Text>;
        return (
          <Text key={key} style={styles.link} onPress={() => onOpenLink(link.href)} accessibilityRole="link">
            {label}
          </Text>
        );
      }
      case 'checkbox':
        return (token as Tokens.Checkbox).checked ? '☑ ' : '☐ ';
      case 'html':
        // Raw HTML tags are not rendered; the text around them still is.
        return null;
      default:
        return 'text' in token && typeof token.text === 'string' ? decodeEntities(token.text) : null;
    }
  }

  function renderBlock(token: Token, key: string): ReactNode {
    switch (token.type) {
      case 'space':
        return null;
      case 'paragraph':
      case 'text': {
        const t = token as Tokens.Paragraph | Tokens.Text;
        return (
          <Text key={key} style={style} selectable>
            {t.tokens ? inline(t.tokens, key) : decodeEntities(t.text)}
          </Text>
        );
      }
      case 'heading': {
        const h = token as Tokens.Heading;
        return (
          <Text key={key} style={[style, styles.heading, h.depth <= 2 && styles.headingLarge]} selectable>
            {inline(h.tokens, key)}
          </Text>
        );
      }
      case 'list': {
        const list = token as Tokens.List;
        const start = typeof list.start === 'number' ? list.start : 1;
        return (
          <View key={key} style={styles.list}>
            {list.items.map((item, i) => (
              <View key={`${key}.${i}`} style={styles.listItem}>
                <Text style={[style, styles.marker]}>
                  {item.task ? (item.checked ? '☑' : '☐') : list.ordered ? `${start + i}.` : '•'}
                </Text>
                <View style={styles.listBody}>{blocks(item.tokens, `${key}.${i}`)}</View>
              </View>
            ))}
          </View>
        );
      }
      case 'code':
        return (
          <ScrollView key={key} horizontal style={styles.codeBlock} contentContainerStyle={styles.codeContent}>
            <Text style={styles.codeText} selectable>
              {(token as Tokens.Code).text}
            </Text>
          </ScrollView>
        );
      case 'blockquote':
        return (
          <View key={key} style={styles.quote}>
            {blocks((token as Tokens.Blockquote).tokens, key)}
          </View>
        );
      case 'hr':
        return <View key={key} style={styles.hr} />;
      case 'table': {
        const table = token as Tokens.Table;
        const widths = columnWidths(table);
        const row = (cells: Tokens.TableCell[], rowKey: string, header: boolean) => (
          <View key={rowKey} style={[styles.tableRow, header && styles.tableHeader]}>
            {cells.map((cell, col) => (
              <Text
                key={`${rowKey}.${col}`}
                style={[style, styles.cell, { width: widths[col] }, header && styles.bold]}
                selectable
              >
                {inline(cell.tokens, `${rowKey}.${col}`)}
              </Text>
            ))}
          </View>
        );
        return (
          <ScrollView key={key} horizontal style={styles.table}>
            <View>
              {row(table.header, `${key}.h`, true)}
              {table.rows.map((cells, i) => row(cells, `${key}.${i}`, false))}
            </View>
          </ScrollView>
        );
      }
      case 'html':
      case 'checkbox':
        return null;
      default:
        return 'text' in token && typeof token.text === 'string' ? (
          <Text key={key} style={style} selectable>
            {decodeEntities(token.text)}
          </Text>
        ) : null;
    }
  }

  function blocks(items: Token[], key: string): ReactNode[] {
    return items.map((token, i) => renderBlock(token, `${key}.${i}`));
  }

  return <View style={styles.root}>{blocks(tokens, 'b')}</View>;
});

const styles = StyleSheet.create({
  root: { gap: 6 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  codespan: { fontFamily: MONO, fontSize: 13, backgroundColor: '#f1efe8' },
  link: { color: '#c96442', textDecorationLine: 'underline' },
  heading: { fontWeight: '700', marginTop: 4 },
  headingLarge: { fontSize: 17 },
  list: { gap: 3 },
  listItem: { flexDirection: 'row', gap: 6 },
  marker: { minWidth: 16 },
  listBody: { flex: 1, gap: 4 },
  codeBlock: { backgroundColor: '#f1efe8', borderRadius: 8 },
  codeContent: { padding: 10 },
  codeText: { fontFamily: MONO, fontSize: 12.5, color: '#333' },
  quote: { borderLeftWidth: 3, borderLeftColor: '#e0ddd4', paddingLeft: 10, gap: 4 },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: '#d6d3c9', marginVertical: 4 },
  table: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#d6d3c9' },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0ddd4' },
  tableHeader: { backgroundColor: '#f5f4ef' },
  cell: { paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, lineHeight: 18 },
});
