import type { Source } from '../agent/types';
import type { AppOffer } from '../agent/appTool';
import type { ScriptOffer } from '../agent/scriptTool';
import type { AnswerCost } from '../ai/cost';
import type { AttachmentInfo } from '../chat/attachments';
import type { OptionCard } from '../chat/optionCards';
import type { ShareOffer } from '../chat/shareable';
import type { FileOffer } from '../device/composedFile';
import type { CallOffer } from '../device/phone';
import type { SmsOffer } from '../device/sms';
import type { WhatsAppOffer } from '../device/whatsapp';
import type { IconName } from '../ui/Icon';
import type { CookiesOffer, StyleOffer } from './pageCustomisation';

export type ChatItemAction = 'buyCredits' | 'signIn';
export type CardAction = 'keepStyle' | 'undoStyle' | 'showCookies' | 'keepScript' | 'openApp' | 'undoApp';

export type ChatItem = {
  id: string;
  kind:
    | 'user'
    | 'assistant'
    | 'action'
    | 'error'
    | 'info'
    | 'choices'
    | 'sources'
    | 'call'
    | 'sms'
    | 'whatsapp'
    | 'file'
    | 'image'
    | 'pdf'
    | 'share'
    | 'style'
    | 'script'
    | 'cookies'
    | 'app'
    | 'options';
  /** For 'options': the lines older versions show instead of the cards (chat/optionCards.ts cardsText). */
  text: string;
  /** For 'action' and 'info': the icon before the text (absent in conversations saved before icons). */
  icon?: IconName;
  /** For 'action': the tool's name, for the step summary (absent in conversations saved before it was kept). */
  tool?: string;
  /** For 'choices': the buttons offered. */
  options?: string[];
  /** For 'choices': the option the user tapped. */
  chosen?: string;
  /** For 'assistant': the reply is still being written. */
  streaming?: boolean;
  /** For 'options': the assistant's options as cards (show_options), checked again whenever they are read back. */
  cards?: OptionCard[];
  /** For 'options': from an incognito conversation, so the pictures wait for "Show images". */
  imagesOnTap?: boolean;
  /** For 'sources': the pages the answer is based on. */
  sources?: Source[];
  /** For 'sources': Google's search suggestions widget, shown with Gemini answers grounded in Google Search. */
  searchWidget?: string;
  /** For 'style': a style the assistant applied after the user's approval, with Keep… and Undo (pageCustomisation.tsx). */
  style?: StyleOffer;
  /** For 'script': a script that ran on the page after the user's approval, with Keep for this site… (pageScripts.tsx). */
  script?: ScriptOffer;
  /** For 'app': an app the assistant made or changed (apps tool), with Open and Undo (AppCard.tsx). */
  app?: AppOffer;
  /** For 'cookies': the cookie list's card ("Show cookies"); counts only, never names or values. */
  cookiesOffer?: CookiesOffer;
  /** For 'call': the number behind the Call button (stays usable, unlike ask_user options). */
  call?: CallOffer;
  /** For 'sms': the prepared text message behind the "Open in Messages" button. */
  sms?: SmsOffer;
  /** For 'whatsapp': the prepared message behind the "Open in WhatsApp" button. */
  whatsapp?: WhatsAppOffer;
  /** For 'file': the composed file behind the Share / Save buttons (only its name and size; the content is not saved). */
  file?: FileOffer;
  /**
   * For 'user': the files attached to the message (their manifest; the files are on the phone). For 'image': the one
   * image the assistant made with edit_image. For 'pdf': the one PDF Qutai made.
   */
  attachments?: AttachmentInfo[];
  /** For 'share': the prepared share (or the files an email draft took), described without content. */
  share?: ShareOffer;
  /** For 'image': its file was removed to keep the conversation's edited images under the limit. */
  expired?: boolean;
  /** The last item of a task: the tokens and approximate cost of all the task's requests (numbers only). */
  cost?: AnswerCost;
  /** For 'error': a way out offered under it (Qutai Credits: buy credits, or sign in / choose another provider). */
  action?: ChatItemAction;
  /** For 'error': the raw error text behind the plain sentence, shown on demand (ai/plainError.ts). */
  details?: string;
};

export type MessageAction = 'copy' | 'speak' | 'stopSpeaking' | 'share' | 'pdf';
