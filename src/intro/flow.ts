import { EMPTY_EXTRACTION, type Extraction, mergeExtractions } from './extract';
import { chipAnswers, chooseFollowUps, EMPTY_ANSWER, type FollowUp, type FollowUpAnswer, textAnswers, verbatimItems } from './followUps';
import type { MessageKey } from '../i18n';

/**
 * The "Tell me about yourself" flow as a reducer (docs/voice-introduction.md, "Screens and states"). Pure: the
 * screen runs the microphone and the requests and reports what happened as events; this decides what comes next.
 */

export type FailReason = 'noAi' | 'request' | 'unreadable' | 'nothing';

export type Phase =
  | { name: 'intro' }
  | { name: 'listening' }
  | { name: 'transcript' }
  | { name: 'understanding'; round: 1 | 2 }
  | { name: 'followUp'; index: number }
  | { name: 'review' }
  | { name: 'saving' }
  | { name: 'saved'; count: number }
  | { name: 'failed'; reason: FailReason; detail?: string }
  /** Left the flow: to the typed questions (with the transcript), skipped, or finished. */
  | { name: 'exit'; to: 'typed' | 'skip' | 'done' };

export type Notice = 'noSpeech' | 'answersVerbatim' | null;

export type FlowState = {
  phase: Phase;
  /** What the user said or typed (editable before it is sent). */
  transcript: string;
  /** Started by keyboard ("I'd rather type"): the field takes focus, the microphone is secondary. */
  typing: boolean;
  /** What round 1 understood from the transcript. */
  first: Extraction;
  /** What round 2 understood from the typed or spoken follow-up answers (or those answers as said, if it failed). */
  second: Extraction;
  questions: FollowUp[];
  answers: FollowUpAnswer[];
  notice: Notice;
};

export const START: FlowState = {
  phase: { name: 'intro' },
  transcript: '',
  typing: false,
  first: EMPTY_EXTRACTION,
  second: EMPTY_EXTRACTION,
  questions: [],
  answers: [],
  notice: null,
};

export type FlowEvent =
  | { type: 'speak' }
  | { type: 'typeInstead' }
  | { type: 'questionsInstead' }
  | { type: 'skipAll' }
  | { type: 'heard'; text: string }
  /** `started: false`: listening never began (refused, unavailable; voice input said why), so nothing was heard. */
  | { type: 'voiceEnded'; text: string; started?: boolean }
  | { type: 'edit'; text: string }
  | { type: 'startOver' }
  | { type: 'submit'; hasAi: boolean }
  | { type: 'understood'; result: Extraction }
  | { type: 'failed'; reason: Exclude<FailReason, 'noAi'>; detail?: string }
  | { type: 'cancel' }
  | { type: 'retry' }
  | { type: 'answerText'; text: string }
  | { type: 'toggleChip'; chip: string }
  | { type: 'next' }
  | { type: 'skipQuestion' }
  | { type: 'back' }
  | { type: 'save' }
  | { type: 'saved'; count: number }
  | { type: 'done' };

/** The shortest text worth sending (a name alone is enough). */
const MIN_CHARS = 2;

export function canSubmit(state: FlowState): boolean {
  return state.transcript.trim().length >= MIN_CHARS;
}

/** The answers to the follow-ups that need round 2 (typed or said). */
export function pendingAnswers(state: FlowState) {
  return textAnswers(state.questions, state.answers);
}

/**
 * Everything understood: round 1, what the picked chips say, and round 2. `label` translates a chip (its label is the
 * value saved).
 */
export function finalExtraction(state: FlowState, label: (key: MessageKey) => string): Extraction {
  let found = state.first;
  state.questions.forEach((question, i) => {
    const answer = state.answers[i];
    if (!answer || answer.skipped || !answer.chips.length) return;
    const chips = chipAnswers(question, answer.chips, label);
    found = mergeExtractions(found, { items: chips.items, none: chips.none, declined: [] });
  });
  return mergeExtractions(found, state.second);
}

/** After the last question: round 2 when something was typed or said, else straight to review. */
function afterQuestions(state: FlowState): FlowState {
  if (pendingAnswers(state).length) return { ...state, phase: { name: 'understanding', round: 2 } };
  return { ...state, second: EMPTY_EXTRACTION, phase: { name: 'review' } };
}

function moveOn(state: FlowState, index: number): FlowState {
  if (index + 1 < state.questions.length) return { ...state, phase: { name: 'followUp', index: index + 1 } };
  return afterQuestions(state);
}

function setAnswer(state: FlowState, index: number, change: (a: FollowUpAnswer) => FollowUpAnswer): FlowState {
  const answers = [...state.answers];
  answers[index] = change(answers[index] ?? EMPTY_ANSWER);
  return { ...state, answers };
}

export function introReducer(state: FlowState, event: FlowEvent): FlowState {
  const phase = state.phase;
  switch (event.type) {
    case 'speak':
      if (phase.name === 'intro' || phase.name === 'transcript')
        return { ...state, phase: { name: 'listening' }, notice: null };
      return state;
    case 'typeInstead':
      if (phase.name !== 'intro') return state;
      return { ...state, phase: { name: 'transcript' }, typing: true, notice: null };
    case 'questionsInstead':
      return { ...state, phase: { name: 'exit', to: 'typed' } };
    case 'skipAll':
      return { ...state, phase: { name: 'exit', to: 'skip' } };
    case 'heard':
      if (phase.name !== 'listening') return state;
      return { ...state, transcript: event.text };
    case 'voiceEnded': {
      // However it ended (the user's tap, a pause, the app going to the background, a call), what was heard is kept.
      if (phase.name !== 'listening') return state;
      if (event.started === false) return { ...state, phase: { name: state.transcript.trim() || state.typing ? 'transcript' : 'intro' } };
      const transcript = event.text.trim() ? event.text : state.transcript;
      if (!transcript.trim()) return { ...state, transcript: '', phase: { name: state.typing ? 'transcript' : 'intro' }, notice: 'noSpeech' };
      return { ...state, transcript, phase: { name: 'transcript' }, notice: null };
    }
    case 'edit':
      if (phase.name !== 'transcript') return state;
      return { ...state, transcript: event.text };
    case 'startOver':
      return { ...START };
    case 'submit':
      if (phase.name !== 'transcript' || !canSubmit(state)) return state;
      if (!event.hasAi) return { ...state, phase: { name: 'failed', reason: 'noAi' } };
      return { ...state, phase: { name: 'understanding', round: 1 }, notice: null };
    case 'understood': {
      if (phase.name !== 'understanding') return state;
      if (phase.round === 1) {
        const questions = chooseFollowUps(event.result);
        if (!event.result.items.length && !questions.length) return { ...state, phase: { name: 'failed', reason: 'nothing' } };
        // Nothing understood but questions left: the questions still help, so they are asked.
        const next = { ...state, first: event.result, second: EMPTY_EXTRACTION, questions, answers: questions.map(() => EMPTY_ANSWER) };
        return questions.length ? { ...next, phase: { name: 'followUp', index: 0 } } : { ...next, phase: { name: 'review' } };
      }
      return { ...state, second: event.result, phase: { name: 'review' }, notice: null };
    }
    case 'failed':
      if (phase.name !== 'understanding') return state;
      if (phase.round === 2) {
        // The answers are kept as said, as rows to check on the review page.
        const second = { items: verbatimItems(pendingAnswers(state)), none: [], declined: [] };
        return { ...state, second, phase: { name: 'review' }, notice: 'answersVerbatim' };
      }
      return { ...state, phase: { name: 'failed', reason: event.reason, ...(event.detail ? { detail: event.detail } : {}) } };
    case 'cancel':
      if (phase.name !== 'understanding') return state;
      if (phase.round === 2) return { ...state, phase: { name: 'followUp', index: state.questions.length - 1 } };
      return { ...state, phase: { name: 'transcript' } };
    case 'retry':
      if (phase.name !== 'failed' || phase.reason === 'noAi') return state;
      return { ...state, phase: { name: 'understanding', round: 1 } };
    case 'answerText':
      if (phase.name !== 'followUp') return state;
      return setAnswer(state, phase.index, (a) => ({ ...a, text: event.text, skipped: false }));
    case 'toggleChip': {
      if (phase.name !== 'followUp') return state;
      const question = state.questions[phase.index];
      if (!question.chips.some((c) => c.id === event.chip)) return state;
      const toggled = setAnswer(state, phase.index, (a) => ({
        ...a,
        skipped: false,
        chips: question.multi
          ? a.chips.includes(event.chip)
            ? a.chips.filter((c) => c !== event.chip)
            : [...a.chips, event.chip]
          : [event.chip],
      }));
      // A single-choice chip answers at once.
      return question.multi ? toggled : moveOn(toggled, phase.index);
    }
    case 'next':
      if (phase.name !== 'followUp') return state;
      return moveOn(state, phase.index);
    case 'skipQuestion':
      if (phase.name !== 'followUp') return state;
      return moveOn(setAnswer(state, phase.index, () => ({ ...EMPTY_ANSWER, skipped: true })), phase.index);
    case 'back':
      switch (phase.name) {
        case 'listening':
          // The screen stops the microphone; its end event brings the words to the transcript.
          return state;
        case 'transcript':
          return { ...state, phase: { name: 'intro' }, typing: false };
        case 'followUp':
          return { ...state, phase: phase.index > 0 ? { name: 'followUp', index: phase.index - 1 } : { name: 'transcript' } };
        case 'review':
          // Back to the questions with round 1's findings (round 2 runs again when they go on).
          if (state.questions.length) return { ...state, phase: { name: 'followUp', index: state.questions.length - 1 } };
          return { ...state, phase: { name: 'transcript' } };
        case 'failed':
          return { ...state, phase: { name: 'transcript' } };
        case 'understanding':
          return introReducer(state, { type: 'cancel' });
        default:
          return state;
      }
    case 'save':
      if (phase.name !== 'review') return state;
      return { ...state, phase: { name: 'saving' } };
    case 'saved':
      if (phase.name !== 'saving') return state;
      return { ...state, phase: { name: 'saved', count: event.count } };
    case 'done':
      return { ...state, phase: { name: 'exit', to: 'done' } };
  }
}

/** Whether the screen's back button stays inside the flow (false on its first page: the step's own back applies). */
export function hasBack(state: FlowState): boolean {
  return !['intro', 'saving', 'saved', 'exit'].includes(state.phase.name);
}
