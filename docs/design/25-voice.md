# 25. Voice input and read-aloud

Part of [Qutai: how it works and the decisions behind it](../../DESIGN.md) · [All decisions](decisions-index.md) · [History](history.md)

Speaking to Qutai instead of typing (the panel's microphone and holding the Qutai button), and Qutai reading text out loud. Speech is turned into text by the phone's own speech recognition; Qutai never records audio itself.

## How it works

1. **The panel's microphone** (next to the message field). Hold it to talk and lift to stop (slide away before lifting to stop without sending), or tap to start and tap again or pause to stop. Words appear as they are recognised, are added to what is already typed and stay editable. Nothing is sent until the user taps Send, unless Settings › Assistant › "Send automatically after speaking" is on.
2. **Where the speech is turned into text.** On the phone when it can: iOS on-device dictation for the phone's own language; Android 13+ with the language downloaded. Otherwise the phone's speech service (Apple's or Google's) receives the audio, and only after a one-time question that names that service ("Allow" / "Not now"; on Android 13+ it also offers to download the language for offline use). Settings › Assistant shows which mode this phone uses and changes the answer.
3. **Incognito conversations** use on-device recognition only; if that isn't possible, voice input says so and stays off (offering the download where it can).
4. **Listening language.** Example: on an English phone, in a chat where the user writes Turkish, Qutai listens in Turkish. Order: the language picked in this conversation (the TR/EN tag next to the microphone while listening) › Settings › Assistant › "Listening language" when not Automatic › the language of the user's latest message that clearly has one › the language last used › the app's language › the phone's language. A language the phone can't recognise is skipped with "X isn't available… Listening in Y".
5. **Push-to-talk.** Hold the Qutai button in the address bar for 0.4 s (a vibration): Qutai listens without opening the panel. A bubble next to the button shows a listening dot, the language tag and the live words. Lift to send to the conversation of the tab on screen (a "Sent: …" toast with Open). Slide away: the bubble turns red ("Release to cancel"). Turn it off in Settings › Assistant › "Hold the Qutai button to talk".
6. **The microphone turns off** when the panel closes, another tab or a dialog comes up, the app leaves the screen, a call comes in or a site starts using the microphone; what was heard stays in the field.
7. **Read aloud.** The speaker button under an answer, the assistant's `read_aloud` tool, "Read page aloud" in the page menu and reader mode. Qutai reads in the language the text is written in, with the most natural voice installed on the phone, and without Markdown marks.
8. **Barge-in.** Starting to talk stops read-aloud; read-aloud never starts while the microphone is on.

## The rules

- **`VOICE-1`** Speech becomes text only through the phone's system speech recogniser (on-device, or Apple's / Google's online service after consent); Qutai has no audio recording and no AI transcription of its own, and does not plan one.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded ("Decision: The paid 'audio recording + AI transcription' route will not be used") · Enforced: In the app: src/device/voiceInput.ts (begin, only ExpoSpeechRecognitionModule) · Source: TODO.md › Our own build › Voice input (aafe153, 2026-11-13)
- **`VOICE-2`** Recognition runs on the phone whenever that can be enforced; Qutai decides "on-device" itself (iOS only for the phone's own language with on-device support; Android 13+ with the language installed) and otherwise counts the session as online.
  Status: Default (manager or implementing session; open to change) · Why: iOS silently falls back to Apple's server when asked for on-device in a language without it; Android 12 and older can only hint "prefer offline" · Enforced: In the app: src/device/voiceInput.ts (voicePlan, requiresOnDeviceRecognition) · Source: item20-voice-input note; TODO.md › Voice input
- **`VOICE-3`** Online recognition (Apple's or Google's service) is used only after a one-time explicit agreement naming the service; the answer (`voiceOnline`: ask / allowed / declined, default ask) is kept per phone, not in backups, and "declined" refuses with a message.
  Status: Default (manager or implementing session; open to change) · Why: the audio leaves the phone to a third party; listed in the privacy policy's "What leaves your phone" · Enforced: In the app: src/device/voiceInput.ts (begin, askOnline) · Source: TODO.md › Voice input (Privacy); README › Voice input
- **`VOICE-4`** Incognito conversations never use online recognition; without on-device recognition voice input is off there, and the "language last used" is not recorded from incognito.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded (private mode sends nothing off the phone) · Enforced: In the app: src/device/voiceInput.ts (begin incognito branch, handleError canGoOnline) · Source: TODO.md › Voice input; README
- **`VOICE-5`** No audio is written to disk (`persist: false`) and no audio goes to Qutai or the AI provider; only the text is sent, as a normal message.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/device/voiceInput.ts (begin, recordingOptions persist false) · Source: README › Voice input; TODO.md › Voice input
- **`VOICE-6`** Voice consent and the voice settings are not changeable by the assistant from the chat.
  Status: Default (manager or implementing session; open to change) · Why: a web page that instructs the assistant must not remove the user's protections · Enforced: In the app: src/agent/settingsTool.ts (CHANGEABLE; voice settings refused) · Source: README overview; febcdb4
- **`VOICE-7`** Dictated text is not sent automatically: "Send automatically after speaking" is off by default and never sends while a task runs.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/settings.ts (DEFAULT_SETTINGS); TODO.md › Voice input
- **`VOICE-8`** The listening language follows the order in "How it works"; only the user's own messages are judged, never the assistant's; a message needs 1.5 points and a 1.5-point lead to count, otherwise the previous language stays.
  Status: Default (manager or implementing session; open to change) · Why: replaced a weighted "last five" rule with hysteresis that kept the first language · Source: a2ab4b5, 43c2799, 8b92f39; README › Voice input
- **`VOICE-9`** A language the phone's recogniser lacks is skipped and the user is told which one is used instead; it is never swapped silently.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: TODO.md › Voice input; fix7-voice-language-push-to-talk note
- **`VOICE-11`** Push-to-talk records nothing while a task runs (the bubble says Qutai is busy and offers Open); an interruption (app left, a call, a dialog, a system prompt) or silence sends nothing.
  Status: Default (manager or implementing session; open to change) · Why: a message can't be sent to a running task · Source: README › Push-to-talk; TODO.md › Voice input
- **`VOICE-13`** "Hold the Qutai button to talk" is on by default and is in backups.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: src/storage/settings.ts (DEFAULT_SETTINGS); TODO.md › Voice input
- **`VOICE-14`** With a screen reader there is no hold: the Qutai button offers "Start voice message", then "Send" and "Cancel" actions; the panel's microphone is tap-only.
  Status: Default (manager or implementing session; open to change) · Why: holds don't work with screen-reader gestures · Source: README › Push-to-talk; TODO.md › Voice input
- **`VOICE-15`** The microphone stops (keeping the words) when the panel closes, another conversation comes on screen, a dialog opens, the app leaves the foreground, iOS interrupts audio or a site captures the microphone; it won't start while a site uses it.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Enforced: In the app: src/device/voiceInput.ts (begin: pageMicrophoneLive, dialogState) · Source: TODO.md › Voice input
- **`VOICE-17`** Barge-in: starting to talk stops read-aloud; read-aloud turns the microphone off before it starts; a streaming answer keeps going.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: TODO.md › Voice input
- **`VOICE-19`** Read-aloud uses the most natural installed voice (iOS Premium › Enhanced › Siri › compact; Android by the engine's quality), the same voice for the whole app run, at the engine's natural rate and pitch; when only basic voices exist a one-time tip says how to install a better one.
  Status: Default (manager or implementing session; open to change) · Why: iOS used the compact default voice even with an Enhanced or Premium one installed ("not natural") · Source: 3fc70c0; src/chat/speechLanguage.ts (pickVoice)
- **`VOICE-21`** A language with no installed voice is read with the phone's default voice and Qutai says so once per language per run.
  Status: Default (manager or implementing session; open to change) · Why: reason not recorded · Source: a61de60

- **`VOICE-24`** Read-aloud stays on the phone's own speech engine; an on-device neural voice (Supertonic-3) was evaluated on 19 Nov 2026 and not adopted (owner, 19 Nov 2026). On an Honor 90 a 280-character answer took about 11 s before the first sound (real-time factor 0.55) with 0.8 to 0.9 GB peak memory and a 191 to 383 MB download, and shipping it needs a patched native dependency, a number front end and OpenRAIL-M terms; the evaluation is parked on the branch `experiment/neural-tts-eval` (`experiments/neural-tts-eval/README.md`). A cloud-hosted voice is the intended later route; it is not built.
  Status: Owner, 2026-11-19 · Why: about 11 s before the first sound, 0.8 to 0.9 GB peak memory and a large download on a mid-range phone (the measurements in the rule) · Source: 5af881a

## Details

**Push-to-talk**

- (was `VOICE-10`) Push-to-talk starts after a 0.4 s hold (16 pt of movement allowed), cancels past 80 pt, waits up to 1 s for the final words, stops at 60 s, and restarts a held session the recogniser ended by itself at most 4 times. · Why: 0.4 s is Android's own long-press time; start delay was measured and cut · Where: src/components/PushToTalk.tsx (HOLD_TO_TALK_MS, HOLD_SLOP, CANCEL_DISTANCE, FINAL_WAIT_MS); 2b4689f, 291174a
- (was `VOICE-12`) The first hold asks for the microphone (or the online-service question) instead of listening. · Why: the finger is up by the time the question is answered · Where: README › Push-to-talk; src/device/voiceInput.ts (begin)

**Recogniser errors**

- (was `VOICE-16`) No error notice appears once words have arrived (a late recogniser error while stopping is ignored); a real failure with nothing heard is reported. Words heard before an automatic restart of a held session count as arrived: a late "client" or "no-speech" error in the new run, before new words, shows no notice, and those words are the session's final text when nothing new follows (21 Nov 2026). · Why: Android sends a "client" error after release although the words came through; on a Honor (Android 15) "Voice typing didn't work" showed while the text was written · Where: 7a563b9; src/device/voiceError.ts (voiceErrorOutcome); src/device/voiceInput.ts (handleError, the session's `carried`)

**Read-aloud mechanics**

- (was `VOICE-18`) Read-aloud picks the language from the text itself (paragraph by paragraph, mixed paragraphs sentence by sentence, the language with most letters and a 1.5× lead, first 6000 characters); a page's `lang` or the model's hint is used only for unclear text. · Why: a Turkish page marked `lang="en"` was read with the wrong voice · Where: a61de60; src/chat/speechLanguage.ts (textLanguage, speechLanguage)
- (was `VOICE-20`) On Android read-aloud passes only the bare language code and never a voice option. · Why: expo-speech rejects region tags there and every utterance failed once the TTS service had died · Where: 7f4ee32; read-aloud-language note
- (was `VOICE-22`) Answers are read without Markdown marks (links as their text or host, tables row by row, citation markers dropped); Copy, Share and PDF are unchanged. · Where: a61de60; src/chat/speechText.ts

**Library**

- (was `VOICE-23`) Voice input uses `expo-speech-recognition` 58.x, not `@react-native-voice/voice`. · Why: an Expo module (new architecture) with a config plugin and an on-device flag; the alternative is an older bridge module with neither · Where: TODO.md › Voice input; item20-voice-input note

## Why it is designed this way

Expo SDK 58 ships no speech-to-text, so Qutai uses the operating system's recogniser. The only privacy-relevant choice is on-device versus the OS vendor's online service; Qutai enforces on-device itself where it can, asks once before anything goes online, and never goes online in incognito. Recording audio and sending it to an AI transcription service was rejected.

## Limits and what is not built

- iOS reports on-device support only for the phone's own language, so dictating in another language counts as online (asked first, refused in incognito). Android 12 and older are always online.
- On Android another app taking the microphone isn't reported as such; there are no audio-focus events.
- The first sentence after switching language may still be heard in the old language.
- Voice input needs a new development build; real speech has not been verified on a device.
- Address-bar voice search: not built (would reuse `startVoiceInput`).
- Qutai's own audio recording and AI transcription (cloud speech): not planned (TODO "Decision", 2026-11-13).
- A neural read-aloud voice: on-device was evaluated and not adopted (`VOICE-24`); a cloud-hosted voice is not built.

## Where it lives

- `src/device/voiceInput.ts`, `voiceLanguage.ts`, `voiceError.ts`, `speech.ts`
- `src/chat/messageLanguage.ts`, `speechLanguage.ts`, `speechText.ts`
- `src/components/PushToTalk.tsx`, `AssistantButton.tsx`, `useHoldGesture.ts`, `VoiceLanguageSheet.tsx`
- [README.md](../../README.md) › Voice input and Push-to-talk; [TODO.md](../../TODO.md) › Voice input

## Disagreements between sources

- TODO.md › Voice input (push-to-talk line) says `HOLD_TO_TALK_MS = 500 ms`; README and the code (`src/components/PushToTalk.tsx`, `HOLD_TO_TALK_MS = 400`) say 0.4 s (changed in 291174a). The app uses 400 ms.
- TODO.md › Voice input (Behaviour line) says the language is "the UI language" and "never swapped"; superseded by the conversation-language order and skip-with-notice (a2ab4b5). The code follows the newer order.
- A cross-area extraction says the read-aloud voice level was "chosen by the owner" and that cloud voices are a separate pending decision; no repository source, commit body or note was found for either, so VOICE-19 is recorded as Default.
