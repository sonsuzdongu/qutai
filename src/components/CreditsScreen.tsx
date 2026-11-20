import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { creditsStore, creditsText, useCreditsState } from '../credits';
import { RelayError } from '../credits/errors';
import type { LedgerEntry, LedgerKind } from '../credits/types';
import { t, type MessageKey } from '../i18n';
import { formatDate } from '../i18n/format';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { openBuyCredits } from './BuyCredits';

const KIND_LABEL: Record<LedgerKind, MessageKey> = {
  purchase: 'credits.kind.purchase',
  grant: 'credits.kind.grant',
  reserve: 'credits.kind.reserve',
  settle: 'credits.kind.settle',
  refund: 'credits.kind.refund',
  revoke: 'credits.kind.revoke',
};

/** "+12.00" / "-0.42". */
function signed(amount: number): string {
  return `${amount > 0 ? '+' : amount < 0 ? '-' : ''}${creditsText(Math.abs(amount))}`;
}

/**
 * Settings › Account › Qutai Credits (pro mode, signed in): the balance and the latest movements of the account's
 * credits as the server's ledger lists them (`GET /credits`): date, what, amount. Each request to the AI holds the
 * most it could cost and gives back what it didn't use, so a request shows as a hold and a return.
 */
export function CreditsScreen() {
  const styles = useStyles();
  const palette = usePalette();
  const state = useCreditsState();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** Bumped by "Try again" to read the ledger again. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    creditsStore
      .refreshCredits(100)
      .then(() => live && setError(null))
      .catch((e) => live && setError(e instanceof RelayError ? e.message : t('credits.error.unexpected')))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [attempt]);
  const load = () => {
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.label}>{t('credits.balanceTitle')}</Text>
        <Text style={styles.balance} accessibilityRole="header">
          {state.balance === null ? '–' : t('credits.amount', { credits: creditsText(state.balance) })}
        </Text>
        <Pressable onPress={openBuyCredits} style={styles.button} accessibilityRole="button">
          <Icon name="wallet" size={18} color={palette.text} />
          <Text style={styles.buttonText}>{t('buy.open')}</Text>
        </Pressable>
      </View>
      {state.balance !== null && state.balance < 0 && <Text style={styles.notice}>{t('credits.negative')}</Text>}
      <Text style={styles.hint}>{t('credits.historyHint')}</Text>

      <Text style={styles.section}>{t('credits.history')}</Text>
      {error && (
        <Pressable onPress={load} accessibilityRole="button">
          <Text style={styles.notice}>
            {error} <Text style={styles.link}>{t('credits.retry')}</Text>
          </Text>
        </Pressable>
      )}
      {loading && !state.entries && <ActivityIndicator color={palette.textSecondary} />}
      {state.entries && state.entries.length === 0 && <Text style={styles.hint}>{t('credits.historyEmpty')}</Text>}
      {state.entries && state.entries.length > 0 && (
        <View style={styles.list}>
          {state.entries.map((e, i) => (
            <Row key={e.id} entry={e} last={i === state.entries!.length - 1} />
          ))}
        </View>
      )}
    </>
  );
}

function Row({ entry, last }: { entry: LedgerEntry; last: boolean }) {
  const styles = useStyles();
  const when = new Date(entry.at);
  const time = `${formatDate(when)} ${when.toTimeString().slice(0, 5)}`;
  return (
    <View
      style={[styles.row, !last && styles.rowLine]}
      accessible
      accessibilityLabel={`${t(KIND_LABEL[entry.kind])}, ${signed(entry.amount)}, ${time}`}
    >
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{t(KIND_LABEL[entry.kind])}</Text>
        <Text style={styles.hint}>{time}</Text>
      </View>
      <Text style={[styles.amount, entry.amount > 0 && styles.plus]}>{signed(entry.amount)}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: { ...common(c).card, padding: 14, gap: 6 },
  label: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  balance: { color: c.text, fontSize: 28, fontWeight: '700' },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  section: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 12 },
  notice: common(c).notice,
  link: { color: c.tintText, fontWeight: '600' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 42,
    borderRadius: radii.button,
    marginTop: 6,
    backgroundColor: c.sunken,
  },
  buttonText: { color: c.text, fontSize: 15, fontWeight: '600' },
  list: { ...common(c).card, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { color: c.text, fontSize: 15 },
  amount: { color: c.text, fontSize: 15, fontVariant: ['tabular-nums'] },
  plus: { color: '#3a9b5c' },
}));
