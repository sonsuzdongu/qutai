import type { Conversation } from '../chat/Conversation';

/**
 * State outside its conversation that a task sets and must clear when it ends (docs/design/16-tasks.md, TASK-17):
 * - `agentTab`: the tab the browser keeps awake for the task (Browser.setAgentTab);
 * - `background`: Android's "Keep working in the background" run and its notification;
 * - `mark`: the action marker on the page;
 * - `work`: the working strip, the answer card, the question bubble and the "task is waiting" notice.
 * Each records the task that set it last; a task that ends clears only what it still owns.
 */
export type TaskState = 'agentTab' | 'background' | 'mark' | 'work';

/** One run of the assistant for one message: from the send to the moment everything it started has unwound. */
export class Task {
  /** Stop (the panel, the strip, the notification, closing its tab) aborts this. */
  readonly controller = new AbortController();
  /** True once the agent loop and its tools have returned (or the task never got that far). */
  settled = false;
  /** True once finish ran: nothing of it is left. */
  ended = false;
  private resolveEnded!: () => void;
  /** Resolves when the task has ended. */
  readonly whenEnded = new Promise<void>((resolve) => {
    this.resolveEnded = resolve;
  });

  constructor(
    readonly id: number,
    readonly chat: Conversation,
  ) {}

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** @internal Called by the runner. */
  markEnded() {
    this.ended = true;
    this.resolveEnded();
  }
}

/**
 * The run slot and the owners of the state tasks share. One task runs at a time; the slot is claimed synchronously,
 * in the same tick as the send, so two sends (a typed one and a voice one that waited for its transcript, a saved
 * task that waited for its page) can never both start.
 *
 * A task that was stopped no longer holds the slot for another conversation: closing its tab or pressing Stop lets
 * the next message start at once, while the stopped one unwinds. In its own conversation the next message waits
 * until it has unwound, so its last steps never land after the new message.
 */
export class TaskRunner {
  private counter = 0;
  private open: Task[] = [];
  private owners = new Map<TaskState, number>();
  private listeners = new Set<() => void>();

  /** Tasks that have not ended yet, oldest first. */
  get tasks(): readonly Task[] {
    return this.open;
  }

  /** The task that is running and was not stopped, if any. */
  get live(): Task | null {
    return this.open.find((task) => !task.signal.aborted) ?? null;
  }

  /** Why a send now would not start: another task is running, or a stopped one in this conversation is unwinding. */
  blocker(chat: Conversation): Task | null {
    return this.open.find((task) => !task.signal.aborted || task.chat === chat) ?? null;
  }

  /** Claims the slot for a message to `chat`, or null when `blocker` says no. Synchronous by design. */
  claim(chat: Conversation): Task | null {
    if (this.blocker(chat)) return null;
    const task = new Task(++this.counter, chat);
    this.open.push(task);
    this.emit();
    return task;
  }

  /** Records that `task` set this state now (replacing whichever task set it before). */
  take(task: Task, state: TaskState) {
    this.owners.set(state, task.id);
  }

  /** Whether `task` was the last to set this state. */
  owns(task: Task, state: TaskState): boolean {
    return this.owners.get(state) === task.id;
  }

  /** Gives the state up if `task` still owns it; true means the caller clears it, false that a newer task has it. */
  release(task: Task, state: TaskState): boolean {
    if (!this.owns(task, state)) return false;
    this.owners.delete(state);
    return true;
  }

  /** The agent loop has returned: the task now only tidies up. */
  settle(task: Task) {
    task.settled = true;
  }

  /** The task is over (finished, failed, stopped, or turned away before it began): the slot is free of it. */
  end(task: Task) {
    if (task.ended) return;
    task.settled = true;
    this.open = this.open.filter((t) => t !== task);
    task.markEnded();
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}
