import { type ComponentRef, memo, useEffect, useRef, useState } from 'react';
import { Image, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Browser, useBrowser } from '../browser/Browser';
import type { Tab } from '../browser/Tab';
import { t } from '../i18n';
import { hostOf } from '../i18n/format';
import { useSiteIcon } from '../storage/siteIcons';
import { Icon } from '../ui/Icon';
import { siteColor } from '../ui/siteColor';
import { STRIP_TAB_MIN, stripItems, stripTabWidth } from '../ui/tabStrip';
import { makeStyles, radii, usePalette, darkPalette } from '../ui/theme';

/** Text in the strip grows with the system's text size up to this, like the address bar under it. */
const MAX_FONT_SCALE = 1.4;
/** Room kept for the + button at the end. */
const NEW_TAB_ROOM = 48;

/**
 * The desktop-style tab strip above the top address bar in wide windows (UI-74 in docs/design/27-interface.md): the
 * tabs of the current kind (normal or incognito) in order, the active one joined to the bar, × to close, + for a new
 * tab, group labels that fold a group, scrolling sideways when they don't fit. When it shows is decided in
 * src/ui/tabStrip.ts; phones never get it.
 */
export function TabStrip({
  browser,
  width,
  darkMode,
  onCloseTab,
  onNewTab,
  onHeight,
}: {
  browser: Browser;
  /** The room across, between the side safe areas. */
  width: number;
  darkMode: boolean;
  onCloseTab: (tab: Tab) => void;
  onNewTab: (incognito: boolean) => void;
  onHeight?: (height: number) => void;
}) {
  useBrowser(browser);
  const incognito = browser.active.incognito;
  const styles = useStyles(incognito || darkMode);
  const system = usePalette();
  const palette = incognito || darkMode ? darkPalette : system;
  const tabs = browser.tabsOf(incognito);
  const items = stripItems(tabs, browser.groups, browser.activeId);
  const tabWidth = stripTabWidth(width - NEW_TAB_ROOM, items.filter((i) => i.kind === 'tab').length);

  // Keeps the active tab in view when it changes (a new tab, a switch from the switcher or the bar's swipe).
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const frames = useRef(new Map<string, { x: number; w: number }>());
  const viewport = useRef({ x: 0, w: width });
  const activeId = browser.activeId;
  useEffect(() => {
    const frame = frames.current.get(`tab-${activeId}`);
    if (!frame) return;
    const { x, w } = viewport.current;
    if (frame.x < x) scroll.current?.scrollTo({ x: frame.x, animated: true });
    else if (frame.x + frame.w > x + w)
      scroll.current?.scrollTo({
        x: frame.x + frame.w - w + NEW_TAB_ROOM,
        animated: true,
      });
  }, [activeId, tabs.length]);
  const remember = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width: w } = e.nativeEvent.layout;
    frames.current.set(key, { x, w });
  };

  return (
    <View
      style={styles.strip}
      onLayout={(e) => onHeight?.(Math.round(e.nativeEvent.layout.height))}
      accessibilityRole="tablist"
      accessibilityLabel={t(incognito ? 'tabStrip.incognitoLabel' : 'tabStrip.label')}
    >
      {incognito ? (
        <View style={styles.incognitoMark} importantForAccessibility="no" accessibilityElementsHidden>
          <Icon name="incognito" size={16} color={palette.text} />
        </View>
      ) : null}
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.flex}
        contentContainerStyle={styles.content}
        scrollEventThrottle={64}
        onScroll={(e) => {
          viewport.current = {
            x: e.nativeEvent.contentOffset.x,
            w: e.nativeEvent.layoutMeasurement.width,
          };
        }}
        onLayout={(e) => {
          viewport.current = {
            ...viewport.current,
            w: e.nativeEvent.layout.width,
          };
        }}
      >
        {items.map((item) => {
          if (item.kind === 'group') {
            return (
              <Pressable
                key={item.key}
                onLayout={remember(item.key)}
                onPress={() => browser.toggleGroup(item.groupId)}
                style={({ pressed }) => [styles.group, { borderColor: item.color }, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t('tabStrip.groupA11y', {
                  name: item.name,
                })}
                accessibilityState={{ expanded: !item.collapsed }}
              >
                <Text
                  style={[styles.groupName, { color: item.color }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                >
                  {item.name}
                </Text>
                {item.collapsed ? (
                  <Text style={[styles.groupCount, { color: item.color }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {item.count}
                  </Text>
                ) : null}
              </Pressable>
            );
          }
          const tab = browser.getTab(item.tabId);
          if (!tab) return null;
          return (
            <View key={item.key} onLayout={remember(item.key)}>
              <StripTab
                tab={tab}
                title={tab.title}
                url={tab.url}
                newTab={tab.isNewTab}
                audible={tab.playback.audible}
                active={item.active}
                groupColor={item.groupColor}
                width={tabWidth}
                dark={incognito || darkMode}
                onPress={() => browser.switchTab(tab.id)}
                onClose={() => onCloseTab(tab)}
              />
            </View>
          );
        })}
        <Pressable
          onPress={() => onNewTab(incognito)}
          style={({ pressed }) => [styles.newTab, pressed && styles.pressed]}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t(incognito ? 'menu.newIncognitoTab' : 'menu.newTab')}
        >
          <Icon name="newTab" size={18} color={palette.text} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** One tab; redraws only when what it shows changes (the strip redraws with every change in the browser). */
const StripTab = memo(function StripTab({
  tab,
  title,
  url,
  newTab,
  audible,
  active,
  groupColor,
  width,
  dark,
  onPress,
  onClose,
}: {
  tab: Tab;
  title: string;
  url: string;
  newTab: boolean;
  audible: boolean;
  active: boolean;
  groupColor: string | null;
  width: number;
  dark: boolean;
  onPress: () => void;
  onClose: () => void;
}) {
  const styles = useStyles(dark);
  const system = usePalette();
  const palette = dark ? darkPalette : system;
  const host = newTab ? '' : hostOf(url);
  const label = title || host || t('menu.newTab');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        { width: Math.max(STRIP_TAB_MIN, width) },
        active ? styles.activeTab : pressed && styles.pressed,
      ]}
      accessibilityRole="tab"
      accessibilityLabel={t('tabs.tabA11y', { title: label })}
      accessibilityState={{ selected: active }}
    >
      {newTab ? (
        <View style={styles.icon}>
          <Icon name="newTab" size={14} color={palette.textSecondary} />
        </View>
      ) : (
        <SiteIcon host={host} dark={dark} />
      )}
      <Text
        style={[styles.title, active && styles.activeTitle]}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      >
        {label}
      </Text>
      {audible ? (
        <Pressable
          onPress={() => tab.playback.command('pause')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.playingPause')}
        >
          <Icon name="readAloud" size={14} color={palette.tintText} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onClose}
        hitSlop={6}
        style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
        accessibilityRole="button"
        accessibilityLabel={t('tabStrip.closeNamed', { title: label })}
      >
        <Icon name="close" size={12} color={palette.textSecondary} />
      </Pressable>
      {groupColor ? <View style={[styles.groupLine, { backgroundColor: groupColor }]} /> : null}
    </Pressable>
  );
});

/** The site's icon kept on the phone (UI-72; never fetched from here), else its coloured letter (UI-18). */
function SiteIcon({ host, dark }: { host: string; dark: boolean }) {
  const styles = useStyles(dark);
  const uri = useSiteIcon(host);
  const [failed, setFailed] = useState<string | null>(null);
  if (uri && failed !== uri) {
    return (
      <View style={[styles.icon, styles.iconTile]}>
        <Image
          source={{ uri }}
          style={styles.iconImage}
          resizeMode="contain"
          onError={() => setFailed(uri)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  return (
    <View style={[styles.icon, { backgroundColor: siteColor(host) }]}>
      <Text style={styles.letter} maxFontSizeMultiplier={1}>
        {(host[0] || '?').toUpperCase()}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  // A shade under the bar's own colour, so the active tab (in the bar's colour) reads as part of the bar.
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: c.sunken,
    paddingTop: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    gap: 2,
  },
  incognitoMark: { justifyContent: 'center', paddingLeft: 10, paddingRight: 2 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 34,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    borderTopLeftRadius: radii.control,
    borderTopRightRadius: radii.control,
  },
  activeTab: { backgroundColor: c.chrome },
  pressed: { backgroundColor: c.pressed },
  title: { flex: 1, fontSize: 13, color: c.textSecondary },
  activeTitle: { color: c.text, fontWeight: '600' },
  icon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // White in both themes (onTint), as on the new tab page: most icons are drawn for a light tab strip.
  iconTile: { backgroundColor: c.onTint },
  iconImage: { width: 16, height: 16 },
  letter: { color: c.onTint, fontSize: 11, fontWeight: '700' },
  close: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { backgroundColor: c.border },
  groupLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    maxWidth: 160,
    marginHorizontal: 4,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  groupName: { fontSize: 12, fontWeight: '700' },
  groupCount: { fontSize: 12, fontWeight: '600' },
  newTab: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginLeft: 4,
  },
}));
