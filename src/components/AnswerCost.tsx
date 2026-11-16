import { Pressable, Text } from 'react-native';
import { AnswerCost, formatUsd, RequestCost, sumCosts } from '../ai/cost';
import { modelLabel } from '../ai/providers';
import { totalTokens, type Usage } from '../ai/usage';
import { getLanguage, t } from '../i18n';
import { formatDate, formatNumber } from '../i18n/format';
import { makeStyles } from '../ui/theme';
import { dialog } from './Dialog';
import { creditsText } from '../credits';

/**
 * The approximate cost of an answer or a request (ai/cost.ts) as people read it: "≈ $0.012 · 3.4k tokens", or the
 * tokens alone when no price is known. Never a price the app doesn't have.
 */

const decimal = () => (getLanguage() === 'tr' ? ',' : '.');

export const usd = (nanos: number) => formatUsd(nanos, decimal());

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

const count = (n: number) => new Intl.NumberFormat(getLanguage() === 'tr' ? 'tr-TR' : 'en-US').format(n);

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
  const lines = [
    t('cost.model', { model: modelLabel(c.provider, c.model) }),
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

/** The small line under an answer; a tap shows the breakdown. */
export function AnswerCostLine({ cost, conversation }: { cost: AnswerCost; conversation: () => AnswerCost[] }) {
  const styles = useStyles();
  const line = costLine(cost);
  const tokens = tokensLabel(totalTokens(cost.usage));
  return (
    <Pressable
      onPress={() => showAnswerBreakdown(cost, conversation())}
      hitSlop={6}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={
        cost.credits !== undefined
          ? t('cost.a11yCredits', { credits: creditsLabel(cost.credits), tokens })
          : cost.nanos !== undefined
            ? t('cost.a11y', { cost: usd(cost.nanos), tokens })
            : tokens
      }
      accessibilityHint={t('cost.a11yHint')}
    >
      <Text style={styles.text}>{line}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: { alignSelf: 'flex-start', marginLeft: 4, marginTop: -2, marginBottom: 4 },
  text: { fontSize: 11, color: c.textSecondary },
}));
