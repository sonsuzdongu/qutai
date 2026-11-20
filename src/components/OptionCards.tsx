import { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { cachedCardImage, cardImageAllowed, loadCardImage } from '../chat/cardImages';
import { cardLabel, type OptionCard } from '../chat/optionCards';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { siteColor } from '../ui/siteColor';
import { usePalette } from '../ui/theme';
import { useReduceMotion } from '../utils/useReduceMotion';

/**
 * The assistant's options as cards (show_options; UI-23 to UI-26 in docs/design/27-interface.md), in the chat panel and in
 * the answer card over the page. A horizontal row: at phone width two cards and the edge of a third show, so the row
 * reads as something to swipe; on a wide panel or in landscape more fit.
 *
 * Everything shown is plain text from the checked card (chat/optionCards.ts); the site under the title is the link's
 * own host. A tap opens the link like a link in the chat (in the tab's group); a long press offers the chat link menu
 * (open in new tab, copy link, share). Pictures load through chat/cardImages.ts (no cookies, size and format checked);
 * while one loads its place shimmers (still with reduce motion), and a picture that fails or isn't allowed becomes the
 * site's letter on its colour, so no card has a hole. In an incognito conversation pictures wait for "Show images".
 */
export const OptionCards = memo(function OptionCards({
  cards,
  imagesOnTap = false,
  compact = false,
  dark = false,
  onOpen,
  onMenu,
}: {
  cards: OptionCard[];
  /** Incognito: pictures load only after "Show images" (for this answer, while the app runs). */
  imagesOnTap?: boolean;
  /** Smaller cards, for the answer card over the page. */
  compact?: boolean;
  /** The assistant panel's dark look (its own colours rather than the theme's). */
  dark?: boolean;
  onOpen: (card: OptionCard) => void;
  onMenu: (card: OptionCard) => void;
}) {
  const colors = useCardColors(dark);
  const { fontScale } = useWindowDimensions();
  const [revealed, setRevealed] = useState(false);
  // Wider cards for larger text, so titles don't become one word per line.
  const scale = Math.min(Math.max(fontScale, 1), 1.6);
  // At phone width two cards and the edge of a third show, so the row reads as one to swipe.
  const width = Math.round((compact ? 132 : 142) * scale);
  const pictures = cards.some((c) => c.image);
  const showPictures = pictures && (!imagesOnTap || revealed);
  const imageHeight = pictures ? Math.round(width * (compact ? 0.72 : 0.82)) : 0;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      {pictures && imagesOnTap && !revealed ? (
        <Pressable
          onPress={() => setRevealed(true)}
          style={({ pressed }) => [styles.reveal, pressed && styles.revealPressed]}
          accessibilityRole="button"
          accessibilityHint={t('cards.showImagesHint')}
          hitSlop={6}
        >
          <Icon name="image" size={15} color={colors.tint} />
          <Text style={styles.revealText}>{t('cards.showImages')}</Text>
        </Pressable>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel={t('cards.rowLabel', { count: cards.length })}
      >
        {cards.map((card) => (
          <Card
            key={card.url}
            card={card}
            width={width}
            imageHeight={imageHeight}
            loadImage={showPictures}
            colors={colors}
            styles={styles}
            onOpen={onOpen}
            onMenu={onMenu}
          />
        ))}
      </ScrollView>
    </View>
  );
});

type Colors = ReturnType<typeof useCardColors>;
type Styles = ReturnType<typeof makeStyles>;

function Card({
  card,
  width,
  imageHeight,
  loadImage,
  colors,
  styles,
  onOpen,
  onMenu,
}: {
  card: OptionCard;
  width: number;
  imageHeight: number;
  loadImage: boolean;
  colors: Colors;
  styles: Styles;
  onOpen: (card: OptionCard) => void;
  onMenu: (card: OptionCard) => void;
}) {
  const reduceMotion = useReduceMotion();
  const [pressed] = useState(() => new Animated.Value(0));
  const press = (to: number) => {
    if (reduceMotion) return pressed.setValue(0);
    Animated.timing(pressed, { toValue: to, duration: to ? 80 : 140, useNativeDriver: true }).start();
  };
  return (
    <Animated.View style={{ width, transform: [{ scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] }}>
      <Pressable
        onPress={() => onOpen(card)}
        onLongPress={() => onMenu(card)}
        onPressIn={() => press(1)}
        onPressOut={() => press(0)}
        style={({ pressed: down }) => [styles.card, down && styles.cardPressed]}
        accessibilityRole="link"
        accessibilityLabel={cardLabel(card)}
        accessibilityHint={t('cards.openHint')}
        accessibilityActions={[{ name: 'longpress', label: t('chat.moreActions') }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && onMenu(card)}
      >
        {imageHeight ? (
          <CardPicture card={card} height={imageHeight} load={loadImage} colors={colors} styles={styles} />
        ) : null}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          {card.price ? (
            <Text style={styles.price} numberOfLines={1}>
              {card.price}
            </Text>
          ) : null}
          {card.detail ? (
            <Text style={styles.detail} numberOfLines={2}>
              {card.detail}
            </Text>
          ) : null}
          <View style={styles.siteRow}>
            <View style={[styles.siteDot, { backgroundColor: siteColor(card.host) }]} />
            <Text style={styles.site} numberOfLines={1}>
              {card.host}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CardPicture({
  card,
  height,
  load,
  colors,
  styles,
}: {
  card: OptionCard;
  height: number;
  load: boolean;
  colors: Colors;
  styles: Styles;
}) {
  const allowed = !!card.image && cardImageAllowed(card.image);
  const [uri, setUri] = useState<string | null | undefined>(() => (card.image ? cachedCardImage(card.image) : null));
  const [decoded, setDecoded] = useState(false);
  useEffect(() => {
    if (!load || !card.image || !allowed || uri !== undefined) return;
    let alive = true;
    loadCardImage(card.image).then((result) => alive && setUri(result));
    return () => {
      alive = false;
    };
  }, [load, card.image, allowed, uri]);

  const failed = !card.image || !allowed || uri === null;
  const waiting = !failed && (!load || uri === undefined || !decoded);
  return (
    <View style={[styles.picture, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {failed ? (
        // The site's letter in a badge of its colour on a soft tile: a designed card instead of a hole.
        <View style={styles.monogram}>
          <View style={[styles.monogramBadge, { backgroundColor: siteColor(card.host) }]}>
            <Text style={styles.monogramText} allowFontScaling={false}>
              {(card.host.replace(/^xn--/, '')[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        </View>
      ) : null}
      {!failed && waiting ? <Skeleton active={load} colors={colors} /> : null}
      {/* Only once allowed: a picture already in memory from another answer still waits for "Show images". */}
      {!failed && load && typeof uri === 'string' ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, !decoded && styles.hidden]}
          resizeMode="cover"
          onLoad={() => setDecoded(true)}
          onError={() => setUri(null)}
          fadeDuration={0}
        />
      ) : null}
    </View>
  );
}

/** A soft pulse where a picture is coming (a still block with reduce motion, or before "Show images"). */
function Skeleton({ active, colors }: { active: boolean; colors: Colors }) {
  const reduceMotion = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduceMotion) return pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, reduceMotion, pulse]);
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.well, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
      ]}
    >
      <View style={skeletonStyles.center}>
        <Icon name="image" size={22} color={colors.faint} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

function useCardColors(dark: boolean) {
  const p = usePalette();
  return useMemo(
    () =>
      dark
        ? {
            surface: '#2b2a33',
            border: '#3a3944',
            text: '#f2f1f5',
            dim: '#a9a8b3',
            faint: '#5d5c68',
            well: '#35343e',
            pressed: '#3a3944',
            tint: '#8ab4f8',
            price: '#f2f1f5',
            shadow: 0,
          }
        : {
            surface: p.surface,
            border: p.dark ? p.border : p.separator,
            text: p.text,
            dim: p.textSecondary,
            faint: p.dark ? '#5d5c68' : '#c9c5bb',
            well: p.sunken,
            pressed: p.pressed,
            tint: p.tintText,
            price: p.text,
            shadow: p.dark ? 0 : 0.06,
          },
    [dark, p],
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { alignSelf: 'stretch', gap: 8 },
    row: { gap: 10, paddingRight: 12, paddingBottom: 4, alignItems: 'stretch' },
    card: {
      flex: 1,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: c.shadow,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    cardPressed: { backgroundColor: c.pressed },
    picture: { backgroundColor: c.well, overflow: 'hidden' },
    hidden: { opacity: 0 },
    monogram: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    monogramBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    monogramText: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
    body: { flex: 1, paddingHorizontal: 11, paddingTop: 9, paddingBottom: 10, gap: 3 },
    title: { color: c.text, fontSize: 14, lineHeight: 18, fontWeight: '600' },
    price: { color: c.price, fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 1 },
    detail: { color: c.dim, fontSize: 12, lineHeight: 16 },
    // Pushed to the bottom, so the sites line up across cards of different heights.
    siteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 'auto', paddingTop: 4 },
    siteDot: { width: 8, height: 8, borderRadius: 4 },
    site: { color: c.dim, fontSize: 12, flexShrink: 1 },
    reveal: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.tint,
      minHeight: 34,
    },
    revealPressed: { opacity: 0.7 },
    revealText: { color: c.tint, fontSize: 14, fontWeight: '600' },
  });
}
