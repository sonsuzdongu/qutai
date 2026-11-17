import { ComponentRef, ReactNode, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { getLocales } from 'expo-localization';
import type { MemoryCategory } from '../agent/memory';
import { features } from '../config/features';
import { ensureLocationPermission, LocationUnavailableError, readPlaceName } from '../device/location';
import { normalizePhone } from '../device/phone';
import { openSettingsOrExplain, PermissionDeniedError } from '../device/settings';
import { getLanguage, MessageKey, t } from '../i18n';
import { getDb } from '../storage/db';
import { addMemory, deleteMemory, listMemories, updateMemory } from '../storage/memory';
import { memoryErrorText } from './memoryError';
import { GradientButton } from '../ui/BrandGradient';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { dialog } from './Dialog';
import { KeyboardAwareScrollView, useRevealFocused } from './KeyboardAware';
import { CATEGORY_ICONS } from './memoryCategories';
import { TranscriptCard } from './VoiceIntro';

/**
 * "Let me get to know you a little": a fixed form (no AI request) that saves a few facts into memory, in the same
 * one-fact-per-line form `remember` writes. Shown once in setup, after the AI step, when memory is on; the Memory
 * screen offers it again ("Answer a few questions"). Every page can be skipped, and so can the whole thing.
 *
 * The answer-style question writes a line to the custom instructions (Settings › Assistant), not to memory: it is a
 * standing instruction about replies, which is what that setting is for.
 */

type Page = 'intro' | 'name' | 'city' | 'shopping' | 'food' | 'style' | 'offer' | 'address' | 'summary';
const PAGES: Page[] = ['intro', 'name', 'city', 'shopping', 'food', 'style', 'offer', 'address', 'summary'];
const QUESTIONS: Page[] = ['name', 'city', 'shopping', 'food', 'style'];

/** Each saved fact has a slot, so answering again replaces it instead of adding another. */
type Slot = 'name' | 'city' | 'payment' | 'delivery' | 'food' | 'fullName' | 'phone' | 'email' | 'shipTo' | 'billTo';

type Payment = 'cod' | 'card' | 'none';
type Style = 'short' | 'detailed';
type Address = {
  line: string;
  district: string;
  city: string;
  postal: string;
  country: string;
};

const DELIVERY_CHIPS: MessageKey[] = [
  'profile.chip.noBell',
  'profile.chip.callFirst',
  'profile.chip.leaveDoor',
  'profile.chip.doorman',
];
const FOOD_CHIPS: MessageKey[] = [
  'profile.chip.vegetarian',
  'profile.chip.vegan',
  'profile.chip.halal',
  'profile.chip.glutenFree',
  'profile.chip.lactoseFree',
  'profile.chip.nutAllergy',
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The device region's country name, in the app's language where the engine knows it. */
function defaultCountry(): string {
  const region = getLocales()[0]?.regionCode;
  if (!region) return '';
  if (region === 'TR') return 'Türkiye';
  try {
    return new Intl.DisplayNames([getLanguage()], { type: 'region' }).of(region) ?? region;
  } catch {
    return region;
  }
}

const emptyAddress = (city = '', country = ''): Address => ({
  line: '',
  district: '',
  city,
  postal: '',
  country,
});

/** "Atatürk Cad. 12/3, Kadıköy, 34710 İstanbul, Türkiye". */
function addressText(a: Address): string {
  return [a.line, a.district, `${a.postal} ${a.city}`.trim(), a.country]
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
}

/** Only the country (filled in for the user) is not an address. */
const hasAddress = (a: Address) => !!(a.line.trim() || a.district.trim() || a.postal.trim() || a.city.trim());

type Props = {
  /** Changes the page; setup blurs out and in like its own steps. */
  transition?: (change: () => void) => void;
  /** Updates the custom instructions (the answer-style question). */
  onInstructions: (update: (current: string) => string) => void;
  /** Finished or skipped. */
  onDone: () => void;
  /**
   * Gives the screen around it this flow's back step while it is shown (false: already at the start), for that
   * screen's back button; null when it goes away.
   */
  registerBack: (handler: (() => boolean) | null) => void;
  /** The first page: 'name' when "Tell me about yourself" leads here (its own intro said what this is). */
  startAt?: 'intro' | 'name';
  /** What the user said in "Tell me about yourself" before ending up here, shown so they can copy from it. */
  transcript?: string;
};

export function ProfileQuestions({ transition, onInstructions, onDone, registerBack, startAt = 'intro', transcript }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState<Page>(startAt);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [deliveryChips, setDeliveryChips] = useState<string[]>([]);
  const [deliveryText, setDeliveryText] = useState('');
  const [foodChips, setFoodChips] = useState<string[]>([]);
  const [foodText, setFoodText] = useState('');
  const [style, setStyle] = useState<Style | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [shipTo, setShipTo] = useState<Address>(() => emptyAddress('', defaultCountry()));
  const [billingDifferent, setBillingDifferent] = useState(false);
  const [billTo, setBillTo] = useState<Address>(() => emptyAddress('', defaultCountry()));
  /** Memory ids of what this flow saved, by slot. */
  const saved = useRef<Partial<Record<Slot, string>>>({});
  /** The custom-instructions line this flow added, replaced if the answer changes. */
  const styleLine = useRef<string | null>(null);
  const [summary, setSummary] = useState<{ id: string; text: string; category: MemoryCategory }[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [instructionLine, setInstructionLine] = useState<string | null>(null);

  const go = (to: Page) => {
    // Onboarding's transition closes the keyboard itself; the Memory screen's sheet has none.
    Keyboard.dismiss();
    const change = () => {
      setPage(to);
      setEditing(null);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    };
    if (transition) transition(change);
    else change();
  };
  const at = PAGES.indexOf(page);

  useEffect(() => {
    registerBack(() => {
      if (page === startAt) return false;
      // The summary comes after the address offer whichever way it was reached.
      go(page === 'summary' ? 'offer' : PAGES[at - 1]);
      return true;
    });
    return () => registerBack(null);
  });

  /** Saves, replaces or (empty text) removes the fact in a slot. A refused fact is said, never blocks. */
  const saveSlot = async (slot: Slot, text: string | null, category: MemoryCategory) => {
    const db = await getDb();
    const id = saved.current[slot];
    try {
      if (!text?.trim()) {
        if (id) await deleteMemory(db, id);
        delete saved.current[slot];
        return;
      }
      if (id && (await listMemories(db)).some((m) => m.id === id)) await updateMemory(db, id, text, category);
      else saved.current[slot] = (await addMemory(db, text, category)).id;
    } catch (e) {
      dialog.alert(t('memory.saveFailed'), memoryErrorText(e));
    }
  };

  const fact = (key: MessageKey, value: string) => t(key, { value: value.replace(/\s+/g, ' ').trim() });

  const saveStyle = (next: Style | null) => {
    const line = next ? t(next === 'short' ? 'profile.style.shortLine' : 'profile.style.detailedLine') : null;
    const previous = styleLine.current;
    styleLine.current = line;
    setInstructionLine(line);
    onInstructions((current) => {
      const lines = current.split('\n').filter((l) => l.trim() && l.trim() !== previous);
      if (line && !lines.includes(line)) lines.push(line);
      return lines.join('\n');
    });
  };

  const loadSummary = async () => {
    const ids = new Set(Object.values(saved.current));
    const memories = await listMemories(await getDb()).catch(() => []);
    setSummary(memories.filter((m) => ids.has(m.id)).reverse());
  };

  /** Saves the answer of the page being left (an empty answer removes what was saved for it). */
  const commit = async () => {
    if (page === 'name') await saveSlot('name', name.trim() ? fact('profile.fact.name', name) : null, 'identity');
    if (page === 'city') await saveSlot('city', city.trim() ? fact('profile.fact.city', city) : null, 'addresses');
    if (page === 'shopping') {
      await saveSlot(
        'payment',
        payment === 'cod' ? t('profile.fact.paymentCod') : payment === 'card' ? t('profile.fact.paymentCard') : null,
        'shopping',
      );
      const note = [...deliveryChips, deliveryText.trim()].filter(Boolean).join('. ');
      await saveSlot('delivery', note ? fact('profile.fact.delivery', note) : null, 'shopping');
    }
    if (page === 'food') {
      const food = [...foodChips, foodText.trim()].filter(Boolean).join(', ');
      await saveSlot('food', food ? fact('profile.fact.food', food) : null, 'food');
    }
    if (page === 'style') saveStyle(style);
    if (page === 'address') {
      await saveSlot('fullName', fullName.trim() ? fact('profile.fact.fullName', fullName) : null, 'identity');
      await saveSlot('phone', phone.trim() ? fact('profile.fact.phone', phone) : null, 'identity');
      await saveSlot('email', email.trim() ? fact('profile.fact.email', email.trim()) : null, 'identity');
      await saveSlot(
        'shipTo',
        hasAddress(shipTo) ? fact('profile.fact.shipTo', addressText(shipTo)) : null,
        'addresses',
      );
      await saveSlot(
        'billTo',
        billingDifferent && hasAddress(billTo) ? fact('profile.fact.billTo', addressText(billTo)) : null,
        'addresses',
      );
    }
  };

  const toSummary = async () => {
    await loadSummary();
    go('summary');
  };

  const next = async () => {
    if (page === 'intro') return go('name');
    await commit();
    if (page === 'style') return go('offer');
    if (page === 'offer' || page === 'address') return toSummary();
    if (page === 'summary') return onDone();
    go(PAGES[at + 1]);
  };

  /** A question left with nothing filled in moves on as "Skip". */
  const answered =
    (page === 'name' && !!name.trim()) ||
    (page === 'city' && !!city.trim()) ||
    (page === 'shopping' && (!!payment || deliveryChips.length > 0 || !!deliveryText.trim())) ||
    (page === 'food' && (foodChips.length > 0 || !!foodText.trim())) ||
    (page === 'style' && !!style) ||
    (page === 'address' &&
      (!!fullName.trim() || !!phone.trim() || !!email.trim() || hasAddress(shipTo) || hasAddress(billTo)));

  const primary =
    page === 'intro'
      ? t('profile.start')
      : page === 'offer'
        ? t('profile.offerYes')
        : page === 'summary'
          ? t('common.done')
          : page === 'address'
            ? t(answered ? 'common.save' : 'profile.skip')
            : t(answered ? 'onboarding.continue' : 'profile.skip');

  const onPrimary = () => (page === 'offer' ? go('address') : void next());

  const privacy = t(features.pro ? 'profile.privacyPro' : 'profile.privacy');

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  // The keyboard's Next goes through the contact and address fields in order; Done on the last closes it.
  const [fields] = useState(() => new Map<string, ComponentRef<typeof TextInput>>());
  const addressKeys: (keyof Address)[] = ['line', 'district', 'city', 'postal', 'country'];
  const fieldOrder = [
    'fullName',
    'phone',
    'email',
    ...addressKeys.map((k) => `shipTo.${k}`),
    ...(billingDifferent ? addressKeys.map((k) => `billTo.${k}`) : []),
  ];
  const chain = (key: string): ChainProps => {
    const next = fieldOrder[fieldOrder.indexOf(key) + 1];
    return {
      inputRef: (node) => {
        if (node) fields.set(key, node);
        else fields.delete(key);
      },
      returnKeyType: next ? 'next' : 'done',
      // Kept open between fields, so the keyboard does not drop and come back.
      submitBehavior: next ? 'submit' : 'blurAndSubmit',
      onSubmitEditing: () => (next ? fields.get(next)?.focus() : Keyboard.dismiss()),
    };
  };
  const phoneHint = phone.trim() && !normalizePhone(phone).ok ? t('profile.phoneHint') : null;
  const emailHint = email.trim() && !EMAIL.test(email.trim()) ? t('profile.emailHint') : null;

  const removeSummary = async (id: string) => {
    await deleteMemory(await getDb(), id).catch(() => false);
    for (const [slot, value] of Object.entries(saved.current)) if (value === id) delete saved.current[slot as Slot];
    setSummary((list) => list.filter((m) => m.id !== id));
  };
  const saveSummaryEdit = async () => {
    if (!editing) return;
    const { id, text } = editing;
    setEditing(null);
    try {
      await updateMemory(await getDb(), id, text);
    } catch (e) {
      dialog.alert(t('memory.saveFailed'), memoryErrorText(e));
    }
    if (!text.trim()) return removeSummary(id);
    await loadSummary();
  };

  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.bottom}>
          <GradientButton label={primary} onPress={onPrimary} style={styles.primary} textStyle={styles.primaryText} />
          {page === 'intro' && (
            <Pressable onPress={onDone} style={styles.secondary} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.secondaryText}>{t('profile.skipAll')}</Text>
            </Pressable>
          )}
          {page === 'offer' && (
            <Pressable onPress={() => void toSummary()} style={styles.secondary} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.secondaryText}>{t('profile.skip')}</Text>
            </Pressable>
          )}
          {QUESTIONS.includes(page) && (
            <Pressable
              onPress={async () => {
                await commit();
                await toSummary();
              }}
              style={styles.secondary}
              accessibilityRole="button"
              hitSlop={6}
            >
              <Text style={styles.secondaryText}>{t('profile.finishLater')}</Text>
            </Pressable>
          )}
        </View>
      }
    >
      {page === 'intro' && (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {t('profile.introTitle')}
          </Text>
          <Text style={styles.lead}>{t('profile.introLead')}</Text>
          <View style={styles.card}>
            <Text style={styles.hint}>{privacy}</Text>
          </View>
        </>
      )}

      {QUESTIONS.includes(page) && !!transcript && <TranscriptCard text={transcript} />}

      {QUESTIONS.includes(page) && (
        <Text style={styles.counter}>
          {t('profile.questionOf', {
            n: QUESTIONS.indexOf(page) + 1,
            total: QUESTIONS.length,
          })}
        </Text>
      )}

      {page === 'name' && (
        <Question title={t('profile.nameTitle')} lead={t('profile.nameLead')}>
          <Field
            value={name}
            onChange={setName}
            placeholder={t('profile.namePlaceholder')}
            autoComplete="given-name"
            textContentType="givenName"
            autoCapitalize="words"
            returnKeyType="done"
          />
        </Question>
      )}

      {page === 'city' && (
        <Question title={t('profile.cityTitle')} lead={t('profile.cityLead')}>
          <Field
            value={city}
            onChange={setCity}
            placeholder={t('profile.cityPlaceholder')}
            autoCapitalize="words"
            returnKeyType="done"
          />
          <FillFromLocation onFill={setCity} />
        </Question>
      )}

      {page === 'shopping' && (
        <Question title={t('profile.shoppingTitle')} lead={t('profile.shoppingLead')}>
          <Text style={styles.label}>{t('profile.paymentLabel')}</Text>
          <Chips
            options={[t('profile.payment.cod'), t('profile.payment.card'), t('profile.payment.none')]}
            selected={payment ? [t(`profile.payment.${payment}`)] : []}
            onPress={(label) => {
              const value = (['cod', 'card', 'none'] as Payment[]).find((p) => t(`profile.payment.${p}`) === label)!;
              setPayment(payment === value ? null : value);
            }}
          />
          <Text style={styles.label}>{t('profile.deliveryLabel')}</Text>
          <Chips
            options={DELIVERY_CHIPS.map((k) => t(k))}
            selected={deliveryChips}
            onPress={(c) => setDeliveryChips(toggle(deliveryChips, c))}
          />
          <Field
            value={deliveryText}
            onChange={setDeliveryText}
            placeholder={t('profile.deliveryPlaceholder')}
            multiline
          />
        </Question>
      )}

      {page === 'food' && (
        <Question title={t('profile.foodTitle')} lead={t('profile.foodLead')}>
          <Chips
            options={FOOD_CHIPS.map((k) => t(k))}
            selected={foodChips}
            onPress={(c) => setFoodChips(toggle(foodChips, c))}
          />
          <Field
            value={foodText}
            onChange={setFoodText}
            placeholder={t('profile.foodPlaceholder')}
            returnKeyType="done"
          />
        </Question>
      )}

      {page === 'style' && (
        <Question title={t('profile.styleTitle')} lead={t('profile.styleLead')}>
          <Chips
            options={[t('profile.style.short'), t('profile.style.detailed')]}
            selected={style ? [t(`profile.style.${style}`)] : []}
            onPress={(label) => {
              const value: Style = label === t('profile.style.short') ? 'short' : 'detailed';
              setStyle(style === value ? null : value);
            }}
          />
        </Question>
      )}

      {page === 'offer' && (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {t('profile.offerTitle')}
          </Text>
          <Text style={styles.lead}>{t('profile.offerLead')}</Text>
          <View style={styles.card}>
            <Text style={styles.hint}>{privacy}</Text>
          </View>
        </>
      )}

      {page === 'address' && (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {t('profile.addressTitle')}
          </Text>
          <Text style={styles.hint}>{t('profile.addressLead')}</Text>
          <Text style={styles.label}>{t('profile.contactLabel')}</Text>
          <Field
            value={fullName}
            onChange={setFullName}
            placeholder={t('profile.fullName')}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            {...chain('fullName')}
          />
          <Field
            value={phone}
            onChange={setPhone}
            placeholder={t('profile.phone')}
            autoComplete="tel"
            textContentType="telephoneNumber"
            keyboardType="phone-pad"
            {...chain('phone')}
          />
          {phoneHint && <Text style={styles.warning}>{phoneHint}</Text>}
          <Field
            value={email}
            onChange={setEmail}
            placeholder={t('profile.email')}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            {...chain('email')}
          />
          {emailHint && <Text style={styles.warning}>{emailHint}</Text>}
          <Text style={styles.label}>{t('profile.shipToLabel')}</Text>
          <AddressFields value={shipTo} onChange={setShipTo} fallbackCity={city} chain={(k) => chain(`shipTo.${k}`)} />
          <Pressable
            onPress={() => setBillingDifferent(!billingDifferent)}
            style={styles.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: billingDifferent }}
          >
            <View style={[styles.checkbox, billingDifferent && styles.checkboxOn]}>
              {billingDifferent && <Icon name="check" size={16} color="#ffffff" />}
            </View>
            <Text style={styles.checkText}>{t('profile.billingDifferent')}</Text>
          </Pressable>
          {billingDifferent && (
            <AddressFields
              value={billTo}
              onChange={setBillTo}
              fallbackCity={city}
              chain={(k) => chain(`billTo.${k}`)}
            />
          )}
          <Text style={styles.hint}>{t('profile.moreAddresses')}</Text>
        </>
      )}

      {page === 'summary' && (
        <>
          <Text style={styles.title} accessibilityRole="header">
            {t('profile.summaryTitle')}
          </Text>
          <Text style={styles.lead}>
            {t(summary.length || instructionLine ? 'profile.summaryLead' : 'profile.summaryEmpty')}
          </Text>
          {summary.map((m) =>
            editing?.id === m.id ? (
              <View key={m.id} style={styles.savedRow}>
                <TextInput
                  style={styles.savedInput}
                  value={editing.text}
                  onChangeText={(text) => setEditing({ id: m.id, text })}
                  onBlur={saveSummaryEdit}
                  autoFocus
                  multiline
                  submitBehavior="blurAndSubmit"
                  returnKeyType="done"
                  accessibilityLabel={t('memory.editHint')}
                />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                key={m.id}
                onPress={() => setEditing({ id: m.id, text: m.text })}
                style={({ pressed }) => [styles.savedRow, pressed && styles.pressed]}
                accessibilityHint={t('memory.editHint')}
              >
                <Icon name={CATEGORY_ICONS[m.category]} size={18} color={palette.textSecondary} />
                <Text style={styles.savedText}>{m.text}</Text>
                <Pressable
                  onPress={() => removeSummary(m.id)}
                  hitSlop={10}
                  style={styles.remove}
                  accessibilityRole="button"
                  accessibilityLabel={t('memory.delete')}
                >
                  <Icon name="close" size={14} color={palette.textSecondary} />
                </Pressable>
              </Pressable>
            ),
          )}
          {instructionLine && (
            <View style={styles.savedRow}>
              <Icon name="preferences" size={18} color={palette.textSecondary} />
              <Text style={styles.savedText}>{t('profile.summaryInstruction', { line: instructionLine })}</Text>
              <Pressable
                onPress={() => {
                  setStyle(null);
                  saveStyle(null);
                }}
                hitSlop={10}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={t('profile.removeInstruction')}
              >
                <Icon name="close" size={14} color={palette.textSecondary} />
              </Pressable>
            </View>
          )}
          <Text style={styles.hint}>{t('profile.summaryHint')}</Text>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}

function Question({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.lead}>{lead}</Text>
      {children}
    </>
  );
}

function Chips({
  options,
  selected,
  onPress,
}: {
  options: string[];
  selected: string[];
  onPress: (o: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => onPress(o)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * "Use my location" under the city field: reads the position (about 100 m) and fills in the neighbourhood, district,
 * province or state and country as the address service names them (device/location.ts readPlaceName). Uses the
 * location permission the setup step may already have; asks for it here only if it was never decided. The user can
 * edit or clear the text; typing works without any of this.
 */
function FillFromLocation({ onFill }: { onFill: (text: string) => void }) {
  const styles = useStyles();
  const palette = usePalette();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; settings: boolean } | null>(null);
  const fill = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await ensureLocationPermission();
      const place = await readPlaceName();
      onFill(place.parts.join(', '));
    } catch (e) {
      if (e instanceof PermissionDeniedError) {
        setProblem({ text: t('profile.locationDenied'), settings: !e.canAskAgain });
      } else if (e instanceof LocationUnavailableError && e.reason === 'servicesOff') {
        setProblem({ text: t('profile.locationOff'), settings: false });
      } else if (e instanceof LocationUnavailableError && e.reason === 'timeout') {
        setProblem({ text: t('profile.locationTimeout'), settings: false });
      } else if (e instanceof LocationUnavailableError && e.reason === 'needsBuild') {
        setProblem({ text: t('profile.locationUnavailable'), settings: false });
      } else {
        setProblem({ text: t('profile.locationFailed'), settings: false });
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.locationBox}>
      <Pressable
        onPress={() => void fill()}
        disabled={busy}
        style={({ pressed }) => [styles.locationButton, (pressed || busy) && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ busy }}
      >
        <Icon name="location" size={18} color={palette.tintText} />
        <Text style={styles.locationText}>{t(busy ? 'profile.locationBusy' : 'profile.useLocation')}</Text>
      </Pressable>
      {problem && (
        <Text style={styles.warning} accessibilityLiveRegion="polite">
          {problem.text}
        </Text>
      )}
      {problem?.settings && (
        <Pressable onPress={openSettingsOrExplain} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.locationText}>{t('settings.openSystem')}</Text>
        </Pressable>
      )}
      <Text style={styles.hint}>
        {t(Platform.OS === 'ios' ? 'profile.locationPrivacyIos' : 'profile.locationPrivacyAndroid')}
      </Text>
    </View>
  );
}

/** What moves the keyboard's Next from one field to the following one. */
type ChainProps = {
  inputRef?: (node: ComponentRef<typeof TextInput> | null) => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  submitBehavior?: TextInputProps['submitBehavior'];
  onSubmitEditing?: () => void;
};

function Field({
  value,
  onChange,
  placeholder,
  multiline,
  autoComplete,
  textContentType,
  keyboardType,
  autoCapitalize,
  inputRef,
  returnKeyType,
  submitBehavior,
  onSubmitEditing,
}: ChainProps & {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  keyboardType?: 'phone-pad' | 'email-address';
  autoCapitalize?: TextInputProps['autoCapitalize'];
}) {
  const styles = useStyles();
  const palette = usePalette();
  const reveal = useRevealFocused();
  const own = useRef<ComponentRef<typeof TextInput> | null>(null);
  return (
    <TextInput
      ref={(node) => {
        own.current = node;
        inputRef?.(node);
      }}
      style={[styles.input, multiline && styles.inputMulti]}
      value={value}
      onChangeText={(text) => {
        // Autofill (Android's autofill service, an iOS contact suggestion) can fill a whole set of fields from the one
        // the user picked in: choosing a saved email also replaced the phone number typed above it. A field takes
        // text only while it is the one being edited (or when none is); otherwise the change is ignored and
        // TextInput puts the field's own value back.
        const focused = TextInput.State.currentlyFocusedInput();
        if (focused && focused !== own.current) return;
        onChange(text);
      }}
      onFocus={() => reveal?.()}
      placeholder={placeholder}
      placeholderTextColor={palette.textSecondary}
      accessibilityLabel={placeholder}
      autoComplete={autoComplete}
      textContentType={textContentType}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
      autoCorrect={!keyboardType && !autoComplete}
      maxLength={200}
      multiline={multiline}
      returnKeyType={returnKeyType}
      submitBehavior={submitBehavior}
      onSubmitEditing={onSubmitEditing}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

function AddressFields({
  value,
  onChange,
  fallbackCity,
  chain,
}: {
  value: Address;
  onChange: (a: Address) => void;
  fallbackCity: string;
  chain: (field: keyof Address) => ChainProps;
}) {
  const styles = useStyles();
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  // The city answered earlier fills in the city field until the user types their own.
  const [cityTouched, setCityTouched] = useState(!!value.city);
  useEffect(() => {
    if (!cityTouched && fallbackCity && !value.city) onChange({ ...value, city: fallbackCity });
  }, [cityTouched, fallbackCity, value, onChange]);
  return (
    <>
      <Field
        value={value.line}
        onChange={(line) => set({ line })}
        placeholder={t('profile.addressLine')}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        autoCapitalize="words"
        multiline
        {...chain('line')}
      />
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Field
            value={value.district}
            onChange={(district) => set({ district })}
            placeholder={t('profile.district')}
            autoCapitalize="words"
            {...chain('district')}
          />
        </View>
        <View style={styles.flex}>
          <Field
            value={value.city}
            onChange={(c) => {
              setCityTouched(true);
              set({ city: c });
            }}
            placeholder={t('profile.city')}
            autoComplete="postal-address-locality"
            textContentType="addressCity"
            autoCapitalize="words"
            {...chain('city')}
          />
        </View>
      </View>
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Field
            value={value.postal}
            onChange={(postal) => set({ postal })}
            placeholder={t('profile.postal')}
            autoComplete="postal-code"
            textContentType="postalCode"
            autoCapitalize="characters"
            {...chain('postal')}
          />
        </View>
        <View style={styles.flex}>
          <Field
            value={value.country}
            onChange={(country) => set({ country })}
            placeholder={t('profile.country')}
            autoComplete="country"
            textContentType="countryName"
            autoCapitalize="words"
            {...chain('country')}
          />
        </View>
      </View>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  locationBox: { gap: 8 },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.tint,
  },
  locationText: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  counter: {
    color: c.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  title: {
    color: c.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  lead: { color: c.textSecondary, fontSize: 16, lineHeight: 23 },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 8 },
  hint: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  warning: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipOn: { backgroundColor: c.tint, borderColor: c.tint },
  chipText: { color: c.text, fontSize: 15 },
  chipTextOn: { color: c.onTint, fontWeight: '600' },
  input: {
    color: c.text,
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    fontSize: 16,
  },
  inputMulti: { minHeight: 72 },
  pair: { flexDirection: 'row', gap: 10 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: c.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: c.tint, borderColor: c.tint },
  checkText: { flex: 1, color: c.text, fontSize: 15, lineHeight: 21 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.separator,
  },
  pressed: { backgroundColor: c.pressed },
  savedText: { flex: 1, color: c.text, fontSize: 15, lineHeight: 20 },
  savedInput: {
    flex: 1,
    color: c.text,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
    marginRight: 8,
  },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  primary: { height: 52, borderRadius: 26 },
  primaryText: { fontSize: 17 },
  secondary: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  secondaryText: { color: c.tintText, fontSize: 16, fontWeight: '600' },
}));
