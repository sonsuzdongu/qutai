import { useSyncExternalStore } from 'react';
import type { Conversation } from '../chat/Conversation';

/**
 * Redraws the calling component on every change of this conversation, including each streamed piece of an answer and
 * each letter typed, which the rest of the app is not told about (UI-29).
 */
export function useConversation(chat: Conversation): Conversation {
  useSyncExternalStore(chat.subscribe, chat.getVersion);
  return chat;
}
