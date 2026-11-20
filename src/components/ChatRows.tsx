import { createContext, memo, useContext, useMemo } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import type { Source } from '../agent/types';
import type { Suggestion } from '../agent/pageSuggestions';
import { shownLabel } from '../agent/contactTool';
import type { AnswerCost } from '../ai/cost';
import type { AttachmentInfo } from '../chat/attachments';
import { describeFilters } from '../chat/filterSummary';
import { imageFormatLabel } from '../chat/imageEdit';
import type { ShareOffer } from '../chat/shareable';
import { stepSummaryText, summarizeSteps } from '../chat/stepSummary';
import { composedFileAvailable, type FileOffer } from '../device/composedFile';
import { attachmentAvailable } from '../device/attachments';
import { bump, tick } from '../device/haptics';
import type { ContactSource } from '../device/phone';
import type { SmsOffer } from '../device/sms';
import type { WhatsAppOffer } from '../device/whatsapp';
import { t } from '../i18n';
import { formatNumber, formatSize, hostOf } from '../i18n/format';
import type { SavedTask } from '../storage/savedTasks';
import { Icon, type IconName } from '../ui/Icon';
import { QutaiMark } from '../ui/QutaiMark';
import { usePalette } from '../ui/theme';
import { withoutLeadingSymbol } from '../utils/leadingSymbol';
import { AnswerCostInline, AnswerCostLine } from './AnswerCost';
import { AppCard } from './AppCard';
import { AttachmentThumb } from './AttachmentViews';
import { ACTION_ICON_WIDTH, ACTION_ICONS, LIST_PADDING, PanelTheme, ROW_MAX, useChatStyles } from './chatStyles';
import type { CardAction, ChatItem, ChatItemAction, MessageAction } from './chatTypes';
import { ErrorDetails } from './ErrorDetails';
import { hasTable, MarkdownText } from './MarkdownText';
import { OptionCards } from './OptionCards';
import { CookiesCard, StyleCard } from './pageCustomisation';
import { ScriptCard } from './pageScripts';
import { SearchSuggestions } from './SearchSuggestions';

/**
 * The chat's rows (design record UI-29). Each row is memoised and gets only its own item and a few flags, so a
 * streamed piece of an answer redraws that answer alone and typing redraws no row at all. What a row's buttons do
 * comes from one context whose functions never change (the panel keeps them pointing at its latest props).
 */
export type ChatActionHandlers = {
  /** A message's icon (copy, read aloud, share, PDF). */
  onAction: (action: MessageAction, item: ChatItem) => void;
  /** Opens a message's menu; full when opened by long press (it then lists the row's actions too). */
  onMenu: (item: ChatItem, full: boolean) => void;
  /** An option of an ask_user question was tapped. */
  onChoose: (itemId: string, option: string) => void;
  onOpenLink: (url: string) => void;
  onLinkMenu: (url: string, text: string) => void;
  onCall: (number: string) => void;
  onCard: (item: ChatItem, action: CardAction) => void;
  onSms: (offer: SmsOffer) => void;
  onWhatsApp: (offer: WhatsAppOffer) => void;
  onFile: (action: 'share' | 'save', file: FileOffer) => void;
  onImage: (action: 'share' | 'save', info: AttachmentInfo) => void;
  onShare: (offer: ShareOffer) => void;
  onOpenSource: (source: Source) => void;
  onOpenAttachment: (info: AttachmentInfo) => void;
  onItemAction: (action: ChatItemAction) => void;
};

const noop = () => {};
export const ChatActions = createContext<ChatActionHandlers>({
  onAction: noop,
  onMenu: noop,
  onChoose: noop,
  onOpenLink: noop,
  onLinkMenu: noop,
  onCall: noop,
  onCard: noop,
  onSms: noop,
  onWhatsApp: noop,
  onFile: noop,
  onImage: noop,
  onShare: noop,
  onOpenSource: noop,
  onOpenAttachment: noop,
  onItemAction: noop,
});

/** One message and, for items without a row of icons, its cost on a line of its own. */
export const ChatEntry = memo(function ChatEntry({
  item,
  reading,
  selectable,
  canChoose,
  answered,
  showCost,
  costConversation,
  listWidth,
}: {
  item: ChatItem;
  reading: boolean;
  selectable: boolean;
  canChoose: boolean;
  answered: boolean;
  showCost: boolean;
  costConversation: () => AnswerCost[];
  listWidth: number | null;
}) {
  return (
    <>
      <ChatRow
        item={item}
        reading={reading}
        selectable={selectable}
        canChoose={canChoose}
        answered={answered}
        cost={showCost ? item.cost : undefined}
        costConversation={costConversation}
        listWidth={listWidth}
      />
      {/* An answer shows its figure in its row of icons; items without that row (an error, a stopped task, a
          question) keep it on a small line of its own. */}
      {showCost && item.cost && item.kind !== 'assistant' ? <AnswerCostLine cost={item.cost} conversation={costConversation} /> : null}
    </>
  );
});

/** Same items, in the same order, as the same objects: a folded run of steps that did not change. */
const sameItems = (a: readonly ChatItem[], b: readonly ChatItem[]) => a.length === b.length && a.every((item, i) => item === b[i]);

/**
 * The empty chat: what Qutai can do, with suggestions that fit the page on screen (agent/pageSuggestions.ts, picked
 * on the phone). A tap sends one, like the quick chips.
 */
export function EmptyState({
  hasPage,
  animate,
  suggestions,
  onSuggestion,
  recentTasks,
  onRunTask,
}: {
  hasPage: boolean;
  animate: boolean;
  suggestions: Suggestion[];
  /** Null while a task runs (here or in another tab): the rows are shown but can't be tapped. */
  onSuggestion: ((suggestion: Suggestion) => void) | null;
  recentTasks: SavedTask[];
  onRunTask: (task: SavedTask) => void;
}) {
  const styles = useChatStyles();
  const palette = usePalette();
  const d = useContext(PanelTheme);
  return (
    <View style={styles.emptyBox}>
      <QutaiMark size={40} sweepWhenIdle animate={animate} />
      <Text style={styles.emptyTitle} accessibilityRole="header">
        {t('chat.emptyTitle')}
      </Text>
      <Text style={styles.emptyLead}>{t(hasPage ? 'chat.emptyLeadPage' : 'chat.emptyLeadWeb')}</Text>
      {recentTasks.length > 0 ? (
        <View style={styles.taskChips}>
          {recentTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => onRunTask(task)}
              style={({ pressed }) => [styles.chip, styles.taskChip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('tasks.runLabel', { name: task.name })}
            >
              <Icon name="tasks" size={15} color={palette.textSecondary} />
              <Text style={[styles.chipText, styles.shrink]} numberOfLines={1}>
                {task.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {suggestions.length > 0 ? (
        <View style={styles.examples}>
          <Text style={[styles.suggestTitle, d?.dim]} accessibilityRole="header">
            {t(suggestions.every((x) => x.general) ? 'suggest.titleWeb' : 'suggest.title')}
          </Text>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              onPress={onSuggestion ? () => onSuggestion(suggestion) : undefined}
              disabled={!onSuggestion}
              style={({ pressed }) => [
                styles.example,
                d?.chip,
                pressed && (d?.pressed ?? styles.pressed),
                !onSuggestion && styles.sendDisabled,
              ]}
              accessibilityRole="button"
              accessibilityHint={t('suggest.hint')}
              accessibilityState={{ disabled: !onSuggestion }}
            >
              <Icon name={suggestion.icon} size={18} color={palette.tintText} />
              <Text style={[styles.exampleText, d?.text]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                {suggestion.label}
              </Text>
              <Icon name="send" size={16} color={palette.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}


/** A message's first words as the title of its menu, without Markdown marks. */
export function menuTitle(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function ChatRow({
  item,
  reading,
  selectable,
  canChoose,
  answered,
  cost,
  costConversation,
  listWidth,
}: {
  item: ChatItem;
  /** The answer's figure for its row of icons (only when the cost display is on). */
  cost?: AnswerCost;
  costConversation: () => AnswerCost[];
  /** The message list's width (null until measured), for what fits beside the icons. */
  listWidth: number | null;
  /** This answer is being read aloud. */
  reading: boolean;
  /** This answer's text can be selected (chosen from its menu). */
  selectable: boolean;
  /** The question can still be answered. */
  canChoose: boolean;
  /**
   * The question was answered (an option tapped, or a reply typed): its options are gone and the user's own bubble
   * below says the answer, so the chat reads as question, answer.
   */
  answered?: boolean;
}) {
  const {
    onAction,
    onMenu,
    onChoose,
    onOpenLink,
    onLinkMenu,
    onCall,
    onCard,
    onSms,
    onWhatsApp,
    onFile,
    onImage,
    onShare,
    onOpenSource,
    onOpenAttachment,
    onItemAction,
  } = useContext(ChatActions);
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const textStyle = styles.assistantText;
  const wide = item.kind === 'assistant' && hasTable(item.text);
  switch (item.kind) {
    case 'user':
      return (
        <View style={styles.userRow}>
          {item.attachments?.length ? (
            <View style={styles.sentThumbs}>
              {item.attachments.map((a, i) => (
                <AttachmentThumb key={a.id} info={a} index={i} size={72} onPress={() => onOpenAttachment(a)} />
              ))}
            </View>
          ) : null}
          {item.text ? (
            // Long press: Copy, Save as task (no row under the user's own messages: it would repeat under every one).
            <Pressable
              onLongPress={() => {
                bump();
                onMenu(item, true);
              }}
              style={[styles.bubble, styles.userBubble]}
              accessibilityHint={t('chat.userMessageHint')}
              accessibilityActions={[{ name: 'longpress', label: t('chat.moreActions') }]}
              onAccessibilityAction={() => onMenu(item, true)}
            >
              <Text style={styles.userText}>{item.text}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    case 'assistant': {
      const bubbleStyle = [styles.bubble, styles.assistantBubble, d?.assistantBubble];
      const markdown = (
        <MarkdownText
          text={item.streaming ? `${item.text} ▍` : item.text}
          style={textStyle}
          onOpenLink={onOpenLink}
          onLinkMenu={onLinkMenu}
          onCall={onCall}
          dark={!!d}
          selectable={selectable}
        />
      );
      return (
        // Always the column's full width (90%, the whole panel for tables), never shrink-wrapped to the text: list
        // items are a marker beside text that flexes, which reports almost no width of its own, so a shrink-wrapped
        // bubble took the width of its widest paragraph and squeezed long items into a narrow column. A fixed width
        // also keeps the bubble from changing width while the answer streams in.
        <View style={[styles.assistantRow, wide && styles.wideRow]}>
          {/* Long press: every action by name. Once "Select text" is chosen, a long press selects instead
              (a Pressable around the text would keep it from being selected). */}
          {item.streaming || selectable ? (
            <View style={bubbleStyle}>{markdown}</View>
          ) : (
            <Pressable
              onLongPress={() => {
                bump();
                onMenu(item, true);
              }}
              style={bubbleStyle}
              // Not one element for screen readers: its links stay reachable, and the row below has every action.
              accessible={false}
            >
              {markdown}
            </Pressable>
          )}
          {item.streaming ? null : (
            <View style={styles.messageActions}>
              <ActionIcon icon="copy" label={t('chat.actionCopy')} onPress={() => onAction('copy', item)} />
              <ActionIcon
                icon={reading ? 'stopReading' : 'readAloud'}
                label={t(reading ? 'chat.actionStopReading' : 'chat.actionRead')}
                onPress={() => onAction(reading ? 'stopSpeaking' : 'speak', item)}
              />
              <ActionIcon icon="share" label={t('chat.actionShare')} onPress={() => onAction('share', item)} />
              <ActionIcon icon="ellipsis" label={t('chat.moreActions')} onPress={() => onMenu(item, false)} />
              {cost ? (
                <AnswerCostInline
                  cost={cost}
                  conversation={costConversation}
                  room={
                    listWidth === null
                      ? null
                      : (listWidth - 2 * LIST_PADDING) * (wide ? 1 : ROW_MAX) - ACTION_ICONS * ACTION_ICON_WIDTH
                  }
                  color={d ? '#a9a8b3' : palette.textSecondary}
                />
              ) : null}
            </View>
          )}
        </View>
      );
    }
    case 'choices':
      return (
        <View style={styles.choices}>
          <View style={[styles.bubble, styles.assistantBubble, styles.choicesBubble, d?.assistantBubble]}>
            <MarkdownText text={item.text} style={textStyle} onOpenLink={onOpenLink} onLinkMenu={onLinkMenu} onCall={onCall} dark={!!d} />
          </View>
          {answered
            ? null
            : (item.options ?? []).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => onChoose(item.id, option)}
                  disabled={!canChoose}
                  style={({ pressed }) => [
                    styles.choice,
                    d?.choice,
                    !canChoose && styles.choiceClosed,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canChoose }}
                >
                  <Text style={[styles.choiceText, styles.choiceLabel]}>{option}</Text>
                </Pressable>
              ))}
        </View>
      );
    case 'options':
      if (!item.cards?.length) return <StepLine text={item.text} />;
      return (
        <OptionCards
          cards={item.cards}
          imagesOnTap={item.imagesOnTap}
          dark={!!d}
          onOpen={(card) => onOpenLink(card.url)}
          onMenu={(card) => {
            bump();
            onLinkMenu?.(card.url, card.title);
          }}
        />
      );
    case 'sources':
      return (
        <View style={styles.sources}>
          {item.sources?.length ? <Text style={styles.sourcesTitle}>{t('chat.sources')}</Text> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourcesRow}>
            {(item.sources ?? []).map((source, i) => (
              <Pressable
                key={source.url}
                onPress={() => onOpenSource(source)}
                style={({ pressed }) => [styles.source, d?.chip, pressed && styles.pressed]}
                accessibilityRole="link"
                accessibilityLabel={source.title || hostOf(source.url)}
              >
                <Text style={[styles.sourceTitle, d?.text]} numberOfLines={2}>
                  <Text style={styles.sourceIndex}>{i + 1} </Text>
                  {source.title || hostOf(source.url)}
                </Text>
                <View style={styles.sourceHostRow}>
                  {source.incognito ? (
                    <Icon name="incognito" size={12} color={d?.dim.color ?? palette.textSecondary} />
                  ) : null}
                  <Text style={[styles.sourceHost, styles.sourceHostText]} numberOfLines={1}>
                    {hostOf(source.url)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {item.searchWidget ? <SearchSuggestions html={item.searchWidget} onOpenLink={onOpenLink} /> : null}
        </View>
      );
    case 'style': {
      const offer = item.style;
      if (!offer) return <StepLine icon="palette" text={item.text} />;
      return (
        <StyleCard
          offer={offer}
          dark={!!d}
          onKeep={() => onCard(item, 'keepStyle')}
          onUndo={() => onCard(item, 'undoStyle')}
        />
      );
    }
    case 'script': {
      const offer = item.script;
      if (!offer) return <StepLine icon="script" text={item.text} />;
      return <ScriptCard offer={offer} dark={!!d} onKeep={() => onCard(item, 'keepScript')} />;
    }
    case 'app': {
      const offer = item.app;
      if (!offer) return <StepLine icon="apps" text={item.text} />;
      return <AppCard offer={offer} dark={!!d} onOpen={() => onCard(item, 'openApp')} onUndo={() => onCard(item, 'undoApp')} />;
    }
    case 'cookies': {
      const offer = item.cookiesOffer;
      if (!offer) return <StepLine icon="cookies" text={item.text} />;
      return <CookiesCard offer={offer} dark={!!d} onShow={() => onCard(item, 'showCookies')} />;
    }
    case 'call': {
      const call = item.call;
      if (!call) return <StepLine icon="phone" text={item.text} />;
      if (call.contact && !call.number) return <ContactNotKept name={call.name} icon="phone" />;
      return (
        <View style={[styles.callCard, d?.assistantBubble]}>
          <View style={styles.callInfo}>
            {call.name ? (
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {call.name}
              </Text>
            ) : null}
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {call.number}
            </Text>
            {call.contact ? <ContactLine contact={call.contact} /> : null}
          </View>
          <Pressable
            onPress={() => onCall(call.number)}
            style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={
              call.name
                ? t('chat.callLabel', { name: call.name, number: call.number })
                : t('chat.callNumberLabel', { number: call.number })
            }
          >
            <Icon name="phone" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.call')}</Text>
          </Pressable>
        </View>
      );
    }
    case 'sms': {
      const sms = item.sms;
      if (!sms) return <StepLine icon="message" text={item.text} />;
      if (sms.contact && !sms.number) return <ContactNotKept name={sms.name} icon="message" />;
      const label = sms.name
        ? t('chat.smsLabel', { name: sms.name, number: sms.number })
        : t('chat.smsNumberLabel', { number: sms.number });
      return (
        <View style={[styles.smsCard, d?.assistantBubble]}>
          <View style={styles.callInfo}>
            {sms.name ? (
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {sms.name}
              </Text>
            ) : null}
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {sms.number}
            </Text>
            {sms.contact ? <ContactLine contact={sms.contact} /> : null}
          </View>
          <Text style={[styles.smsBody, d?.text]} selectable>
            {sms.body}
          </Text>
          <Pressable
            onPress={() => onSms(sms)}
            style={({ pressed }) => [styles.callButton, styles.smsButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Icon name="message" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.openInMessages')}</Text>
          </Pressable>
        </View>
      );
    }
    case 'whatsapp': {
      const wa = item.whatsapp;
      if (!wa) return <StepLine icon="message" text={item.text} />;
      if (wa.contact && !wa.number) return <ContactNotKept name={wa.name} icon="message" />;
      const label = wa.number
        ? t('chat.whatsAppLabel', { who: wa.name ? `${wa.name}, ${wa.number}` : wa.number })
        : t('chat.whatsAppNoNumberLabel');
      return (
        <View style={[styles.smsCard, d?.assistantBubble]}>
          <View style={styles.callInfo}>
            {wa.name ? (
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {wa.name}
              </Text>
            ) : null}
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {wa.number ?? t('chat.whatsAppPickChat')}
            </Text>
            {wa.contact ? <ContactLine contact={wa.contact} /> : null}
          </View>
          <Text style={[styles.smsBody, d?.text]} selectable>
            {wa.body}
          </Text>
          <Pressable
            onPress={() => onWhatsApp(wa)}
            style={({ pressed }) => [styles.callButton, styles.smsButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Icon name="message" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.openInWhatsApp')}</Text>
          </Pressable>
        </View>
      );
    }
    case 'file': {
      const file = item.file;
      if (!file) return <StepLine icon="document" text={item.text} />;
      const details = [
        file.format.toUpperCase(),
        formatSize(file.size),
        ...(file.rows !== undefined ? [t('chat.fileRows', { count: formatNumber(file.rows) })] : []),
      ].join(' · ');
      const available = composedFileAvailable(file.id);
      return (
        <View style={[styles.smsCard, d?.assistantBubble]}>
          <View style={styles.fileHeader}>
            <Icon name="document" size={22} color={palette.textSecondary} />
            <View style={styles.callInfo}>
              <Text style={[styles.callName, d?.text]} numberOfLines={2}>
                {file.name}
              </Text>
              <Text style={[styles.callNumber, d?.dim]}>{details}</Text>
            </View>
          </View>
          {available ? (
            <View style={styles.fileButtons}>
              {Platform.OS === 'android' ? (
                <Pressable
                  onPress={() => onFile('save', file)}
                  style={({ pressed }) => [styles.fileButton, d?.chip, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t('chat.fileSaveLabel', { name: file.name })}
                >
                  <Icon name="download" size={17} color={palette.tintText} />
                  <Text style={styles.fileButtonText}>{t('chat.fileSave')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => onFile('share', file)}
                style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel={t('chat.fileShareLabel', { name: file.name })}
              >
                <Icon name="share" size={17} color={palette.onTint} />
                <Text style={styles.callButtonText}>
                  {t(Platform.OS === 'ios' ? 'chat.fileShareIos' : 'chat.fileShare')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.callNumber, d?.dim]}>{t('chat.fileExpired')}</Text>
          )}
        </View>
      );
    }
    case 'image': {
      const image = item.attachments?.[0];
      if (!image) return <StepLine icon="image" text={item.text} />;
      return <ImageCard info={image} expired={!!item.expired} onOpen={onOpenAttachment} onImage={onImage} />;
    }
    case 'pdf': {
      const pdf = item.attachments?.[0];
      if (!pdf) return <StepLine icon="pdf" text={item.text} />;
      return <PdfCard info={pdf} onOpen={onOpenAttachment} onPdf={onImage} />;
    }
    case 'share': {
      const share = item.share;
      if (!share) return <StepLine icon="share" text={item.text} />;
      return <ShareCard share={share} onOpen={onOpenAttachment} onShare={onShare} />;
    }
    case 'error':
      if (item.action) {
        const action = item.action;
        return (
          <View>
            <StepLine icon="insecure" text={item.text} error />
            {item.details ? <ErrorDetails details={item.details} /> : null}
            <Pressable
              onPress={() => onItemAction(action)}
              style={({ pressed }) => [styles.itemAction, pressed && styles.itemActionPressed]}
              accessibilityRole="button"
              hitSlop={6}
            >
              <Icon name={action === 'buyCredits' ? 'wallet' : 'person'} size={16} color={palette.tintText} />
              <Text style={styles.itemActionText}>{t(action === 'buyCredits' ? 'buy.open' : 'credits.signInOrChoose')}</Text>
            </Pressable>
          </View>
        );
      }
      if (item.details) {
        return (
          <View>
            <StepLine icon="insecure" text={item.text} error />
            <ErrorDetails details={item.details} />
          </View>
        );
      }
      return <StepLine icon="insecure" text={item.text} error />;
    default:
      return <StepLine icon={item.icon} text={item.text} />;
  }
}

/**
 * A finished task's steps folded into one line ("7 steps · opened 2 pages · filled 1 form"); a tap shows the step
 * lines as they were recorded, and hides them again.
 */
export const StepGroup = memo(
  function StepGroup({ items, expanded, onToggle }: { items: ChatItem[]; expanded: boolean; onToggle: (id: string) => void }) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const summary = stepSummaryText(summarizeSteps(items));
  const color = d?.dim.color ?? palette.textSecondary;
  return (
    <View style={styles.stepGroup}>
      <Pressable
        onPress={() => onToggle(items[0].id)}
        style={({ pressed }) => [styles.stepSummary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t(expanded ? 'steps.hideA11y' : 'steps.showA11y', { summary })}
      >
        <Icon name="tool" size={14} color={color} style={styles.stepIcon} />
        <Text style={[styles.action, d?.dim, styles.stepText]}>{summary}</Text>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={13} color={color} style={styles.stepIcon} />
      </Pressable>
      {expanded
        ? items.map((item) =>
            item.kind === 'error' ? (
              <View key={item.id}>
                <StepLine icon="insecure" text={item.text} error />
                {item.details ? <ErrorDetails details={item.details} /> : null}
              </View>
            ) : (
              <StepLine key={item.id} icon={item.icon} text={item.text} />
            ),
          )
        : null}
    </View>
  );
  },
  (a, b) => a.expanded === b.expanded && a.onToggle === b.onToggle && sameItems(a.items, b.items),
);

/** An assistant step, a status line, an error or an older card's text: a small icon, then the text. */
function StepLine({ icon, text, error }: { icon?: IconName; text: string; error?: boolean }) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const color = error ? palette.danger : (d?.dim.color ?? palette.textSecondary);
  return (
    <View style={styles.stepLine}>
      {icon ? <Icon name={icon} size={error ? 15 : 14} color={color} style={styles.stepIcon} /> : null}
      <Text style={[error ? styles.error : [styles.action, d?.dim], styles.stepText]}>{withoutLeadingSymbol(text)}</Text>
    </View>
  );
}

/** Under a card's number from the address book: its label, "from your contacts", and a country code Qutai added. */
function ContactLine({ contact }: { contact: ContactSource }) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  return (
    <>
      <Text style={[styles.callNumber, d?.dim]}>{t('chat.fromContacts', { label: shownLabel(contact.label) })}</Text>
      {contact.added ? <Text style={[styles.callNumber, d?.dim]}>{t('chat.countryAdded', { code: contact.added })}</Text> : null}
    </>
  );
}

/** A saved card whose number came from the address book: the name only (the number is never saved). */
function ContactNotKept({ name, icon }: { name?: string; icon: IconName }) {
  return <StepLine icon={icon} text={name ? `${name} · ${t('chat.contactNotKept')}` : t('chat.contactNotKept')} />;
}

/** An image the assistant made (edit_image): preview, size, format and bytes, Save to Photos and Share. */
function ImageCard({
  info,
  expired,
  onOpen,
  onImage,
}: {
  info: AttachmentInfo;
  expired: boolean;
  onOpen: (info: AttachmentInfo) => void;
  onImage: (action: 'share' | 'save', info: AttachmentInfo) => void;
}) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const available = useMemo(() => !expired && attachmentAvailable(info.id), [expired, info.id]);
  const details = [
    info.width && info.height ? `${info.width}×${info.height}` : '',
    imageFormatLabel(info.mimeType),
    formatSize(info.size),
  ]
    .filter(Boolean)
    .join(' · ');
  // What the filters did, in words ("Greyscale, sharpened").
  const filters = describeFilters(info.filters);
  return (
    <View style={[styles.smsCard, d?.assistantBubble]}>
      <View style={styles.fileHeader}>
        <AttachmentThumb info={info} index={0} size={64} onPress={() => onOpen(info)} />
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2}>
            {info.name}
          </Text>
          <Text style={[styles.callNumber, d?.dim]}>{details}</Text>
          {filters ? <Text style={[styles.callNumber, d?.dim]}>{filters}</Text> : null}
        </View>
      </View>
      {available ? (
        <View style={styles.fileButtons}>
          <Pressable
            onPress={() => onImage('save', info)}
            style={({ pressed }) => [styles.fileButton, d?.chip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.imageSaveLabel', { name: info.name })}
          >
            <Icon name="download" size={17} color={palette.tintText} />
            <Text style={styles.fileButtonText}>{t('chat.imageSave')}</Text>
          </Pressable>
          <Pressable
            onPress={() => onImage('share', info)}
            style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.fileShareLabel', { name: info.name })}
          >
            <Icon name="share" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t('chat.fileShare')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.callNumber, d?.dim]}>{t(expired ? 'chat.imageExpired' : 'attach.gone')}</Text>
      )}
    </View>
  );
}

/** A PDF Qutai made (save_pdf, or an answer saved as a PDF): name and size, Save (Android) and Share. */
function PdfCard({
  info,
  onOpen,
  onPdf,
}: {
  info: AttachmentInfo;
  onOpen: (info: AttachmentInfo) => void;
  onPdf: (action: 'share' | 'save', info: AttachmentInfo) => void;
}) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const available = useMemo(() => attachmentAvailable(info.id), [info.id]);
  return (
    <View style={[styles.smsCard, d?.assistantBubble]}>
      <View style={styles.fileHeader}>
        <AttachmentThumb info={info} index={0} size={56} onPress={() => onOpen(info)} />
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2}>
            {info.name}
          </Text>
          <Text style={[styles.callNumber, d?.dim]}>{`${t('chat.pdfPages')} · ${formatSize(info.size)}`}</Text>
        </View>
      </View>
      {available ? (
        <View style={styles.fileButtons}>
          {Platform.OS === 'android' ? (
            <Pressable
              onPress={() => onPdf('save', info)}
              style={({ pressed }) => [styles.fileButton, d?.chip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('chat.fileSaveLabel', { name: info.name })}
            >
              <Icon name="download" size={17} color={palette.tintText} />
              <Text style={styles.fileButtonText}>{t('chat.fileSave')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => onPdf('share', info)}
            style={({ pressed }) => [styles.callButton, pressed && styles.callButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('chat.fileShareLabel', { name: info.name })}
          >
            <Icon name="share" size={17} color={palette.onTint} />
            <Text style={styles.callButtonText}>{t(Platform.OS === 'ios' ? 'chat.fileShareIos' : 'chat.fileShare')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.callNumber, d?.dim]}>{t('attach.gone')}</Text>
      )}
    </View>
  );
}

/**
 * A share the assistant prepared (share), or the files an email draft took: who it is for, the files (thumbnails of
 * images, names of other files), the text, what the user does next, and for a share the button that opens WhatsApp
 * or the share sheet. Nothing is sent from here: the user picks the chat or app and sends.
 */
function ShareCard({
  share,
  onOpen,
  onShare,
}: {
  share: ShareOffer;
  onOpen: (info: AttachmentInfo) => void;
  onShare: (offer: ShareOffer) => void;
}) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  const fileNames = share.files.map((f) => f.name).join(', ');
  const who = [share.name, share.number].filter(Boolean).join(', ');
  const email = share.app === 'email';
  return (
    <View style={[styles.smsCard, d?.assistantBubble]}>
      {email ? (
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2}>
            {share.subject ? t('chat.emailDraftTitle', { subject: share.subject }) : t('chat.emailNoSubject')}
          </Text>
          {share.to?.length ? (
            <Text style={[styles.callNumber, d?.dim]} selectable>
              {t('chat.emailTo', { to: share.to.join(', ') })}
            </Text>
          ) : null}
        </View>
      ) : who ? (
        <View style={styles.callInfo}>
          <Text style={[styles.callName, d?.text]} numberOfLines={2} selectable>
            {share.app === 'whatsapp' ? t('chat.shareLookFor', { who }) : who}
          </Text>
        </View>
      ) : null}
      {share.files.length ? (
        <View style={styles.shareFiles}>
          {share.files.map((f, i) =>
            f.attachment ? (
              <AttachmentThumb key={f.id} info={f.attachment} index={i} size={64} onPress={() => onOpen(f.attachment!)} />
            ) : (
              <View key={f.id} style={styles.shareFileChip} accessible accessibilityLabel={`${f.name}, ${formatSize(f.size)}`}>
                <Icon name="document" size={18} color={palette.textSecondary} />
                <Text style={[styles.callNumber, d?.text]} numberOfLines={2}>
                  {f.name}
                </Text>
              </View>
            ),
          )}
        </View>
      ) : null}
      {share.files.some((f) => f.attachment) ? (
        <Text style={[styles.callNumber, d?.dim]} numberOfLines={3}>
          {fileNames}
        </Text>
      ) : null}
      {share.original ? <Text style={[styles.callNumber, d?.dim]}>{t('chat.shareOriginal')}</Text> : null}
      {share.text ? (
        <Text style={[styles.smsBody, d?.text]} selectable>
          {share.text}
        </Text>
      ) : null}
      <Text style={[styles.callNumber, d?.dim]}>
        {email
          ? t(share.delivered === 'share' ? 'chat.emailFilesShared' : 'chat.emailFilesComposer')
          : t(share.app === 'whatsapp' ? 'chat.sharePickChat' : 'chat.sharePickApp')}
      </Text>
      {!email && share.copiesText ? (
        <Text style={[styles.callNumber, d?.dim]}>
          {t(share.app === 'whatsapp' ? 'chat.shareCopiesTextWhatsApp' : 'chat.shareCopiesText')}
        </Text>
      ) : null}
      {!email ? (
        <Pressable
          onPress={() => onShare(share)}
          style={({ pressed }) => [styles.callButton, styles.smsButton, pressed && styles.callButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel={t(share.app === 'whatsapp' ? 'chat.shareToWhatsAppLabel' : 'chat.shareToLabel', {
            files: fileNames || t('chat.shareTo'),
          })}
        >
          <Icon name={share.app === 'whatsapp' ? 'message' : 'share'} size={17} color={palette.onTint} />
          <Text style={styles.callButtonText}>{t(share.app === 'whatsapp' ? 'chat.shareToWhatsApp' : 'chat.shareTo')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * An icon under an answer: quiet (secondary colour), 44pt wide and 36pt tall plus 4pt of slop above and
 * below, so it is a 44pt target. Icons are drawn in points, so the row keeps its width at any font size.
 */
function ActionIcon({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const styles = useChatStyles();
  const d = useContext(PanelTheme);
  const palette = usePalette();
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [styles.actionIcon, pressed && (d ? d.pressed : styles.pressed)]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={18} color={d ? '#a9a8b3' : palette.textSecondary} />
    </Pressable>
  );
}
