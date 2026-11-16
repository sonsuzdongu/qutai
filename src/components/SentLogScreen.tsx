import { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LAST_STEP_PROMPT, RESEARCH_PROMPT, WEB_SEARCH_PROMPT } from '../agent/runAgent';
import { customInstructionsPrompt, SYSTEM_PROMPT } from '../agent/systemPrompt';
import { MEMORY_TOOLS, TOOLS } from '../agent/tools';
import { sumCosts } from '../ai/cost';
import { getProvider, modelLabel } from '../ai/providers';
import type { ToolImage } from '../ai/types';
import { features } from '../config/features';
import { MessageKey, t } from '../i18n';
import { formatDateTime, formatNumber, formatSize, groupByDay, timeLabel } from '../i18n/format';
import { getDb } from '../storage/db';
import {
  deleteSentSince,
  listSent,
  SentContent,
  SentItem,
  SentKind,
  SentRequest,
  subscribeSentLog,
} from '../storage/sentLog';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { costLine, creditsLabel, requestBreakdown, usd } from './AnswerCost';
import { MODAL_SCREEN_EDGES } from './BottomSheet';
import { dialog, DialogHost } from './Dialog';

type Props = {
  visible: boolean;
  /** Opened from a conversation: show its requests first (the user can switch to all). */
  conversation?: string;
  /** The user's custom instructions, shown with the fixed instructions (they go with every request). */
  customInstructions?: string;
  /** Show each request's tokens and approximate cost (Settings › Assistant). */
  showCost?: boolean;
  /** Qutai Credits is the provider in use: the hint says the requests pass through Qutai's server. */
  viaQutai?: boolean;
  onClose: () => void;
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
/** Longer texts are cut in the view until "Show all" is tapped. */
const PREVIEW_CHARS = 3000;

/** "What was sent to the AI": each request to the provider, newest first, and what left the phone with it. */
export function SentLogScreen({ visible, conversation, customInstructions, showCost = true, viaQutai = false, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible && (
        <SentLog
          conversation={conversation}
          customInstructions={customInstructions}
          showCost={showCost}
          viaQutai={viaQutai}
          onClose={onClose}
        />
      )}
      <DialogHost />
    </Modal>
  );
}

const charsLabel = (n: number) =>
  n < 1000 ? t('sentLog.chars', { n }) : t('sentLog.kChars', { n: formatNumber(Math.round(n / 100) / 10) });

const kindLabel = (kind: SentKind) => t(`sentLog.kind.${kind}` as MessageKey);

/** "Page text · 12.5k chars", "Screenshot · 84 KB", "Memories (3)". */
function itemLabel(item: SentItem): string {
  if (item.kind === 'memory') return t('sentLog.memories', { count: item.count ?? 0 });
  if (item.kind === 'location') return kindLabel('location');
  if (item.imageBytes) return `${kindLabel(item.kind)} · ${formatSize(item.imageBytes)}`;
  return `${kindLabel(item.kind)} · ${charsLabel(item.chars)}`;
}

/** One chip per kind in the list, with the sizes added up; then the request's tokens and approximate cost. */
function chipsOf(entry: SentRequest, showCost: boolean): string[] {
  const merged = new Map<SentKind, SentItem>();
  for (const item of entry.items) {
    const seen = merged.get(item.kind);
    merged.set(
      item.kind,
      seen
        ? {
            ...seen,
            chars: seen.chars + item.chars,
            imageBytes: (seen.imageBytes ?? 0) + (item.imageBytes ?? 0) || undefined,
          }
        : item,
    );
  }
  const chips = [...merged.values()].map(itemLabel);
  if (entry.webSearch) chips.push(t(entry.research ? 'sentLog.research' : 'sentLog.webSearch'));
  if (!entry.items.length) chips.push(t('sentLog.continued'));
  if (showCost && entry.cost) chips.push(costLine(entry.cost));
  return chips;
}

/** "≈ $0.42 this day", when every request of the day has a priced cost. */
function dayTotal(entries: SentRequest[]): string | null {
  if (!entries.every((e) => e.cost)) return null;
  const total = sumCosts(entries.map((e) => e.cost!));
  if (total.credits !== undefined) return t('cost.dayTotalCredits', { credits: creditsLabel(total.credits) });
  return total.nanos !== undefined ? t('cost.dayTotal', { cost: usd(total.nanos) }) : null;
}

const providerLine = (e: SentRequest) =>
  [getProvider(e.provider).label, modelLabel(e.provider, e.model), e.endpoint].filter(Boolean).join(' · ');

function SentLog({
  conversation,
  customInstructions,
  showCost,
  viaQutai,
  onClose,
}: {
  conversation?: string;
  customInstructions?: string;
  showCost: boolean;
  viaQutai: boolean;
  onClose: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();
  const [onlyThis, setOnlyThis] = useState(!!conversation);
  const [entries, setEntries] = useState<SentRequest[] | null>(null);
  const [open, setOpen] = useState<SentRequest | 'instructions' | null>(null);
  const filter = onlyThis ? conversation : undefined;

  const reload = useCallback(() => {
    getDb()
      .then((db) => listSent(db, filter))
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [filter]);
  useEffect(reload, [reload]);
  useEffect(() => subscribeSentLog(reload), [reload]);

  const clearAll = () =>
    dialog.alert(t('sentLog.clearConfirm'), t('sentLog.clearConfirmHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sentLog.clear'),
        style: 'destructive',
        onPress: () =>
          getDb()
            .then((db) => deleteSentSince(db, 0))
            .then(reload)
            .catch(() => {}),
      },
    ]);

  if (open) {
    return (
      <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
        <View style={styles.header}>
          <Pressable onPress={() => setOpen(null)} hitSlop={8} style={styles.side} accessibilityRole="button">
            <View style={styles.backRow}>
              <Icon name="chevronLeft" size={18} color={palette.tintText} />
              <Text style={styles.done}>{t('sentLog.back')}</Text>
            </View>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {t(open === 'instructions' ? 'sentLog.instructions' : 'sentLog.request')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]} accessibilityRole="button">
            <Text style={styles.done}>{t('common.done')}</Text>
          </Pressable>
        </View>
        {open === 'instructions' ? (
          <Instructions customInstructions={customInstructions ?? ''} />
        ) : (
          <RequestDetail entry={open} showCost={showCost} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={MODAL_SCREEN_EDGES}>
      <View style={styles.header}>
        <Pressable
          onPress={clearAll}
          disabled={!entries?.length}
          hitSlop={8}
          style={styles.side}
          accessibilityRole="button"
        >
          <Text style={[styles.clear, !entries?.length && styles.disabled]}>{t('sentLog.clear')}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('sentLog.title')}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} style={[styles.side, styles.right]} accessibilityRole="button">
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <SectionList
        sections={groupByDay(entries ?? [], (e) => e.at)}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.top}>
            <Text style={styles.hint}>{t(viaQutai ? 'sentLog.hintCredits' : features.pro ? 'sentLog.hintPro' : 'sentLog.hint')}</Text>
            {conversation ? (
              <Pressable onPress={() => setOnlyThis(!onlyThis)} hitSlop={6} accessibilityRole="button">
                <Text style={styles.link}>{t(onlyThis ? 'sentLog.showAll' : 'sentLog.showThis')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setOpen('instructions')}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityHint={t('sentLog.instructionsHint')}
            >
              <Text style={styles.cardTitle}>{t('sentLog.instructions')}</Text>
              <Text style={styles.cardText}>{t('sentLog.instructionsHint')}</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={entries ? <Text style={styles.empty}>{t('sentLog.empty')}</Text> : undefined}
        ListFooterComponent={<Text style={styles.footer}>{t('sentLog.footer')}</Text>}
        renderSectionHeader={({ section }) => {
          const total = showCost ? dayTotal(section.data) : null;
          return <Text style={styles.day}>{total ? `${section.title} · ${total}` : section.title}</Text>;
        }}
        renderItem={({ item }) => {
          const chips = chipsOf(item, showCost);
          return (
            <Pressable
              onPress={() => setOpen(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={[
                timeLabel(item.at),
                providerLine(item),
                item.host,
                ...chips,
                item.incognito ? t('sentLog.incognito') : null,
              ]
                .filter(Boolean)
                .join(', ')}
            >
              <Text style={styles.time}>{timeLabel(item.at)}</Text>
              <View style={styles.texts}>
                <Text style={styles.description} numberOfLines={1}>
                  {providerLine(item)}
                </Text>
                <View style={styles.hostRow}>
                  {item.incognito ? <Icon name="incognito" size={13} color={palette.textSecondary} /> : null}
                  <Text style={[styles.host, styles.hostText]} numberOfLines={1}>
                    {item.incognito ? `${t('sentLog.incognito')} · ` : ''}
                    {item.host ?? t('sentLog.noSite')}
                  </Text>
                </View>
                <View style={styles.chips}>
                  {chips.map((chip, i) => (
                    <Text key={i} style={styles.chip}>
                      {chip}
                    </Text>
                  ))}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

function RequestDetail({ entry, showCost }: { entry: SentRequest; showCost: boolean }) {
  const styles = useStyles();
  const palette = usePalette();
  const tokens = Math.round(entry.totalChars / 4);
  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.meta}>
        <Text style={styles.description}>{providerLine(entry)}</Text>
        <Text style={styles.host}>{formatDateTime(new Date(entry.at))}</Text>
        <View style={styles.hostRow}>
          {entry.incognito ? <Icon name="incognito" size={13} color={palette.textSecondary} /> : null}
          <Text style={[styles.host, styles.hostText]}>
            {entry.incognito ? `${t('sentLog.incognito')} · ` : ''}
            {entry.host ?? t('sentLog.noSite')}
          </Text>
        </View>
        {entry.webSearch ? (
          <Text style={styles.host}>{t(entry.research ? 'sentLog.researchHint' : 'sentLog.webSearchHint')}</Text>
        ) : null}
        {entry.provider === 'qutai' ? <Text style={styles.host}>{t('sentLog.viaQutai')}</Text> : null}
      </View>
      <View style={styles.note}>
        <Text style={styles.cardText}>
          {t('sentLog.resent', { count: entry.resentTurns, size: charsLabel(entry.resentChars) })}
        </Text>
        <Text style={styles.cardText}>
          {t('sentLog.total', { size: charsLabel(entry.totalChars), tokens: formatNumber(tokens) })}
          {entry.images ? ` ${t('sentLog.images', { count: entry.images })}` : ''}
        </Text>
      </View>
      {showCost && entry.cost ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{costLine(entry.cost)}</Text>
          <Text style={styles.cardText}>{requestBreakdown(entry.cost)}</Text>
        </View>
      ) : null}
      <Text style={styles.day}>{t('sentLog.newInRequest')}</Text>
      {entry.items.length === 0 ? <Text style={styles.cardText}>{t('sentLog.continuedHint')}</Text> : null}
      {entry.items.map((item, i) => (
        <ItemCard key={i} item={item} content={entry.content?.[i]} kept={!!entry.content} />
      ))}
    </ScrollView>
  );
}

function ItemCard({ item, content, kept }: { item: SentItem; content?: SentContent; kept: boolean }) {
  const styles = useStyles();
  const palette = usePalette();
  const [expanded, setExpanded] = useState(false);
  const title = [itemLabel(item), item.tool, item.host].filter(Boolean).join(' · ');
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.cardTitleRow}>
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} color={palette.text} style={styles.chevron} />
          <Text style={[styles.cardTitle, styles.cardTitleText]}>{title}</Text>
        </View>
      </Pressable>
      {expanded ? <ItemContent item={item} content={content} kept={kept} /> : null}
    </View>
  );
}

function ItemContent({ item, content, kept }: { item: SentItem; content?: SentContent; kept: boolean }) {
  const styles = useStyles();
  if (item.kind === 'location') return <Text style={styles.cardText}>{t('sentLog.locationNotKept')}</Text>;
  if (!kept || !content || (content.text === undefined && !content.images))
    return <Text style={styles.cardText}>{t('sentLog.notKept')}</Text>;
  return (
    <View style={styles.content}>
      {content.images?.map((img, i) => (
        <Thumbnail key={i} image={img} />
      ))}
      {item.imageBytes && !content.images ? <Text style={styles.cardText}>{t('sentLog.imageNotKept')}</Text> : null}
      {content.text !== undefined ? <LongText text={content.text} /> : null}
    </View>
  );
}

function Thumbnail({ image }: { image: ToolImage }) {
  const styles = useStyles();
  return (
    <Image
      source={{ uri: `data:${image.mediaType};base64,${image.data}` }}
      style={styles.thumbnail}
      resizeMode="contain"
      accessible
      accessibilityLabel={t('sentLog.screenshotA11y')}
    />
  );
}

function LongText({ text }: { text: string }) {
  const styles = useStyles();
  const [all, setAll] = useState(false);
  const cut = !all && text.length > PREVIEW_CHARS;
  return (
    <View style={styles.content}>
      <Text style={styles.mono} selectable>
        {cut ? `${text.slice(0, PREVIEW_CHARS)}…` : text}
      </Text>
      {cut ? (
        <Pressable onPress={() => setAll(true)} hitSlop={6} accessibilityRole="button">
          <Text style={styles.link}>{t('sentLog.showAllText', { size: charsLabel(text.length) })}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The fixed part of every request: the instructions and the tool list. */
function Instructions({ customInstructions }: { customInstructions: string }) {
  const styles = useStyles();
  const custom = customInstructionsPrompt(customInstructions).trim();
  const sections: { title: string; text: string }[] = [
    { title: t('sentLog.instructionsBase'), text: SYSTEM_PROMPT },
    { title: t('sentLog.instructionsWebSearch'), text: WEB_SEARCH_PROMPT.trim() },
    { title: t('sentLog.instructionsResearch'), text: RESEARCH_PROMPT.trim() },
    { title: t('sentLog.instructionsLastStep'), text: LAST_STEP_PROMPT.trim() },
    { title: t('sentLog.instructionsTools'), text: JSON.stringify([...TOOLS, ...MEMORY_TOOLS], null, 2) },
    // Sent with every request while set; shown here once instead of in each entry.
    ...(custom ? [{ title: t('sentLog.instructionsCustom'), text: custom }] : []),
  ];
  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Text style={styles.hint}>{t('sentLog.instructionsIntro')}</Text>
      {sections.map((s) => (
        <Section key={s.title} title={s.title} text={s.text} />
      ))}
    </ScrollView>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  const styles = useStyles();
  const palette = usePalette();
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.cardTitleRow}>
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} color={palette.text} style={styles.chevron} />
          <Text style={[styles.cardTitle, styles.cardTitleText]}>
            {title} · {charsLabel(text.length)}
          </Text>
        </View>
      </Pressable>
      {expanded ? <LongText text={text} /> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  side: { flex: 1 },
  right: { alignItems: 'flex-end' },
  title: { color: c.text, fontSize: 17, fontWeight: '600', flexShrink: 1 },
  clear: { fontSize: 15, color: c.danger },
  done: { fontSize: 16, color: c.tintText, fontWeight: '600' },
  disabled: { opacity: 0.35 },
  list: { padding: 16, gap: 2 },
  top: { gap: 10, marginBottom: 4 },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  link: { fontSize: 14, color: c.tintText, fontWeight: '600' },
  empty: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginTop: 32 },
  footer: { fontSize: 12, color: c.textSecondary, lineHeight: 17, marginTop: 20 },
  day: { fontSize: 13, fontWeight: '700', color: c.textSecondary, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderRadius: 8 },
  pressed: { backgroundColor: c.pressed },
  time: { width: 44, fontSize: 12, color: c.textSecondary, marginTop: 2 },
  texts: { flex: 1, gap: 2 },
  description: { fontSize: 14, color: c.text, fontWeight: '600' },
  host: { fontSize: 12, color: c.textSecondary },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hostText: { flexShrink: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  chip: {
    fontSize: 12,
    color: c.text,
    backgroundColor: c.sunken,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  meta: { gap: 3, marginBottom: 10 },
  note: { backgroundColor: c.sunken, borderRadius: 10, padding: 12, gap: 6 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 12,
    gap: 8,
    marginTop: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: c.text },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  cardTitleText: { flex: 1 },
  chevron: { marginTop: 2 },
  cardText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  content: { gap: 8 },
  mono: { fontFamily: MONO, fontSize: 12, lineHeight: 17, color: c.text },
  thumbnail: { width: 180, height: 320, borderRadius: 6, backgroundColor: c.sunken },
}));
