import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { makeStyles, radii } from '../ui/theme';
import { useKeyboardHeight } from '../utils/useKeyboardHeight';
import { DialogHost } from './Dialog';

/**
 * Safe areas inside Modals, kept in one place.
 *
 * On Android, React Native draws every Modal edge to edge once the app is (Expo apps always are):
 * the Modal's window starts under the status bar and ends under the navigation bar, whatever
 * statusBarTranslucent / navigationBarTranslucent say, and presentationStyle is iOS-only, so a
 * "pageSheet" screen is a full-screen window there. So every Modal pads itself by the insets:
 * the bottom sheets below, and the Modal screens through MODAL_SCREEN_EDGES.
 */

/** Gap kept between a full-height sheet and the status bar, so the page still shows above it. */
const TOP_GAP = 12;

/**
 * Edges for the SafeAreaView of a pageSheet Modal screen: an iOS page sheet already starts below
 * the status bar, while on Android the same Modal covers the whole screen and needs the top too.
 */
export const MODAL_SCREEN_EDGES: Edge[] =
  Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right'];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** The sheet itself: background and top padding (left and right padding come from the insets). */
  style?: StyleProp<ViewStyle>;
  /** Layout of the scrolling content: horizontal padding, gap, alignment. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Space under the content, above the navigation bar or home indicator. */
  bottomPadding?: number;
  /** The sheet has gone from the screen (iOS: its modal is dismissed; see ActionSheet's afterClose). */
  onDismiss?: () => void;
  children: ReactNode;
};

/**
 * A sheet that slides up from the bottom over a dimmed page.
 *
 * The rule for every sheet: the backdrop covers the whole screen, behind the system bars too; the
 * sheet's background runs under the navigation bar / home indicator with its content above it,
 * keeps clear of a landscape notch, and never grows past the status bar (or the keyboard) — its
 * content scrolls instead, at any font size.
 */
export function BottomSheet({ visible, onClose, style, contentStyle, bottomPadding = 8, onDismiss, children }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <AppModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityLabel={t('common.close')}
      />
      {/* Never closer to the top than the status bar plus a gap; the sheet below shrinks and scrolls instead. */}
      <View style={[styles.gap, { minHeight: insets.top + TOP_GAP }]} pointerEvents="none" />
      <View
        style={[
          styles.sheet,
          style,
          {
            paddingBottom: Math.max(insets.bottom, keyboard) + bottomPadding,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={contentStyle}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
      <DialogHost />
    </AppModal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { backgroundColor: c.backdrop },
  gap: { flex: 1 },
  sheet: {
    flexShrink: 1,
    // On a tablet the sheet stays phone-sized in the middle, over the dimmed page.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: c.bg,
    borderTopLeftRadius: radii.window,
    borderTopRightRadius: radii.window,
  },
  scroll: { flexGrow: 0 },
}));
