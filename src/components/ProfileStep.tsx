import { useCallback, useRef, useState } from 'react';
import { getLocales } from 'expo-localization';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AUTO_LANGUAGE, languageOf } from '../device/voiceLanguage';
import type { VoiceOnline } from '../device/voiceInput';
import { getLanguage, t } from '../i18n';
import type { IntroTarget } from '../intro/request';
import { AppModal } from '../ui/AppModal';
import { makeStyles } from '../ui/theme';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { DialogHost } from './Dialog';
import { ProfileQuestions } from './ProfileQuestions';
import { ScreenHeader } from './ScreenHeader';
import { VoiceIntro, type IntroVoice } from './VoiceIntro';

/** The voice settings the introduction listens with (Settings › Assistant › Voice input). */
export type IntroVoiceSettings = {
  voiceLanguage: string;
  voiceLastLanguage: string;
  voiceOnline: VoiceOnline;
};

/**
 * The languages to listen in, best first: the language picked in Settings, the one listened in last, the app's, the
 * phone's (one per language). As the panel's order (device/voiceLanguage.ts listeningOrder) without a conversation.
 */
export function introLanguages(settings: Pick<IntroVoiceSettings, 'voiceLanguage' | 'voiceLastLanguage'>): string[] {
  const phone = getLocales()[0];
  const order = [
    settings.voiceLanguage !== AUTO_LANGUAGE ? settings.voiceLanguage : null,
    settings.voiceLastLanguage || null,
    getLanguage(),
    phone?.languageTag || phone?.languageCode || null,
  ].filter((x): x is string => !!x);
  const seen = new Set<string>();
  return order.filter((tag) => {
    const language = languageOf(tag);
    if (seen.has(language)) return false;
    seen.add(language);
    return true;
  });
}

type Props = {
  ai: IntroTarget | null;
  voice: IntroVoiceSettings;
  /** Settings changed by voice input (the online speech service answer, the last language). */
  onVoice: (change: Partial<IntroVoiceSettings>) => void;
  onInstructions: (update: (current: string) => string) => void;
  onDone: () => void;
  transition?: (change: () => void) => void;
  registerBack: (handler: (() => boolean) | null) => void;
};

/**
 * "Let me get to know you a little": "Tell me about yourself" first (VoiceIntro), the typed questions
 * (ProfileQuestions) as the alternative and the way out of a failure, with what was said shown above them. Back from
 * the first typed question returns to the introduction.
 */
export function ProfileStep({ ai, voice, onVoice, onInstructions, onDone, transition, registerBack }: Props) {
  const [typed, setTyped] = useState<{ transcript: string } | null>(null);
  const inner = useRef<(() => boolean) | null>(null);

  const register = useCallback(
    (handler: (() => boolean) | null) => {
      inner.current = handler;
      registerBack(() => {
        if (inner.current?.()) return true;
        if (typed) {
          const back = () => setTyped(null);
          if (transition) transition(back);
          else back();
          return true;
        }
        return false;
      });
    },
    [registerBack, typed, transition],
  );

  const introVoice: IntroVoice = {
    languages: introLanguages(voice),
    online: voice.voiceOnline,
    onOnlineChange: (voiceOnline) => onVoice({ voiceOnline }),
    onStarted: (voiceLastLanguage) => onVoice({ voiceLastLanguage }),
  };

  const exit = useCallback(
    (to: 'typed' | 'skip' | 'done', transcript: string) => {
      if (to !== 'typed') return onDone();
      const change = () => setTyped({ transcript });
      if (transition) transition(change);
      else change();
    },
    [onDone, transition],
  );

  if (typed) {
    return (
      <ProfileQuestions
        key="typed"
        startAt="name"
        transcript={typed.transcript}
        transition={transition}
        onDone={onDone}
        registerBack={register}
      />
    );
  }
  return (
    <VoiceIntro
      key="voice"
      ai={ai}
      voice={introVoice}
      onInstructions={onInstructions}
      onExit={exit}
      transition={transition}
      registerBack={register}
    />
  );
}

/** The same step from Settings › Assistant › Memory, in a sheet of its own. */
export function ProfileStepScreen({
  visible,
  onClose,
  ...props
}: Omit<Props, 'onDone' | 'transition' | 'registerBack'> & { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const backHandler = useRef<(() => boolean) | null>(null);
  const back = () => {
    if (!backHandler.current?.()) onClose();
  };
  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={back}>
      {visible && (
        <SafeAreaView style={styles.screen} edges={MODAL_SCREEN_EDGES}>
          <ScreenHeader
            left={{ label: t('address.back'), icon: 'back', iconOnly: true, onPress: back, tone: 'link' }}
            right={{ label: t('common.close'), onPress: onClose, tone: 'primary' }}
          />
          <ProfileStep
            {...props}
            onDone={onClose}
            registerBack={(handler) => {
              backHandler.current = handler;
            }}
          />
        </SafeAreaView>
      )}
      <DialogHost />
    </AppModal>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg },
}));
