/**
 * The assistant panel ↔ step strip state machine while a task runs (docs/working-mode.md). Pure, tested in
 * scripts/assistant-tests/workingMode.test.ts; App.tsx feeds it events and shows `panel`, the strip or the answer card.
 */

export type WorkingView = {
  /** A task is running (and, while `asking`, waits for the user's answer to a dialog). */
  phase: 'idle' | 'working' | 'asking';
  /** The panel is open. */
  panel: boolean;
  /** The user opened the panel during the task: it stays open until the task ends. */
  pinned: boolean;
  /** The panel was opened for a dialog (not by the user): it drops back into the strip once answered. */
  autoOpened: boolean;
  /** Where the task was started: from the open panel, or with it closed (voice from the Q logo, a reminder). */
  origin: 'panel' | 'closed';
  /** The finished task's answer to show in the answer card (origin closed). */
  answer: boolean;
  /** The task ended with a short question for the user, asked in a bubble over the page instead of the panel (WORK-17). */
  question: boolean;
};

export const idleView: WorkingView = {
  phase: 'idle',
  panel: false,
  pinned: false,
  autoOpened: false,
  origin: 'panel',
  answer: false,
  question: false,
};

export type WorkingEvent =
  /** `collapse`: the panel may drop into the strip (false with a screen reader on, or with the marker setting off). */
  | { type: 'start'; panelOpen: boolean; collapse: boolean }
  | { type: 'userOpen' }
  | { type: 'userClose' }
  | { type: 'asking'; on: boolean }
  /** questionFits: the question it ends with fits a bubble over the page (chat/questionBubble.ts). */
  | {
      type: 'end';
      outcome: 'done' | 'failed' | 'needsAnswer' | 'stopped';
      hasAnswer: boolean;
      sameConversation: boolean;
      questionFits?: boolean;
    }
  | { type: 'dismissAnswer' }
  | { type: 'dismissQuestion' };

export function workingStep(view: WorkingView, event: WorkingEvent): WorkingView {
  switch (event.type) {
    case 'start':
      return {
        phase: 'working',
        // A screen reader keeps the panel the user is in (its focus would otherwise be lost).
        panel: event.panelOpen && !event.collapse,
        pinned: event.panelOpen && !event.collapse,
        autoOpened: false,
        origin: event.panelOpen ? 'panel' : 'closed',
        answer: false,
        question: false,
      };
    case 'userOpen':
      if (view.phase === 'idle') return { ...view, panel: true, answer: false, question: false };
      return { ...view, panel: true, pinned: true, autoOpened: false };
    case 'userClose':
      if (view.phase === 'idle') return { ...view, panel: false };
      return { ...view, panel: false, pinned: false, autoOpened: false };
    case 'asking':
      if (view.phase === 'idle') return view;
      if (event.on) {
        if (view.phase === 'asking') return view;
        return { ...view, phase: 'asking', panel: true, autoOpened: !view.panel };
      }
      if (view.phase !== 'asking') return view;
      return { ...view, phase: 'working', panel: view.autoOpened ? view.pinned : view.panel, autoOpened: false };
    case 'end': {
      if (view.phase === 'idle') return view;
      const base = { ...idleView, origin: view.origin };
      // Stopped by the user: nothing opens; the panel stays as the user left it.
      if (event.outcome === 'stopped') return { ...base, panel: view.panel && !view.autoOpened };
      // The user switched to another conversation meanwhile: the toast and the dot say it ended (as before).
      if (!event.sameConversation) return { ...base, panel: view.panel && !view.autoOpened };
      if (event.outcome === 'done' && view.origin === 'closed' && !view.panel && event.hasAnswer) {
        return { ...base, answer: true };
      }
      // A short question while the panel is closed: asked over the page; the user's open panel stays where it is.
      if (event.outcome === 'needsAnswer' && event.questionFits && !view.panel) return { ...base, question: true };
      return { ...base, panel: true };
    }
    case 'dismissAnswer':
      return { ...view, answer: false };
    case 'dismissQuestion':
      return { ...view, question: false };
  }
}

/** The strip shows while a task runs and the panel is closed. */
export function stripVisible(view: WorkingView): boolean {
  return view.phase !== 'idle' && !view.panel;
}
