import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccountState } from '../account';
import { creditsEnabled } from '../config/features';
import { creditsStore, creditsText, refreshCredits, useCreditsState } from '../credits';
import { t, type MessageKey } from '../i18n';
import type { LegalKind } from '../legal/documents';
import { purchaseFlow, purchaseStore, storeName } from '../purchases';
import { packOffers, type BuyResult, type Pack, type PackOffer } from '../purchases/flow';
import type { StoreProduct } from '../purchases/types';
import { Icon, type IconName } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { DialogHost } from './Dialog';
import { LegalScreen } from './LegalScreen';

// --- Opening it from anywhere (setup, Settings › Account › Qutai Credits, the "not enough credits" message) ---

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Opens the buy-credits screen (pro mode only; nothing happens otherwise). */
export function openBuyCredits() {
  if (!creditsEnabled) return;
  open = true;
  emit();
}

function closeBuyCredits() {
  open = false;
  emit();
}

/** Drawn once at the app's root (App.tsx), above setup and the browser. */
export function BuyCreditsHost() {
  const visible = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => open,
  );
  if (!creditsEnabled) return null;
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeBuyCredits}>
      {visible && <BuyCreditsScreen onClose={closeBuyCredits} />}
      <DialogHost />
    </AppModal>
  );
}

// --- The screen ---

type Status = { tone: 'ok' | 'info' | 'warn'; icon: IconName; text: string };

/**
 * Buying Qutai Credits (pro mode, signed in). The balance; what credits are; the packs Qutai's server offers for this
 * phone's store (`GET /config` › packs), each with its credits and the store's own price (never one of ours); buying
 * through the store, then `POST /purchases/verify` (src/purchases/flow.ts); every ending said plainly. Consumable
 * credits need no restore at the stores; "Check for missing credits" reports any purchase not credited yet and reads
 * the balance again. Terms and privacy are one tap away. No link leads out of the app to pay.
 */
function BuyCreditsScreen({ onClose }: { onClose: () => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const account = useAccountState();
  const credits = useCreditsState();
  const store = purchaseStore();
  const flow = purchaseFlow();
  const signedIn = account.status === 'signedIn';
  const userId = account.status === 'signedIn' ? account.user.id : null;
  const suspended = account.status === 'signedIn' && account.user.status === 'suspended';
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [productsFailed, setProductsFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [legal, setLegal] = useState<LegalKind | null>(null);

  const packs: Pack[] = credits.config?.packs ?? [];
  const productIds = packs.filter((p) => p.store === storeName).map((p) => p.productId);
  const productKey = productIds.join(',');

  // The configuration (packs) and the balance; then the store's prices for this store's packs.
  useEffect(() => {
    creditsStore.config().catch(() => {});
    refreshCredits();
  }, []);
  useEffect(() => {
    if (store.unavailable || !signedIn || !productKey) return;
    let live = true;
    store
      .products(productKey.split(','))
      .then((p) => live && setProducts(p))
      .catch(() => live && setProductsFailed(true));
    return () => {
      live = false;
    };
  }, [store, signedIn, productKey]);

  /** What reporting the waiting purchases says (quiet: only when credits were added). */
  const lateStatus = (r: { credited: number; waiting: number }, quiet: boolean): Status | null =>
    r.credited > 0
      ? { tone: 'ok', icon: 'selected', text: t('buy.status.lateCredited', { credits: creditsText(r.credited) }) }
      : quiet || r.waiting
        ? null
        : { tone: 'info', icon: 'info', text: t('buy.status.nothingMissing') };

  // Opening the screen reports any purchase the server hasn't credited yet (quietly).
  useEffect(() => {
    if (!flow || !userId) return;
    let live = true;
    flow
      .retryPending(userId)
      .then((r) => {
        if (!live) return;
        setWaiting(r.waiting);
        const next = lateStatus(r, true);
        if (next) setStatus(next);
      })
      .catch(() => {})
      .finally(() => creditsStore.refreshCredits().catch(() => {}));
    return () => {
      live = false;
    };
  }, [flow, userId]);

  /** "Check for missing credits": reports purchases not credited yet and reads the balance again. */
  const check = useCallback(async () => {
    if (!flow || !userId) return;
    setChecking(true);
    try {
      const r = await flow.retryPending(userId);
      setWaiting(r.waiting);
      setStatus(lateStatus(r, false));
    } finally {
      await creditsStore.refreshCredits().catch(() => {});
      setChecking(false);
    }
  }, [flow, userId]);

  const buy = async (offer: PackOffer) => {
    if (!flow || !userId || busy) return;
    setBusy(offer.pack.productId);
    setStatus({ tone: 'info', icon: 'wallet', text: t('buy.status.inProgress') });
    try {
      const result = await flow.buy(offer.pack, userId);
      setStatus(statusFor(result));
      setWaiting(await flow.waiting(userId));
    } finally {
      setBusy(null);
      creditsStore.refreshCredits().catch(() => {});
    }
  };

  const offers = packOffers(packs, storeName, store.unavailable ? null : products);
  const loading = !credits.config && !credits.configError;
  const canBuy = !store.unavailable && signedIn && !suspended;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('buy.title')}
        </Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Icon name="close" size={22} color={palette.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>{t('credits.balanceTitle')}</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balance} accessibilityLiveRegion="polite">
              {credits.balance === null ? '–' : t('credits.amount', { credits: creditsText(credits.balance) })}
            </Text>
            {checking && <ActivityIndicator color={palette.textSecondary} />}
          </View>
          <Text style={styles.hint}>{t('buy.what')}</Text>
        </View>

        {status && (
          <View
            style={[styles.status, status.tone === 'ok' && styles.statusOk, status.tone === 'warn' && styles.statusWarn]}
            accessibilityLiveRegion="polite"
            accessible
          >
            <Icon
              name={status.icon}
              size={18}
              color={status.tone === 'warn' ? palette.danger : status.tone === 'ok' ? OK_GREEN : palette.textSecondary}
            />
            <Text style={styles.statusText}>{status.text}</Text>
          </View>
        )}
        {waiting > 0 && <Text style={styles.notice}>{t('buy.waiting', { count: waiting })}</Text>}

        {!signedIn && <Text style={styles.notice}>{t('buy.signIn')}</Text>}
        {suspended && <Text style={[styles.notice, styles.warnText]}>{t('buy.suspended')}</Text>}
        {store.unavailable && <Text style={styles.notice}>{t(UNAVAILABLE[store.unavailable])}</Text>}
        {productsFailed && <Text style={styles.notice}>{t('buy.storeFailed')}</Text>}

        <Text style={styles.section}>{t('buy.packs')}</Text>
        {loading && <ActivityIndicator color={palette.textSecondary} style={styles.loading} />}
        {!credits.config && credits.configError && (
          <Pressable onPress={() => void creditsStore.config(0).catch(() => {})} accessibilityRole="button">
            <Text style={styles.notice}>
              {credits.configError.message} <Text style={styles.link}>{t('credits.retry')}</Text>
            </Text>
          </Pressable>
        )}
        {credits.config && !store.unavailable && signedIn && productKey && products === null && !productsFailed && (
          <ActivityIndicator color={palette.textSecondary} style={styles.loading} />
        )}
        {credits.config && offers.length === 0 && (products !== null || store.unavailable || !productKey) && (
          <Text style={styles.hint}>{t('buy.noPacks')}</Text>
        )}
        {offers.map((offer) => {
          const amount = t('credits.amount', { credits: creditsText(offer.pack.credits) });
          const working = busy === offer.pack.productId;
          return (
            <View key={offer.pack.productId} style={styles.pack}>
              <View style={styles.packIcon}>
                <Icon name="wallet" size={20} color={palette.tintText} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.packTitle}>{amount}</Text>
                {!offer.price && <Text style={styles.hint}>{t('buy.noPrice')}</Text>}
              </View>
              {canBuy && offer.price && (
                <Pressable
                  onPress={() => void buy(offer)}
                  disabled={!!busy}
                  style={({ pressed }) => [styles.buyButton, pressed && styles.pressed, busy && !working && styles.dimmed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('buy.buyLabel', { credits: amount, price: offer.price })}
                  accessibilityState={{ busy: working, disabled: !!busy }}
                >
                  {working ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buyText}>{offer.price}</Text>}
                </Pressable>
              )}
            </View>
          );
        })}

        {signedIn && (
          <Pressable
            onPress={() => void check()}
            disabled={checking}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed, checking && styles.dimmed]}
            accessibilityRole="button"
            accessibilityState={{ busy: checking }}
          >
            <Icon name="reload" size={18} color={palette.text} />
            <Text style={styles.secondaryText}>{t('buy.check')}</Text>
          </Pressable>
        )}
        <Text style={styles.hint}>{t(Platform.OS === 'ios' ? 'buy.storeNoteIos' : 'buy.storeNoteAndroid')}</Text>
        <View style={styles.links}>
          <Pressable onPress={() => setLegal('terms')} accessibilityRole="link" hitSlop={6}>
            <Text style={styles.link}>{t('settings.terms')}</Text>
          </Pressable>
          <Pressable onPress={() => setLegal('privacy')} accessibilityRole="link" hitSlop={6}>
            <Text style={styles.link}>{t('settings.privacyPolicy')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <LegalScreen kind={legal} onClose={() => setLegal(null)} />
    </SafeAreaView>
  );
}

const OK_GREEN = '#3a9b5c';

const UNAVAILABLE: Record<NonNullable<ReturnType<typeof purchaseStore>['unavailable']>, MessageKey> = {
  notInBuild: 'buy.unavailable.notInBuild',
  notConfigured: 'buy.unavailable.notInBuild',
  notSupported: 'buy.unavailable.notSupported',
};

/** What the screen says after a purchase (the flow's ending). */
export function statusFor(result: BuyResult): Status {
  switch (result.kind) {
    case 'credited':
      return {
        tone: 'ok',
        icon: 'selected',
        text:
          result.balance === null
            ? t('buy.status.credited', { credits: creditsText(result.credits) })
            : t('buy.status.creditedBalance', { credits: creditsText(result.credits), balance: creditsText(result.balance) }),
      };
    case 'cancelled':
      return { tone: 'info', icon: 'info', text: t('buy.status.cancelled') };
    case 'pending':
      return { tone: 'info', icon: 'wait', text: t('buy.status.pending') };
    case 'notYetCredited':
      return { tone: 'info', icon: 'wait', text: t('buy.status.notYet') };
    case 'signedOut':
      return { tone: 'warn', icon: 'insecure', text: t('buy.status.signedOut') };
    case 'support':
      return { tone: 'warn', icon: 'insecure', text: t(result.reason === 'held' ? 'buy.status.held' : 'buy.status.rejected') };
    case 'reversed':
      return { tone: 'warn', icon: 'insecure', text: t('buy.status.reversed') };
    case 'suspended':
      return { tone: 'warn', icon: 'insecure', text: t('buy.suspended') };
    case 'unavailable':
      return { tone: 'info', icon: 'info', text: t(UNAVAILABLE[result.reason]) };
    case 'failed':
      return {
        tone: 'warn',
        icon: 'insecure',
        text: t(
          result.reason === 'notAllowed'
            ? 'buy.status.notAllowed'
            : result.reason === 'network'
              ? 'buy.status.network'
              : result.reason === 'productUnavailable'
                ? 'buy.status.productUnavailable'
                : 'buy.status.failed',
        ),
      };
  }
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { color: c.text, fontSize: 20, fontWeight: '700', flexShrink: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  card: { backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 6 },
  label: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balance: { color: c.text, fontSize: 30, fontWeight: '700' },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  section: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 8 },
  notice: { fontSize: 14, lineHeight: 19, color: c.text, backgroundColor: c.sunken, borderRadius: 10, padding: 12 },
  warnText: { color: c.danger },
  status: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: 12, padding: 12, backgroundColor: c.sunken },
  statusOk: { borderWidth: 1, borderColor: OK_GREEN },
  statusWarn: { borderWidth: 1, borderColor: c.danger },
  statusText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
  loading: { alignSelf: 'flex-start', marginVertical: 8 },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
  },
  packIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.sunken,
  },
  packTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
  buyButton: {
    minWidth: 96,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    marginTop: 4,
  },
  secondaryText: { color: c.text, fontSize: 15, fontWeight: '600' },
  links: { flexDirection: 'row', gap: 24, justifyContent: 'center', marginTop: 4 },
  link: { color: c.tintText, fontWeight: '600', fontSize: 14 },
  pressed: { opacity: 0.8 },
  dimmed: { opacity: 0.5 },
}));
