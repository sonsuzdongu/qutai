import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { track } from '../analytics';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccountState } from '../account';
import { creditsEnabled } from '../config/features';
import { creditsStore, creditsText, refreshCredits, useCreditsState } from '../credits';
import { t, type MessageKey } from '../i18n';
import type { LegalKind } from '../legal/documents';
import { noteStoreUsed, purchaseFlow, purchaseStore, storeName } from '../purchases';
import { packOffers, type BuyResult, type Pack, type PackOffer } from '../purchases/flow';
import type { StoreFailure, StoreProduct } from '../purchases/types';
import { Icon, type IconName } from '../ui/Icon';
import { Aurora } from '../ui/Aurora';
import { GradientButton, GradientText } from '../ui/BrandGradient';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
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

// Where the screen is drawn: the newest mounted host. On iOS a modal can't be presented while another one is up (UIKit
// refuses: "already presenting"), so a screen that is itself a modal (Settings) mounts its own host inside it, and the
// screen opens there; the app's root host takes over again when that modal closes. Android stacks modals, but one host
// at a time keeps it from showing twice there too.
const hosts: number[] = [];
let nextHost = 0;

/** Drawn at the app's root (App.tsx), above setup and the browser, and inside Settings (SettingsModal.tsx). */
export function BuyCreditsHost() {
  const [id] = useState(() => ++nextHost);
  useEffect(() => {
    hosts.push(id);
    emit();
    return () => {
      hosts.splice(hosts.indexOf(id), 1);
      emit();
    };
  }, [id]);
  const visible = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => open && hosts[hosts.length - 1] === id,
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

/** `float`: a short-lived floating notice over the screen (a cancelled purchase, UI-62) instead of a box in the page. */
type Status = { tone: 'ok' | 'info' | 'warn'; icon: IconName; text: string; float?: boolean };

/** How long a floating notice stays unless tapped away. */
const FLOAT_MS = 4000;

/**
 * Buying Qutai Credits (pro mode, signed in). The balance; what credits are; the packs Qutai's server offers for this
 * phone's store (`GET /config` › packs), each with its credits and the store's own price (never one of ours); buying
 * through the store, then `POST /purchases/verify` (src/purchases/flow.ts); every ending said plainly. Consumable
 * credits need no "Restore purchases" (Google Play and the App Store require one only for what stays owned, such as
 * subscriptions; the credits live in the Qutai account): "Check for missing credits" reports any purchase not credited
 * yet, including ones the store finished but the phone never reported, and reads the balance again. That credits are
 * not refunded through the app is said under the packs. Terms and privacy are one tap away. No link leads out of the
 * app to pay.
 */
function BuyCreditsScreen({ onClose }: { onClose: () => void }) {
  // Product analytics (with consent, SRV-31): only that the screen was opened.
  useEffect(() => track('purchase_screen_opened'), []);
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
  /** The device can't pay through its store at all (Play Store missing or billing unavailable). */
  const [billingOff, setBillingOff] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [legal, setLegal] = useState<LegalKind | null>(null);
  // A floating notice goes away by itself after FLOAT_MS, or when tapped.
  useEffect(() => {
    if (!status?.float) return;
    const timer = setTimeout(() => setStatus((s) => (s?.float ? null : s)), FLOAT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const packs: Pack[] = credits.config?.packs ?? [];
  const productIds = packs.filter((p) => p.store === storeName).map((p) => p.productId);
  const productKey = productIds.join(',');

  // The configuration (packs) and the balance; then the store's prices for this store's packs.
  useEffect(() => {
    creditsStore.config().catch(() => {});
    refreshCredits();
  }, []);
  useEffect(() => {
    if (store.unavailable || !userId || !productKey) return;
    let live = true;
    void (async () => {
      try {
        // The store's customer is this account before anything is asked (RevenueCat: configured or logged in here).
        await store.identify(userId);
        noteStoreUsed();
        if (store.canPay && !(await store.canPay())) {
          if (live) setBillingOff(true);
          return;
        }
        const p = await store.products(productKey.split(','));
        if (live) setProducts(p);
      } catch {
        if (live) setProductsFailed(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [store, userId, productKey]);

  /** What reporting the waiting purchases says (quiet: only when credits were added). */
  const lateStatus = (r: { credited: number; waiting: number }, quiet: boolean): Status | null =>
    r.credited > 0
      ? { tone: 'ok', icon: 'selected', text: t('buy.status.lateCredited', { credits: creditsText(r.credited) }) }
      : quiet
        ? null
        : r.waiting
          ? { tone: 'info', icon: 'wait', text: t('buy.status.notYet') }
          : { tone: 'info', icon: 'info', text: t('buy.status.nothingMissing') };

  // Opening the screen reports any purchase the server hasn't credited yet (quietly).
  useEffect(() => {
    if (!flow || !userId) return;
    let live = true;
    flow
      .retryPending(userId)
      .then((r) => {
        if (!live) return;
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
    } finally {
      setBusy(null);
      creditsStore.refreshCredits().catch(() => {});
    }
  };

  const offers = packOffers(packs, storeName, store.unavailable ? null : products);
  const loading = !credits.config && !credits.configError;
  const canBuy = !store.unavailable && signedIn && !suspended && !billingOff;

  const mostCredits = offers.length > 1 ? Math.max(...offers.map((o) => o.pack.credits)) : null;

  return (
    <SafeAreaView style={styles.screen}>
      {/* A paywall with the brand's look (UI-60): the drifting light behind the top, the mark, the name in the
          brand gradient, three facts, then the packs, compact enough that their buttons show without scrolling on a
          phone; the explanations and links come after them. */}
      <Aurora base={palette.bg} dark={palette.dark} fade={0.6} animate />
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')} style={styles.close}>
          <Icon name="close" size={20} color={palette.text} />
        </Pressable>
      </View>
      {/* Just under the close button, over the page; the zero-height holder keeps the page from moving. */}
      {status?.float && (
        <View style={styles.floatingHolder}>
          <Pressable
            style={styles.floating}
            onPress={() => setStatus(null)}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            accessibilityHint={t('common.close')}
          >
            <Icon name={status.icon} size={18} color={palette.onTint} />
            <Text style={styles.floatingText}>{status.text}</Text>
          </Pressable>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <QutaiMark size={56} sweepWhenIdle />
          <Text style={styles.title} accessibilityRole="header">
            {t('buy.title')}
          </Text>
          <GradientText style={styles.brand}>{t('credits.provider')}</GradientText>
          <View style={styles.balancePill} accessible accessibilityLiveRegion="polite">
            <Icon name="wallet" size={16} color={palette.tintText} />
            <Text style={styles.balanceText}>
              {credits.balance === null
                ? t('credits.balanceUnknown')
                : t('credits.balance', { credits: creditsText(credits.balance) })}
            </Text>
            {checking && <ActivityIndicator size="small" color={palette.textSecondary} />}
          </View>
        </View>

        <View style={styles.perks}>
          {PERKS.map((perk) => (
            <View key={perk.text} style={styles.perk}>
              <View style={styles.perkIcon}>
                <Icon name={perk.icon} size={16} color={palette.tintText} />
              </View>
              <Text style={styles.perkText}>{t(perk.text)}</Text>
            </View>
          ))}
        </View>

        {status && !status.float && (
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

        {!signedIn && <Text style={styles.notice}>{t('buy.signIn')}</Text>}
        {suspended && <Text style={[styles.notice, styles.warnText]}>{t('buy.suspended')}</Text>}
        {store.unavailable && <Text style={styles.notice}>{t(UNAVAILABLE[store.unavailable])}</Text>}
        {productsFailed && <Text style={styles.notice}>{t('buy.storeFailed')}</Text>}
        {billingOff && <Text style={styles.notice}>{t(Platform.OS === 'ios' ? 'buy.billingUnavailableIos' : 'buy.billingUnavailable')}</Text>}

        <Text style={styles.section} accessibilityRole="header">
          {t('buy.packs')}
        </Text>
        {loading && <ActivityIndicator color={palette.textSecondary} style={styles.loading} />}
        {!credits.config && credits.configError && (
          <Pressable onPress={() => void creditsStore.config(0).catch(() => {})} accessibilityRole="button">
            <Text style={styles.notice}>
              {credits.configError.message} <Text style={styles.link}>{t('credits.retry')}</Text>
            </Text>
          </Pressable>
        )}
        {credits.config && !store.unavailable && signedIn && productKey && products === null && !productsFailed && !billingOff && (
          <ActivityIndicator color={palette.textSecondary} style={styles.loading} />
        )}
        {credits.config && offers.length === 0 && !billingOff && (products !== null || store.unavailable || !productKey) && (
          <Text style={styles.hint}>{t('buy.noPacks')}</Text>
        )}
        {offers.map((offer) => {
          // Packs are whole credits: "100", not "100,00" (UI-63).
          const amount = t('credits.amount', { credits: wholeCredits(offer.pack.credits) });
          const working = busy === offer.pack.productId;
          const top = offer.pack.credits === mostCredits;
          return (
            <View key={offer.pack.productId} style={[styles.pack, top && styles.packTop]}>
              <View style={styles.packRow}>
                <View style={styles.packIcon}>
                  <Icon name="wallet" size={22} color={palette.tintText} />
                </View>
                <View style={styles.flex}>
                  {top && (
                    <View style={styles.badge}>
                      <GradientText style={styles.badgeText}>{t('buy.mostCredits')}</GradientText>
                    </View>
                  )}
                  <Text style={styles.packTitle}>{amount}</Text>
                  {!offer.price && <Text style={styles.hint}>{t('buy.noPrice')}</Text>}
                </View>
                {canBuy && offer.price && (
                  <GradientButton
                    label={offer.price}
                    accessibilityLabel={t('buy.buyLabel', { credits: amount, price: offer.price })}
                    onPress={() => buy(offer)}
                    disabled={!!busy && !working}
                    style={styles.buyButton}
                    textStyle={styles.buyText}
                  />
                )}
              </View>
            </View>
          );
        })}

        <Text style={styles.hint}>{t('buy.what')}</Text>
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
        <Text style={styles.hint}>{t(Platform.OS === 'ios' ? 'buy.refundNoteIos' : 'buy.refundNoteAndroid')}</Text>
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

/** What credits give, in three short lines (each true of every pack: BUY-1 consumables, CRED relay rules). */
const PERKS: { icon: IconName; text: MessageKey }[] = [
  { icon: 'key', text: 'buy.perk.noKey' },
  { icon: 'wallet', text: 'buy.perk.oneTime' },
  { icon: 'secure', text: 'buy.perk.private' },
];

const UNAVAILABLE: Record<NonNullable<ReturnType<typeof purchaseStore>['unavailable']>, MessageKey> = {
  notInBuild: 'buy.unavailable.notInBuild',
  notConfigured: 'buy.unavailable.notInBuild',
  notSupported: 'buy.unavailable.notSupported',
};

const FAILED: Record<StoreFailure, MessageKey> = {
  notAllowed: 'buy.status.notAllowed',
  billingUnavailable: Platform.OS === 'ios' ? 'buy.billingUnavailableIos' : 'buy.billingUnavailable',
  network: 'buy.status.network',
  productUnavailable: 'buy.status.productUnavailable',
  storeProblem: 'buy.status.failed',
  unknown: 'buy.status.failed',
};

/** A pack's credits without the decimals when they are whole ("100"); otherwise as the balance shows them. */
function wholeCredits(micro: number): string {
  const text = creditsText(micro);
  return micro % 1_000_000 === 0 ? text.replace(/[.,]0+$/, '') : text;
}

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
      return { tone: 'warn', icon: 'close', text: t('buy.status.cancelled'), float: true };
    case 'pending':
      return { tone: 'info', icon: 'wait', text: t('buy.status.pending') };
    case 'alreadyOwned':
      return { tone: 'info', icon: 'wait', text: t('buy.status.alreadyOwned') };
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
      return { tone: 'warn', icon: 'insecure', text: t(FAILED[result.reason]) };
  }
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: 4, paddingBottom: 4 },
  title: { color: c.textSecondary, fontSize: 14, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  brand: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  balanceText: { color: c.text, fontSize: 15, fontWeight: '600' },
  perks: { ...common(c).card, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perkIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.sunken,
  },
  perkText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 19 },
  hint: common(c).hint,
  section: { color: c.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  notice: common(c).notice,
  warnText: { color: c.danger },
  status: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', borderRadius: radii.control, padding: 12, backgroundColor: c.sunken },
  statusOk: { borderWidth: 1, borderColor: OK_GREEN },
  statusWarn: { borderWidth: 1, borderColor: c.danger },
  statusText: { flex: 1, color: c.text, fontSize: 14, lineHeight: 20 },
  floatingHolder: { height: 0, zIndex: 10, elevation: 6 },
  floating: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderRadius: radii.control,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: c.dangerFill,
    shadowColor: c.text,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  floatingText: { flex: 1, color: c.onTint, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  loading: { alignSelf: 'flex-start', marginVertical: 8 },
  pack: {
    backgroundColor: c.surface,
    borderRadius: radii.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  packTop: { borderWidth: 2, borderColor: c.tint, paddingVertical: 11, paddingHorizontal: 13 },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: c.sunken, marginBottom: 2 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  packIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.sunken,
  },
  packTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  buyButton: { minWidth: 104, minHeight: 44, paddingVertical: 8, paddingHorizontal: 18, borderRadius: radii.button },
  buyText: { fontSize: 14 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 8,
    borderRadius: radii.button,
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
