import { AccessibilityInfo } from 'react-native';
import { currentTabNote } from '../agent/contextNote';
import { withIdentity } from '../agent/identity';
import type { AgentOptions } from '../agent/runAgent';
import type { AgentEvent } from '../agent/types';
import type { AnswerCost } from '../ai/cost';
import { geminiStreamingAvailable } from '../ai/gemini';
import { loadCatalog } from '../ai/openrouterModels';
import { plainError } from '../ai/plainError';
import { getProvider, isConfigured, modelLabel, requestTarget } from '../ai/providers';
import type { ProviderId, Turn } from '../ai/types';
import type { Tab } from '../browser/Tab';
import { describeAttachments, type AttachmentInfo } from '../chat/attachments';
import { newItem, optionsItem, sourcesItem, userItem, type Conversation } from '../chat/Conversation';
import { plainAnswer } from '../chat/stripLine';
import type { ChatItem, ChatItemAction } from '../components/AssistantPanel';
import { nothingSent, RelayError } from '../credits/errors';
import { limitsFor, offeredModels } from '../credits/rules';
import { defaultTier, tierTarget, usesTiers } from '../credits/tiers';
import type { PublicConfig, Tier } from '../credits/types';
import type { TaskOutcome } from '../device/backgroundTask';
import { t } from '../i18n';
import type { TaskNoticeEvent } from '../agent/taskNotice';
import { taskToolContext, type ToolServices } from './taskContext';
import type { Task, TaskRunner } from './taskRunner';

/**
 * One task from the user's send to the moment everything it started has unwound (docs/design/16-tasks.md, TASK-17).
 * App.tsx hands each send here with what is React (the screen's state, its dialogs); everything else lives here and
 * is tested in Node (scripts/task-tests).
 *
 * The order: claim the run slot (synchronously, in the send's own tick), check what may refuse the message before it
 * is taken (images for a model without image input, Qutai Credits' sign-in and disclosure, a provider without a key),
 * take the message, begin (the conversation runs, the agent's tab, the strip, the background run), run the agent
 * loop, and finish: the conversation's own end always, the shared state only where this task still owns it.
 */

/** Where a message comes from. */
export type SendOptions = {
  /** The tab the task is for (a saved task's page, opened just before); otherwise the tab on screen. */
  tab?: Tab;
  /** A saved task meant for no particular page, so the model is told not to start from the one on screen. */
  noPage?: boolean;
  /** A voice message from holding the Qutai button, sent with the panel closed: files attached and a draft stay. */
  voice?: boolean;
  /** Sent with the panel closed without voice (an answer tapped in the question bubble over the page, WORK-17). */
  closed?: boolean;
};

/** How a task ended, for the screen: the working strip, the answer card and the question bubble. */
export type TaskEndView = {
  chat: Conversation;
  outcome: TaskOutcome['kind'];
  /** The last answer since the user's message, as plain text ('' when none). */
  answerText: string;
  /** The last options (cards) since the user's message. */
  cards: ChatItem | null;
  /** The question it ended with (only when it ended waiting for an answer). */
  question: ChatItem | null;
};

/** What a task needs from the app beyond the tools' services. */
export type TaskHost = ToolServices & {
  runner: TaskRunner;
  runAgent: (opts: AgentOptions) => Promise<void>;
  /** Writes the conversation to storage (storage/chat.ts storeChat decides what an incognito one leaves: nothing). */
  save: (chat: Conversation) => void;
  credits: {
    ready: () => boolean;
    signedIn: () => boolean;
    /** The Qutai Credits disclosure, asked before the first use; true when accepted. */
    askDisclosure: () => Promise<boolean>;
    promptSignIn: () => void;
    config: () => Promise<PublicConfig>;
    refresh: () => void;
  };
  /** A saved task waiting in the input of this conversation is sent now (it leaves the input). */
  preparedSent: (chat: Conversation) => void;
  /** The message could not start (another task runs): it is back in the input, and the user is told. */
  busy: (chat: Conversation) => void;
  ui: {
    /** The task begins: the panel drops into the strip, or stays closed (voice, the question bubble). */
    start: (panelClosed: boolean) => void;
    end: (view: TaskEndView) => void;
  };
  background: {
    /** Android's background run for this task (title: the user's message), or null when it may not go on there. */
    begin: (title: string | null) => void;
    end: (outcome: TaskOutcome) => void;
    /** The background run speaks for this task's ending (its own notification). */
    notifies: () => boolean;
  };
  notices: {
    /** "Notify me when a task finishes". */
    notifyWhenDone: () => boolean;
    /** Takes back the "task is waiting" notice scheduled when the user left. */
    takeBackPaused: () => void;
    /** The "task finished" notification, when one is due (agent/taskNotice.ts). */
    notice: (chat: Conversation, event: TaskNoticeEvent, backgroundRunNotified: boolean) => void;
    /** A task ended (not stopped): felt, and shown as unseen where the user isn't looking. */
    ended: (chat: Conversation, kind: 'done' | 'failed' | 'needsAnswer') => void;
    /** The tab whose conversation the last background-capable task belongs to (its notification opens it). */
    taskTab: (tabId: string) => void;
  };
  clearMark: () => void;
};

/** Time a message waits for a stopped task in its own conversation to unwind before it is turned away. */
const UNWIND_WAIT_MS = 5000;

/**
 * The model a message from this conversation would go to, by name, when it can't take images; null when it can (or
 * when the provider isn't set up, which the send reports on its own).
 */
export async function imagesBlockedFor(host: Pick<TaskHost, 'settings'>, chat: Conversation): Promise<string | null> {
  const settings = host.settings();
  const choice = chat.model && isConfigured(settings, chat.model.provider) ? chat.model : null;
  const provider = choice?.provider ?? settings.provider;
  if (!isConfigured(settings, provider)) return null;
  if (getProvider(provider).catalog) await loadCatalog();
  const target = requestTarget(settings, provider, choice?.model);
  return target.images ? null : modelLabel(provider, target.model);
}

/** Claims the run slot for this conversation, waiting a moment for a stopped task of its own to unwind. */
async function claimSlot(runner: TaskRunner, chat: Conversation): Promise<Task | null> {
  const task = runner.claim(chat);
  if (task) return task;
  const blocker = runner.blocker(chat);
  if (!blocker || !blocker.signal.aborted) return null;
  await Promise.race([blocker.whenEnded, new Promise((resolve) => setTimeout(resolve, UNWIND_WAIT_MS))]);
  return runner.claim(chat);
}

/**
 * Checks that may refuse the message before it is taken, so a refusal leaves it in the input with its files (nothing
 * is lost). False: refused, and said in the conversation.
 */
async function mayTakeMessage(host: TaskHost, chat: Conversation, text: string, panelClosed: boolean): Promise<boolean> {
  // Images go only to a model that takes them: said before anything is sent, with the message kept in the input.
  if (!panelClosed && chat.pending.some((a) => a.kind === 'image')) {
    const blocked = await imagesBlockedFor(host, chat);
    if (blocked) {
      chat.setDraft(text);
      chat.add(newItem('error', t('attach.noImageInput', { model: blocked })));
      return false;
    }
  }
  // Qutai Credits: signed in, and the disclosure answered before the first use (asked here if it never was).
  const settings = host.settings();
  const intended = chat.model && isConfigured(settings, chat.model.provider) ? chat.model.provider : settings.provider;
  if (intended === 'qutai' && !host.credits.ready()) {
    const signedIn = host.credits.signedIn();
    if (!(signedIn && (await host.credits.askDisclosure()))) {
      chat.setDraft(keptDraft(chat, text));
      chat.add({
        ...newItem('error', t(signedIn ? 'credits.error.notAccepted' : 'credits.error.notSignedInKept')),
        ...(signedIn ? {} : { action: 'signIn' as const }),
      });
      host.save(chat);
      if (!signedIn) host.credits.promptSignIn();
      return false;
    }
  }
  return true;
}

/** The input after a message is handed back: the message, after anything typed meanwhile. */
export function keptDraft(chat: Conversation, text: string): string {
  return chat.draft.trim() && chat.draft.trim() !== text.trim() ? `${chat.draft.trimEnd()}\n\n${text}` : text;
}

/** The provider and model this message goes to: the conversation's own choice if still set up, else Settings'. */
function chooseModel(host: TaskHost, chat: Conversation): { provider: ProviderId; model?: string } | null {
  const settings = host.settings();
  // Read once here: a running task keeps the model it started with.
  const choice = chat.model;
  const useChoice = !!choice && isConfigured(settings, choice.provider);
  if (choice && !useChoice) {
    chat.add(newItem('info', t('chat.modelChoiceUnavailable', { provider: getProvider(choice.provider).label })));
    chat.setModel(null);
  }
  const provider = useChoice ? choice.provider : settings.provider;
  if (!isConfigured(settings, provider)) {
    chat.add(
      newItem(
        'error',
        getProvider(provider).needsEndpoint ? t('chat.missingEndpoint') : t('chat.missingKey', { provider: getProvider(provider).label }),
      ),
    );
    host.save(chat);
    host.showSettings();
    return null;
  }
  return { provider, ...(useChoice ? { model: choice.model } : {}) };
}

/** The user's message, shown (with the files attached to it, unless sent with the panel closed). */
function showMessage(chat: Conversation, text: string, panelClosed: boolean) {
  const attachments = panelClosed ? [] : chat.takePending();
  const sent = userItem(text, attachments);
  chat.add(sent);
  return { sent, attachments };
}

/** The message's turn for the model: the text, the attachments, PDFs made since, and the page's note. */
function messageTurn(chat: Conversation, current: Tab, tabCount: number, text: string, attachments: AttachmentInfo[], noPage: boolean): Turn {
  // The page's title goes between untrusted-content markers (agent/contextNote.ts, UNTR-21).
  const pageInfo = currentTabNote(current, tabCount, noPage);
  const message = text || (attachments.length ? 'See the attached files.' : '');
  const attached = attachments.length ? `\n\n${describeAttachments(attachments)}` : '';
  const madeNote = chat.takeMadeNote();
  const made = madeNote ? `\n\n${madeNote}` : '';
  const turn: Turn = { role: 'user', text: message + attached + made + pageInfo, ...(attachments.length ? { attachments } : {}) };
  chat.turns.push(turn);
  return turn;
}

/** What the task's events have said so far about how it ends. */
type Ending = { outcome: TaskOutcome; lastText: string; cost: AnswerCost | null };

/** How the task ends, for the notification when it ends in the background: its last reply, an error, or a question. */
export function noteOutcome(ending: Ending, event: AgentEvent) {
  if (event.type === 'text') ending.lastText = event.text || ending.lastText;
  if (event.type === 'error') ending.outcome = { kind: 'failed', text: event.text };
  else if (event.type === 'choices') ending.outcome = { kind: 'needsAnswer' };
  else if (event.type === 'text' || event.type === 'action') ending.outcome = { kind: 'done' };
}

/** Shows one of the agent's events in the conversation. */
export function showAgentEvent(chat: Conversation, event: AgentEvent) {
  if (event.type === 'text_delta') return chat.appendStreaming(event.text);
  if (event.type === 'text') return chat.finishStreaming(event.text);
  if (event.type === 'sources') return chat.add(sourcesItem(event.sources, event.searchWidget));
  if (event.type === 'options') return chat.add(optionsItem(event.cards, event.incognito));
  if (event.type === 'choices') {
    AccessibilityInfo.announceForAccessibility(event.text);
    return chat.add(newItem('choices', event.text, event.options));
  }
  const item = newItem(event.type, event.text);
  chat.add({
    ...item,
    ...('icon' in event && event.icon ? { icon: event.icon } : {}),
    ...(event.type === 'action' && event.tool ? { tool: event.tool } : {}),
    ...(event.type === 'error' && event.details ? { details: event.details } : {}),
  });
}

/** Qutai Credits: the server's configuration decides the model (its default tier, or an offered model). */
async function creditsTarget(host: TaskHost, target: { model: string }) {
  const credits = await host.credits.config();
  let tier: Tier | null = null;
  if (usesTiers(credits)) {
    // Tiers: always the server's default one (CRED-39). A tier chosen in an older version is still stored but not
    // read, so it can't name a tier the server no longer has.
    tier = defaultTier(credits);
    if (tier) target.model = tier.id;
  } else {
    // The model saved earlier is no longer offered: the server's first one (the relay refuses others).
    const offered = offeredModels(credits);
    if (!offered.some((m) => m.model === target.model) && offered[0]) target.model = offered[0].model;
  }
  return { credits, tier };
}

/** A task that failed: one plain sentence in the conversation, with the way on under it (Qutai Credits). */
function reportFailure(chat: Conversation, e: unknown, provider: ProviderId) {
  const action: ChatItemAction | undefined =
    provider === 'qutai' && e instanceof RelayError
      ? e.kind === 'insufficient_credits'
        ? 'buyCredits'
        : e.kind === 'not_signed_in'
          ? 'signIn'
          : undefined
      : undefined;
  // The raw text (status, the provider's message) stays available as its details.
  const shown = plainError(e, { credits: provider === 'qutai' });
  chat.add({
    ...newItem('error', shown.message),
    ...(shown.details && shown.details !== shown.message ? { details: shown.details } : {}),
    ...(action ? { action } : {}),
  });
}

/** The end of a task for the screen: its last answer, cards and question since the user's message. */
export function endView(chat: Conversation, sentId: string, outcome: TaskOutcome['kind']): TaskEndView {
  const sentAt = chat.items.findIndex((item) => item.id === sentId);
  const since = sentAt === -1 ? [] : chat.items.slice(sentAt + 1);
  const answer = since.filter((item) => item.kind === 'assistant' && item.text.trim()).pop();
  const cards = since.filter((item) => item.kind === 'options' && item.cards?.length).pop() ?? null;
  const question = outcome === 'needsAnswer' ? (since.filter((item) => item.kind === 'choices').pop() ?? null) : null;
  return { chat, outcome, answerText: answer ? plainAnswer(answer.text) : '', cards, question };
}

/**
 * Sends a message: the whole task. Returns once it has unwound (or was turned away). Every send goes through here;
 * a second send while a task runs is turned away synchronously, with its text kept in the input.
 */
export async function sendTask(host: TaskHost, text: string, options: SendOptions = {}): Promise<void> {
  const { browser, runner } = host;
  const panelClosed = !!options.voice || !!options.closed;
  // The conversation belongs to the tab the user is looking at when they send the task, and stays there even if the
  // agent moves to other tabs. A grouped tab's conversation is the group's.
  const current = options.tab && browser.getTab(options.tab.id) ? options.tab : browser.active;
  const chat = browser.conversationOf(current);
  const task = await claimSlot(runner, chat);
  if (!task) {
    // Never lost: back in the input (a voice message's text too), with the files still attached.
    if (text.trim()) chat.setDraft(keptDraft(chat, text));
    host.busy(chat);
    return;
  }
  try {
    // Marked before anything is shown, so a message typed in an incognito tab is never saved.
    if (current.incognito) chat.privacy.touchedIncognito = true;
    if (!(await mayTakeMessage(host, chat, text, panelClosed))) return;
    if (!panelClosed) host.preparedSent(chat);
    const { sent, attachments } = showMessage(chat, text, panelClosed);
    const model = chooseModel(host, chat);
    if (!model) return;
    const turn = messageTurn(chat, current, browser.tabs.length, text, attachments, !!options.noPage);
    await runTask(host, task, { current, text, panelClosed, provider: model.provider, model: model.model, sent, attachments, turn });
  } finally {
    runner.end(task);
  }
}

type Started = {
  current: Tab;
  text: string;
  panelClosed: boolean;
  provider: ProviderId;
  model?: string;
  sent: ChatItem;
  attachments: AttachmentInfo[];
  turn: Turn;
};

/** Begins the task (the shared state it takes), runs the agent loop and finishes. */
async function runTask(host: TaskHost, task: Task, start: Started) {
  const { runner } = host;
  const { chat } = task;
  const { current, provider, sent, turn: userTurn } = start;
  const settings = host.settings();
  const agentTab = { id: current.id };
  // Research applies to this one message.
  const research = chat.research;
  if (research) chat.setResearch(false);
  const signal = chat.start(task.controller);
  const incognito = () => chat.incognito || chat.privacy.touchedIncognito;
  begin(host, task, agentTab, start, settings.backgroundTasks && !incognito());

  const ending: Ending = { outcome: { kind: 'done' }, lastText: '', cost: null };
  try {
    // Catalogue providers: what the cached catalogue says about the model (images, output limit).
    if (getProvider(provider).catalog) await loadCatalog();
    const target = requestTarget(settings, provider, start.model);
    const { credits, tier } = provider === 'qutai' ? await creditsTarget(host, target) : { credits: null, tier: null };
    // Which provider's format the answer comes in (Gemini streams only with its setting).
    const underlying = tier
      ? tierTarget(tier, chat.turns).format
      : (credits?.models.find((m) => m.model === target.model)?.provider ?? provider);
    const limits = credits ? limitsFor(credits, tier) : null;
    // Which AI it is, for "which model are you?": Qutai Credits (no tier named), else the provider and model.
    if (userTurn.role === 'user') {
      userTurn.text = withIdentity(
        userTurn.text,
        provider === 'qutai' ? { mode: 'credits' } : { mode: 'own', provider: getProvider(provider).label, model: target.model },
      );
    }
    await host.runAgent({
      ...taskToolContext(host, { chat, signal, incognito }),
      provider,
      apiKey: target.apiKey,
      model: target.model,
      endpoint: target.endpoint,
      extraHeaders: target.extraHeaders,
      imageInput: target.images,
      maxOutputTokens: target.maxOutputTokens,
      turns: chat.turns,
      agentTab,
      askedFrom: { id: current.id },
      privacy: chat.privacy,
      memory: settings.memoryEnabled ? host.memory : undefined,
      customInstructions: settings.customInstructions,
      // Research without web search would be guesswork, so it always searches. Only where the provider has its own
      // web search; elsewhere the assistant searches in the browser.
      webSearch: getProvider(provider).webSearch && (settings.webSearch || research),
      research,
      // Gemini streams only with its experimental setting, and not after the API rejected a streamed reply.
      stream: underlying !== 'gemini' || (settings.geminiStreaming && geminiStreamingAvailable()),
      ...(limits
        ? {
            // The tier's own limits on a server with tiers.
            serverLimits: {
              maxSteps: limits.maxSteps,
              maxResearchSteps: limits.maxResearchSteps,
              maxMemoryChars: limits.maxMemoryChars,
              maxImages: limits.maxImages,
            },
          }
        : {}),
      signal,
      audit: { conversation: () => chat.key, incognito },
      onCost: (cost) => {
        ending.cost = cost;
      },
      onEvent: (event) => {
        noteOutcome(ending, event);
        showAgentEvent(chat, event);
      },
    });
    if (signal.aborted) chat.add({ ...newItem('info', t('chat.stopped')), icon: 'stop' });
    else AccessibilityInfo.announceForAccessibility(t('a11y.taskDone'));
  } catch (e) {
    // Qutai Credits refused the first request (no credits, maintenance, signed out…): nothing reached the AI and
    // nothing was charged, so the message goes back into the input instead of staying unanswered.
    const kept =
      !signal.aborted && provider === 'qutai' && nothingSent(e) && chat.withdraw(sent.id, userTurn, start.text, start.attachments);
    if (signal.aborted) chat.add({ ...newItem('info', t('chat.stopped')), icon: 'stop' });
    else reportFailure(chat, e, provider);
    if (kept) chat.add(newItem('info', t('credits.messageKept')));
    ending.outcome = { kind: 'failed', text: plainError(e, { credits: provider === 'qutai' }).message };
    // What the server says now (a stream cut short was still charged; a refusal may mean the balance moved).
    if (provider === 'qutai' && e instanceof RelayError) host.credits.refresh();
  } finally {
    runner.settle(task);
    finish(host, task, ending, start);
  }
}

/** The shared state a task takes when it begins; each records this task as its owner. */
function begin(host: TaskHost, task: Task, agentTab: { id: string }, start: Started, mayContinue: boolean) {
  const { runner, browser } = host;
  runner.take(task, 'agentTab');
  browser.setAgentTab(agentTab);
  // A stopped task that is still unwinding may have left its mark on a page.
  runner.take(task, 'mark');
  host.clearMark();
  runner.take(task, 'work');
  host.ui.start(start.panelClosed);
  // May go on in the background (Android, opt-in) unless the conversation is incognito; the notification's title is
  // the user's own message.
  runner.take(task, 'background');
  host.background.begin(mayContinue ? start.text : null);
  if (mayContinue) host.notices.taskTab(start.current.id);
}

/**
 * The task's end. Its conversation's end always happens (the stop note, the cost, saving); the shared state (the
 * agent's tab, the mark, the strip and answer card, the background run) is cleared only where this task still owns it,
 * so a task that ends after a newer one began never clears what the newer one set.
 */
function finish(host: TaskHost, task: Task, ending: Ending, start: Started) {
  const { runner, browser } = host;
  const { chat, signal } = task;
  const incognito = chat.incognito || chat.privacy.touchedIncognito;
  let outcome = ending.outcome;
  if (signal.aborted) outcome = { kind: 'stopped' };
  else if (outcome.kind === 'done') outcome = { kind: 'done', text: ending.lastText };
  // Nothing from a conversation that touched an incognito tab goes in a notification, and with "Notify me when a task
  // finishes" off only a question for the user does.
  const quiet = !host.notices.notifyWhenDone() && outcome.kind !== 'needsAnswer';
  let backgroundRunNotified = false;
  if (runner.release(task, 'background')) {
    backgroundRunNotified = host.background.notifies() && !incognito && !quiet && outcome.kind !== 'stopped';
    host.background.end(incognito || quiet ? { kind: 'stopped' } : outcome);
  }
  // Without that background run (iOS, or the setting off), Qutai's own notification when the task ended while the
  // user was away (e.g. the answer arrived after they left).
  if (runner.owns(task, 'work')) host.notices.takeBackPaused();
  host.notices.notice(chat, outcome.kind, backgroundRunNotified);
  chat.finishStreaming();
  if (ending.cost) chat.addCost(ending.cost, start.sent.id);
  // The ledger's latest entries (a stopped request is settled on the server a little later).
  if (start.provider === 'qutai') host.credits.refresh();
  chat.finish(signal);
  if (runner.release(task, 'agentTab')) browser.setAgentTab(null);
  if (runner.release(task, 'mark')) host.clearMark();
  if (runner.release(task, 'work')) host.ui.end(endView(chat, start.sent.id, outcome.kind));
  if (outcome.kind !== 'stopped') host.notices.ended(chat, outcome.kind);
  // Saved under the conversation's key now, which may have changed meanwhile (e.g. the tab founded a group).
  host.save(chat);
}
