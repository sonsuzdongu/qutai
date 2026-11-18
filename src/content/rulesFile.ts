import { exportRules, importRules, MAX_RULES, type ImportedRule, type SiteRule } from './siteRules';
import { checkStyleEntry, MAX_STYLES, parseStyleScope, styleSite, type UserStyle } from './userStyles';

/**
 * The "My rules" file, version 2 (docs/page-customisation.md › Export, import, backup). Pure code.
 *
 * Still a text file of filter lines (version 1, content/siteRules.ts exportRules), with a format line and each user
 * style as a block of "!" comment lines, which other blockers and Qutai versions before styles skip:
 *
 *   ! Qutai-Format: 2
 *   ! [style] {"name":"Red links","scope":"*.example.com","enabled":true}
 *   ! | a {
 *   ! |   color: red !important;
 *   ! | }
 *   ! [end]
 *
 * A file without the format line is version 1. Blocks of kinds this version doesn't know ("! [script]") are counted
 * as unsupported, never read as something else.
 */

export const RULES_FILE_FORMAT = 2;
const FORMAT_PREFIX = '! Qutai-Format:';
const BLOCK_START = /^! \[([a-z]+)\]\s*(.*)$/;
const BLOCK_LINE = '! |';
const BLOCK_END = '! [end]';

/** A style read from a file: checked again (sanitised CSS, a valid scope, a clean name). */
export type ImportedStyle = { name: string; scope: string; css: string; enabled: boolean; site: string };

export type RulesFileImport = {
  /** The file's format (1 without the format line). */
  format: number;
  rules: ImportedRule[];
  styles: ImportedStyle[];
  /** Rules and styles already present (on the phone or earlier in the file). */
  duplicates: number;
  /** Lines and styles that are not valid (the same checks as the assistant's). */
  invalid: number;
  /** Blocks of a kind this version can't use (scripts, from a later version). */
  unsupported: number;
};

export function exportRulesFile(rules: readonly SiteRule[], styles: readonly UserStyle[], now: Date = new Date()): string {
  const [title, ...rest] = exportRules(rules, now).trimEnd().split('\n');
  const head = [
    title,
    `${FORMAT_PREFIX} ${RULES_FILE_FORMAT}`,
    ...rest.filter((l) => l.startsWith('!') && !l.startsWith('! off: ')),
    ...(styles.length ? ['! Styles: "! [style] {…}" blocks, the CSS on the "! |" lines, up to "! [end]".'] : []),
  ];
  const lines = rest.filter((l) => !l.startsWith('!') || l.startsWith('! off: '));
  const blocks = styles.flatMap((s) => [
    `! [style] ${JSON.stringify({ name: s.name, scope: s.scope, enabled: s.enabled })}`,
    ...s.css.trimEnd().split('\n').map((l) => `${BLOCK_LINE} ${l}`),
    BLOCK_END,
  ]);
  return `${[...head, ...lines, ...blocks].join('\n')}\n`;
}

/**
 * Reads a rules file of either version. haveLines: the filter lines the phone has; haveStyles: its styles (a style
 * with the same scope and CSS is a duplicate).
 */
export function importRulesFile(
  text: string,
  haveLines: readonly string[] = [],
  haveStyles: readonly { scope: string; css: string }[] = [],
): RulesFileImport {
  const clean = text.replace(/^﻿/, '');
  const filter = importRules(clean, haveLines);
  const lines = clean.split(/\r?\n/);
  const formatLine = lines.find((l) => l.trim().startsWith(FORMAT_PREFIX));
  const format = formatLine ? Number.parseInt(formatLine.trim().slice(FORMAT_PREFIX.length).trim(), 10) || 1 : 1;
  const seen = new Set(haveStyles.map((s) => styleKey(s.scope, s.css)));
  const styles: ImportedStyle[] = [];
  let duplicates = filter.duplicates;
  let invalid = filter.invalid;
  let unsupported = 0;
  for (let i = 0; i < lines.length; i++) {
    const start = BLOCK_START.exec(lines[i].trim());
    if (!start || start[1] === 'end') continue;
    const body: string[] = [];
    let closed = false;
    let k = i + 1;
    for (; k < lines.length; k++) {
      const line = lines[k].replace(/\s+$/, '');
      if (line.trim() === BLOCK_END) {
        closed = true;
        break;
      }
      if (!line.startsWith(BLOCK_LINE)) break;
      body.push(line.slice(BLOCK_LINE.length).replace(/^ /, ''));
    }
    i = closed ? k : k - 1;
    if (start[1] !== 'style') {
      unsupported++;
      continue;
    }
    let meta: Record<string, unknown> = {};
    try {
      const parsed = start[2] ? JSON.parse(start[2]) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) meta = parsed;
    } catch {
      meta = {};
    }
    const checked = closed ? checkStyleEntry({ name: meta.name, scope: meta.scope, css: body.join('\n') }) : null;
    if (!checked || styles.length >= MAX_STYLES) {
      invalid++;
      continue;
    }
    const key = styleKey(checked.scope, checked.css);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    const scope = parseStyleScope(checked.scope)!;
    styles.push({ ...checked, enabled: meta.enabled !== false, site: styleSite(scope, '*') });
  }
  return { format, rules: filter.rules.slice(0, MAX_RULES), styles, duplicates, invalid, unsupported };
}

function styleKey(scope: string, css: string): string {
  return `${scope.trim()}\n${css.trim()}`;
}
