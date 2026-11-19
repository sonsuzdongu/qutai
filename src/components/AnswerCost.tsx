import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AnswerCost, formatUsd, RequestCost, sumCosts } from '../ai/cost';
import { getProvider, modelLabel } from '../ai/providers';
import { totalTokens, type Usage } from '../ai/usage';
import { getLocale, t } from '../i18n';
import { formatDate, formatNumber, formatUsdAmount, numberSeparators } from '../i18n/format';
import { makeStyles } from '../ui/theme';
import { costFit } from './costFit';
import { dialog } from './Dialog';
import { creditsText, providerModelName } from '../credits';

/**
 * The approximate cost of an answer or a request (ai/cost.ts) as people read it: "≈ $0.012 · 3.4k tokens", or the
 * tokens alone when no price is known. Never a price the app doesn't have.
 */

/** "$0.012" written as the app's language writes dollars: "0,012 $" in German, "US$ 0,012" in Brazil. */
export const usd = (nanos: number) => {
  const text = formatUsd(nanos, numberSeparators().decimal);
  const parts = /^(< )?\$(.+)$/.exec(text);
  return parts ? `${parts[1] ?? ''}${formatUsdAmount(parts[2])}` : text;
};

export function tokensLabel(n: number): string {
  return n < 1000 ? t('cost.tokens', { n: formatNumber(n) }) : t('cost.kTokens', { n: formatNumber(Math.round(n / 100) / 10) });
}

/** Qutai Credits charged, as text ("0.42 credits"). */
export const creditsLabel = (micro: number) => t('credits.amount', { credits: creditsText(micro) });

/**
 * "≈ $0.012 · 3.4k tokens" or "3.4k tokens"; with Qutai Credits what the server charged, "0.42 credits · 3.4k tokens"
 * (exact, so without "≈", and never in dollars).
 */
export function costLine(c: { nanos?: number; credits?: number; usage: Usage }): string {
  const tokens = tokensLabel(totalTokens(c.usage));
  if (c.credits !== undefined) return t('cost.creditsLine', { credits: creditsLabel(c.credits), tokens });
  return c.nanos !== undefined ? t('cost.line', { cost: usd(c.nanos), tokens }) : tokens;
}

/** The price table's date ("2026-11-16") in the app's language. */
export function pricesDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return formatDate(new Date(y, m - 1, d));
}

const count = (n: number) => new Intl.NumberFormat(getLocale()).format(n);

/** Token kinds, searches and requests, one per line (kinds that are zero are left out). */
function usageLines(u: Usage): string[] {
  return [
    t('cost.input', { n: count(u.input) }),
    u.cacheRead ? t('cost.cacheRead', { n: count(u.cacheRead) }) : null,
    u.cacheWrite ? t('cost.cacheWrite', { n: count(u.cacheWrite) }) : null,
    u.cacheWriteLong ? t('cost.cacheWriteLong', { n: count(u.cacheWriteLong) }) : null,
    t('cost.output', { n: count(u.output) }) + (u.thinking ? ` (${t('cost.thinking', { n: count(u.thinking) })})` : ''),
    u.searches ? t('cost.searches', { n: count(u.searches) }) : null,
  ].filter((line): line is string => !!line);
}

/** Where the figure comes from, and what it leaves out. */
function sourceNote(c: { nanos?: number; credits?: number; source?: string; pricesAsOf?: string }): string {
  if (c.credits !== undefined) return t('cost.server');
  if (c.nanos === undefined) return t('cost.noPrice');
  if (c.source === 'provider') return t('cost.reported');
  if (c.source === 'server') return t('cost.server');
  return t('cost.estimate', { date: pricesDate(c.pricesAsOf ?? '') });
}

/** The breakdown of a request ("What was sent to the AI"). */
export function requestBreakdown(c: RequestCost): string {
  return [...usageLines(c.usage), '', sourceNote(c)].join('\n');
}

/** Shows the breakdown of an answer, with the conversation's total so far. */
export function showAnswerBreakdown(c: AnswerCost, conversation: AnswerCost[]) {
  const total = sumCosts(conversation);
  // Qutai Credits on a tier names no tier (CRED-39): "Model: Qutai Credits", and the model that really answered below.
  const name = modelLabel(c.provider, c.model) || getProvider(c.provider).label;
  const lines = [
    t('cost.model', { model: name }),
    ...(c.served && c.served.model !== c.model ? [t('cost.servedBy', { model: providerModelName(c.served.model) })] : []),
    t('cost.requests', { n: count(c.requests) }),
    ...usageLines(c.usage),
    ...(c.reported < c.requests ? ['', t('cost.unreported', { missing: c.requests - c.reported, total: c.requests })] : []),
    '',
    sourceNote(c),
    ...(conversation.length > 1
      ? [
          '',
          t('cost.conversation', {
            figure:
              total.credits !== undefined
                ? creditsLabel(total.credits)
                : total.nanos !== undefined
                  ? `≈ ${usd(total.nanos)}`
                  : tokensLabel(total.tokens),
          }),
        ]
      : []),
  ];
  const title =
    c.credits !== undefined
      ? t('cost.titleCredits', { credits: creditsLabel(c.credits) })
      : c.nanos !== undefined
        ? `${t('cost.title')} ≈ ${usd(c.nanos)}`
        : t('cost.titleTokens');
  dialog.alert(title, lines.join('\n'));
}

/** The figure without the tokens ("≈ $0.012", "0.42 credits"); the tokens when no price is known. */
export function costAmount(c: { nanos?: number; credits?: number; usage: Usage }): string {
  if (c.credits !== undefined) return creditsLabel(c.credits);
  return c.nanos !== undefined ? `≈ ${usd(c.nanos)}` : tokensLabel(totalTokens(c.usage));
}

/** What a screen reader says for the figure: always the full text, however much of it fits on screen. */
function costA11yLabel(cost: AnswerCost): string {
  const tokens = tokensLabel(totalTokens(cost.usage));
  return cost.credits !== undefined
    ? t('cost.a11yCredits', { credits: creditsLabel(cost.credits), tokens })
    : cost.nanos !== undefined
      ? t('cost.a11y', { cost: usd(cost.nanos), tokens })
      : tokens;
}

/** The small line under an item that has no row of icons (an error, a stopped task); a tap shows the breakdown. */
export function AnswerCostLine({ cost, conversation }: { cost: AnswerCost; conversation: () => AnswerCost[] }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => showAnswerBreakdown(cost, conversation())}
      hitSlop={6}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={costA11yLabel(cost)}
      accessibilityHint={t('cost.a11yHint')}
    >
      <Text style={styles.text}>{costLine(cost)}</Text>
    </Pressable>
  );
}

/**
 * The figure in an answer's row of icons, beside them. It never wraps and never pushes the icons away: with less room
 * (a narrow panel, a large text size) the tokens go first ("≈ $0.012"), then the amount is cut short with "…". Both
 * texts are measured off screen at their natural width and compared with `room`, the width left beside the icons.
 */
export function AnswerCostInline({
  cost,
  conversation,
  room,
  color,
}: {
  cost: AnswerCost;
  conversation: () => AnswerCost[];
  /** Points available beside the icons; null until the panel has been measured. */
  room: number | null;
  color: string;
}) {
  const styles = useStyles();
  const full = costLine(cost);
  const amount = costAmount(cost);
  const [widths, setWidths] = useState<{ full?: number; amount?: number }>({});
  const measured = room !== null && widths.full !== undefined && widths.amount !== undefined;
  // The padding (6pt each side) is part of the room the text needs.
  const text = !measured || costFit(widths.full!, widths.amount!, room!, 2 * INLINE_PAD) === 'full' ? full : amount;
  return (
    <Pressable
      onPress={() => showAnswerBreakdown(cost, conversation())}
      style={[styles.inline, room !== null && { maxWidth: Math.max(0, room) }, !measured && styles.measuring]}
      accessibilityRole="button"
      accessibilityLabel={costA11yLabel(cost)}
      accessibilityHint={t('cost.a11yHint')}
    >
      <Text style={[styles.inlineText, { color }]} numberOfLines={1} ellipsizeMode="tail">
        {text}
      </Text>
      {/* Off-screen measuring: wide enough that neither text is ever cut short while it is measured. */}
      <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text
          style={styles.inlineText}
          numberOfLines={1}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            setWidths((m) => (m.full === w ? m : { ...m, full: w }));
          }}
        >
          {full}
        </Text>
        <Text
          style={styles.inlineText}
          numberOfLines={1}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            setWidths((m) => (m.amount === w ? m : { ...m, amount: w }));
          }}
        >
          {amount}
        </Text>
      </View>
    </Pressable>
  );
}

const INLINE_PAD = 6;

const useStyles = makeStyles((c) => ({
  row: { alignSelf: 'flex-start', marginLeft: 4, marginTop: -2, marginBottom: 4 },
  text: { fontSize: 11, color: c.textSecondary },
  // As tall as the icons beside it (36pt plus 4pt of slop above and below makes a 44pt target).
  inline: { height: 36, justifyContent: 'center', paddingHorizontal: INLINE_PAD, flexShrink: 1, minWidth: 0, overflow: 'hidden' },
  inlineText: { fontSize: 12 },
  measuring: { opacity: 0 },
  measure: { position: 'absolute', left: 0, top: 0, width: 2000, opacity: 0, alignItems: 'flex-start' },
}));
