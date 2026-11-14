import { ComponentRef, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SEARCH_ENGINE_ORDER, SEARCH_ENGINES } from '../browser/search';
import { openDefaultBrowserSettings } from '../device/defaultBrowser';
import { t } from '../i18n';
import { LEGAL_VERSION, LegalKind } from '../legal/documents';
import type { Settings } from '../storage/settings';
import { Aurora } from '../ui/Aurora';
import { GradientButton, GradientText } from '../ui/BrandGradient';
import { Icon, IconName } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { makeStyles, usePalette } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { AiProviderFields, cleanAiChoice } from './AiProviderFields';
import { LegalScreen } from './LegalScreen';

type Step = 'welcome' | 'legal' | 'ai' | 'protection' | 'browser';
const ALL_STEPS: Step[] = ['welcome', 'legal', 'ai', 'protection', 'browser'];

type Props = {
  settings: Settings;
  /** Only the privacy policy and terms changed: ask for those, skip the rest. */
  legalOnly?: boolean;
  onDone: (settings: Settings) => void;
};

/**
 * First-run setup: what Qutai is, privacy policy and terms (must be accepted), the AI provider and
 * key (can be skipped), protection against ads and trackers, and making Qutai the default browser.
 */
export function Onboarding({ settings, legalOnly = false, onDone }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const steps = legalOnly ? (['legal'] as Step[]) : ALL_STEPS;
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Step changes blur out and back into focus: the blur sits over the content area only (not the
  // progress dots or the button). On Android it needs a BlurTargetView holding what it blurs.
  const targetRef = useRef<ComponentRef<typeof View>>(null);
  const areaRef = useRef<ComponentRef<typeof View>>(null);
  const [area, setArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [switching, setSwitching] = useState(false);
  const reduceMotion = useReducedMotion();
  const blur = useSharedValue(0);
  const blurProps = useAnimatedProps(() => ({ intensity: blur.value }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: blur.value > 0.5 ? 1 : 0 }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: 1 - (blur.value / BLUR_MAX) * 0.35 }));
  const show = (to: number) => {
    setIndex(to);
    // Each step starts at its top.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const go = (to: number) => {
    if (switching) return;
    if (reduceMotion) return show(to);
    setSwitching(true);
    blur.set(withTiming(BLUR_MAX, { duration: BLUR_OUT_MS }));
    // The content changes at the blurriest moment, then comes back into focus.
    setTimeout(() => {
      show(to);
      blur.set(withTiming(0, { duration: BLUR_IN_MS }));
      setTimeout(() => setSwitching(false), BLUR_IN_MS);
    }, BLUR_OUT_MS);
  };
  const [draft, setDraft] = useState(settings);
  const [accepted, setAccepted] = useState(false);
  const [reading, setReading] = useState<LegalKind | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;
  const hasKey = !!draft.apiKeys[draft.provider].trim();

  const next = () => {
    if (!last) return go(index + 1);
    onDone({ ...cleanAiChoice(draft), onboarded: true, legalAcceptedVersion: LEGAL_VERSION });
  };
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const primary =
    step === 'welcome'
      ? t('onboarding.start')
      : step === 'legal'
        ? t('onboarding.accept')
        : step === 'ai' && !hasKey
          ? t('onboarding.skipForNow')
          : last
            ? t('onboarding.finish')
            : t('onboarding.continue');
  const primaryDisabled = step === 'legal' && !accepted;

  return (
    <View style={styles.root}>
      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill}>
        <Aurora base={palette.bg} dark={palette.dark} />
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.top}>
              {index > 0 ? (
                <Pressable onPress={() => go(index - 1)} hitSlop={10} accessibilityLabel={t('address.back')}>
                  <Icon name="back" size={22} color={palette.text} />
                </Pressable>
              ) : (
                <View style={styles.topSpacer} />
              )}
              {steps.length > 1 && (
                <View
                  style={styles.dots}
                  accessible
                  accessibilityLabel={t('onboarding.progress', { step: index + 1, total: steps.length })}
                >
                  {steps.map((s, i) => (
                    <View key={s} style={[styles.dot, i === index && styles.dotActive]} />
                  ))}
                </View>
              )}
              <View style={styles.topSpacer} />
            </View>

            <Animated.View
              ref={areaRef}
              style={[styles.flex, contentStyle]}
              onLayout={() =>
                areaRef.current?.measureInWindow((x, y, width, height) => setArea({ x, y, width, height }))
              }
            >
              <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.step}>
                  {step === 'welcome' && (
                    <>
                      <View style={styles.hero}>
                        <QutaiMark size={72} alwaysSparkle />
                        <GradientText style={styles.wordmark}>Qutai</GradientText>
                        <Text style={styles.lead}>{t('onboarding.tagline')}</Text>
                      </View>
                      <Feature icon="summarize" title={t('onboarding.f1Title')} body={t('onboarding.f1Body')} />
                      <Feature icon="assistant" title={t('onboarding.f2Title')} body={t('onboarding.f2Body')} />
                      <Feature icon="shield" title={t('onboarding.f3Title')} body={t('onboarding.f3Body')} />
                    </>
                  )}

                  {step === 'legal' && (
                    <>
                      <Text style={styles.title} accessibilityRole="header">
                        {t(legalOnly ? 'onboarding.legalUpdatedTitle' : 'onboarding.legalTitle')}
                      </Text>
                      <Text style={styles.lead}>{t('onboarding.legalLead')}</Text>
                      <View style={styles.card}>
                        <Bullet text={t('onboarding.legal1')} />
                        <Bullet text={t('onboarding.legal2')} />
                        <Bullet text={t('onboarding.legal3')} />
                        <Bullet text={t('onboarding.legal4')} />
                      </View>
                      <View style={styles.linkRow}>
                        <Pressable
                          onPress={() => setReading('privacy')}
                          style={styles.linkUnderline}
                          accessibilityRole="link"
                          hitSlop={6}
                        >
                          <Text style={styles.link}>{t('settings.privacyPolicy')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setReading('terms')}
                          style={styles.linkUnderline}
                          accessibilityRole="link"
                          hitSlop={6}
                        >
                          <Text style={styles.link}>{t('settings.terms')}</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => setAccepted(!accepted)}
                        style={styles.checkRow}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: accepted }}
                      >
                        <View style={[styles.checkbox, accepted && styles.checkboxOn]}>
                          {accepted && <Icon name="check" size={16} color="#ffffff" />}
                        </View>
                        <Text style={styles.checkText}>{t('onboarding.acceptCheck')}</Text>
                      </Pressable>
                    </>
                  )}

                  {step === 'ai' && (
                    <>
                      <Text style={styles.title} accessibilityRole="header">
                        {t('onboarding.aiTitle')}
                      </Text>
                      <Text style={styles.lead}>{t('onboarding.aiLead')}</Text>
                      <AiProviderFields
                        value={draft}
                        onChange={(ai) =>
                          setDraft((d) => ({ ...d, provider: ai.provider, apiKeys: ai.apiKeys, models: ai.models }))
                        }
                      />
                    </>
                  )}

                  {step === 'protection' && (
                    <>
                      <Text style={styles.title} accessibilityRole="header">
                        {t('onboarding.protectionTitle')}
                      </Text>
                      <Text style={styles.lead}>{t('onboarding.protectionLead')}</Text>
                      <View style={styles.card}>
                        <Toggle
                          title={t('settings.blockAds')}
                          body={t('onboarding.blockAdsHint')}
                          value={draft.blockAds}
                          onChange={(v) => set('blockAds', v)}
                        />
                        <Toggle
                          title={t('settings.thirdPartyCookies')}
                          body={t('onboarding.trackersHint')}
                          value={draft.blockThirdPartyCookies}
                          onChange={(v) => set('blockThirdPartyCookies', v)}
                        />
                        <Toggle
                          title={t('settings.hideCookieBanners')}
                          body={t('onboarding.cookieBannersHint')}
                          value={draft.hideCookieBanners}
                          onChange={(v) => set('hideCookieBanners', v)}
                        />
                        <Toggle
                          title={t('settings.httpsOnly')}
                          body={t('onboarding.httpsOnlyHint')}
                          value={draft.httpsOnly}
                          onChange={(v) => set('httpsOnly', v)}
                        />
                      </View>
                      <Text style={styles.label}>{t('settings.search')}</Text>
                      <View style={styles.card}>
                        {SEARCH_ENGINE_ORDER.map((id) => (
                          <Pressable
                            key={id}
                            style={styles.option}
                            onPress={() => set('searchEngine', id)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: draft.searchEngine === id }}
                          >
                            <Radio selected={draft.searchEngine === id} />
                            <Text style={styles.optionText}>{SEARCH_ENGINES[id].name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}

                  {step === 'browser' && (
                    <>
                      <Text style={styles.title} accessibilityRole="header">
                        {t('onboarding.browserTitle')}
                      </Text>
                      <Text style={styles.lead}>{t('onboarding.browserLead')}</Text>
                      <Pressable
                        onPress={() => openDefaultBrowserSettings().catch(() => {})}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                        accessibilityRole="button"
                      >
                        <Icon name="openInNew" size={18} color={palette.tintText} />
                        <Text style={styles.secondaryText}>{t('onboarding.setDefault')}</Text>
                      </Pressable>
                      <Text style={styles.hint}>
                        {t(Platform.OS === 'ios' ? 'onboarding.browserHintIos' : 'onboarding.browserHintAndroid')}
                      </Text>
                    </>
                  )}
                </View>
              </ScrollView>
            </Animated.View>

            <View style={styles.bottom}>
              <GradientButton
                label={primary}
                onPress={next}
                disabled={primaryDisabled || switching}
                style={styles.primary}
                textStyle={styles.primaryText}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </BlurTargetView>
      {area && (
        <AnimatedBlur
          blurTarget={targetRef}
          blurMethod="dimezisBlurViewSdk31Plus"
          animatedProps={blurProps}
          tint="default"
          pointerEvents="none"
          style={[
            { position: 'absolute', left: area.x, top: area.y, width: area.width, height: area.height },
            blurStyle,
          ]}
        />
      )}
      <LegalScreen kind={reading} onClose={() => setReading(null)} />
    </View>
  );
}

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);
const BLUR_MAX = 45;
const BLUR_OUT_MS = 180;
const BLUR_IN_MS = 320;

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <Icon name={icon} size={22} color={palette.tintText} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.hint}>{body}</Text>
      </View>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  const styles = useStyles();
  const palette = usePalette();
  return (
    <View style={styles.bullet}>
      <Icon name="check" size={18} color={palette.tintText} />
      <Text style={[styles.bulletText, styles.flex]}>{text}</Text>
    </View>
  );
}

function Toggle({
  title,
  body,
  value,
  onChange,
}: {
  title: string;
  body: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.toggle}>
      <View style={styles.flex}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.hint}>{body}</Text>
      </View>
      <ThemedSwitch value={value} onValueChange={onChange} accessibilityLabel={title} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 48,
  },
  topSpacer: { width: 22 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.border },
  dotActive: { width: 18, backgroundColor: c.tint },
  step: { gap: 14 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 18 },
  wordmark: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6 },
  title: { color: c.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.4, marginTop: 12 },
  lead: { color: c.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'left' },
  label: { color: c.text, fontSize: 15, fontWeight: '600', marginTop: 8 },
  hint: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  feature: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 6 },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  featureTitle: { color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 2 },
  card: { backgroundColor: c.surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  bullet: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  bulletText: { color: c.text, fontSize: 15, lineHeight: 21 },
  linkRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginVertical: 4 },
  // A drawn underline: the text's own underline sits too close and its offset can't be set.
  linkUnderline: { paddingBottom: 3, borderBottomWidth: 1.5, borderBottomColor: c.tintText },
  link: { color: c.tintText, fontSize: 15, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
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
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  optionText: { color: c.text, fontSize: 15 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: c.tint,
    backgroundColor: c.surface,
    marginTop: 8,
  },
  secondaryText: { color: c.tintText, fontSize: 16, fontWeight: '600' },
  bottom: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  primary: { height: 52, borderRadius: 26 },
  primaryText: { fontSize: 17 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
}));
