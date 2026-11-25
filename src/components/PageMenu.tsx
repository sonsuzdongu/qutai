import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { useKeyboardHeight } from '../utils/useKeyboardHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { Icon, IconName } from '../ui/Icon';
import { darkPalette, lightPalette, makeStyles, radii } from '../ui/theme';
import { DialogHost } from './Dialog';
import { menuFrame, menuScrolls, menuWidth } from './menuFrame';
import { WholeWordsText } from './WholeWordsText';

export type MenuItem = {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Draws a separator above this item. */
  section?: boolean;
  /** Shows a check mark, for on/off options like the desktop site. */
  checked?: boolean;
  /** Opens these items in place of the list (with a way back) instead of running onPress. */
  submenu?: MenuItem[];
};

export type IconItem = { icon: IconName; label: string; onPress: () => void; disabled?: boolean; active?: boolean };

type Props = {
  visible: boolean;
  /** Compact icon buttons along the top, like Chrome's forward / bookmark / reload row. */
  iconRow?: IconItem[];
  items: MenuItem[];
  incognito: boolean;
  darkMode?: boolean;
  /** Where the address bar with the ⋮ button is: the menu opens next to it, above it when it is at the bottom. */
  anchor?: 'top' | 'bottom';
  /** Extra room above a top bar: the tab strip's height in a wide window (UI-74). */
  topOffset?: number;
  onClose: () => void;
};

/** Overflow menu anchored at the ⋮ button, like the Chrome page menu. */
export function PageMenu({ visible, iconRow, items, incognito, darkMode, anchor = 'top', topOffset = 0, onClose }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  // The room between the bars (menuFrame.ts); long menus scroll inside it (short screens, large text), the icon row
  // stays on top.
  const frame = menuFrame(insets.top + topOffset, insets.bottom, keyboard, anchor);
  const theme = incognito || darkMode ? dark : light;
  const palette = incognito || darkMode ? darkPalette : lightPalette;
  // An open submenu ("Library", "More"); it starts over each time the menu opens.
  const [sub, setSub] = useState<MenuItem | null>(null);
  const close = () => {
    setSub(null);
    onClose();
  };
  const shown = sub?.submenu ?? items;
  // The list's content and its own height: it scrolls only when the content is really taller (menuFrame.ts).
  const [listContent, setListContent] = useState<number | null>(null);
  const [listHeight, setListHeight] = useState<number | null>(null);

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => (sub ? setSub(null) : close())}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        style={StyleSheet.absoluteFill}
        onPress={close}
        accessibilityLabel={t('menu.close')}
      />
      {/* The room between the bars; taps outside the menu go through it to the backdrop. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.room,
          { top: frame.top, bottom: frame.bottom, justifyContent: frame.justify, right: insets.right + 8 },
        ]}
      >
        <View style={[styles.menu, theme.menu, { width: menuWidth(width, insets.left, insets.right) }]}>
          {iconRow && iconRow.length > 0 && (
            <View style={[styles.iconRow, theme.separator]}>
              {iconRow.map((item) => (
                <Pressable
                  key={item.label}
                  disabled={item.disabled}
                  onPress={() => {
                    close();
                    item.onPress();
                  }}
                  style={({ pressed }) => [styles.iconButton, pressed && theme.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ disabled: item.disabled }}
                >
                  <Icon
                    name={item.icon}
                    size={22}
                    color={item.active ? palette.tintText : palette.text}
                    style={item.disabled ? styles.disabled : undefined}
                  />
                </Pressable>
              ))}
            </View>
          )}
          <ScrollView
            style={styles.list}
            bounces={false}
            overScrollMode="never"
            scrollEnabled={menuScrolls(listContent, listHeight)}
            onContentSizeChange={(_, h) => setListContent(h)}
            onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
          >
            {sub && (
              <Pressable
                onPress={() => setSub(null)}
                style={({ pressed }) => [
                  styles.item,
                  styles.subHeader,
                  { borderBottomColor: palette.separator },
                  pressed && theme.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('menu.backTo')}
              >
                <Icon name="back" size={20} color={palette.textSecondary} />
                <WholeWordsText style={[styles.label, styles.labelFlex, styles.subTitle, theme.text]}>{sub.label}</WholeWordsText>
              </Pressable>
            )}
            {shown.map((item) => (
              <View key={item.label}>
                {item.section && <View style={[styles.separator, theme.separator]} />}
                <Pressable
                  disabled={item.disabled}
                  onPress={() => {
                    if (item.submenu) return setSub(item);
                    close();
                    item.onPress();
                  }}
                  style={({ pressed }) => [styles.item, pressed && theme.pressed]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ disabled: item.disabled }}
                >
                  <Icon
                    name={item.icon}
                    size={20}
                    color={palette.textSecondary}
                    style={item.disabled ? styles.disabled : undefined}
                  />
                  <WholeWordsText style={[styles.label, styles.labelFlex, theme.text, item.disabled && styles.disabled]}>
                    {item.label}
                  </WholeWordsText>
                  {item.checked && <Icon name="check" size={20} color={palette.tintText} />}
                  {item.submenu && <Icon name="chevronRight" size={20} color={palette.textSecondary} />}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
      <DialogHost />
    </AppModal>
  );
}

const useStyles = makeStyles((c) => ({
  // Spans the modal's width; the menu sits at its right end.
  room: { position: 'absolute', left: 0, alignItems: 'flex-end' },
  menu: {
    flexShrink: 1,
    paddingVertical: 6,
    borderRadius: radii.popover,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  label: { fontSize: 15 },
  labelFlex: { flex: 1 },
  subHeader: { borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  subTitle: { fontWeight: '700' },
  disabled: { opacity: 0.35 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  list: { flexGrow: 0, flexShrink: 1 },
  iconRow: {
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 2,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.separator,
  },
  iconButton: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.control },
}));

const light = StyleSheet.create({
  menu: { backgroundColor: '#fff' },
  text: { color: '#222' },
  pressed: { backgroundColor: '#f1efe8' },
  separator: { backgroundColor: '#e0ddd4' },
});

const dark = StyleSheet.create({
  menu: { backgroundColor: '#2b2a33' },
  text: { color: '#f2f1f5' },
  pressed: { backgroundColor: '#3a3944' },
  separator: { backgroundColor: '#42414d' },
});
