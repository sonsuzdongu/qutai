import {
  ComponentRef,
  createContext,
  ReactNode,
  Ref,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { useKeyboardHeight } from '../utils/useKeyboardHeight';

/**
 * Keeping text fields clear of the on-screen keyboard, in one place.
 *
 * Expo apps on Android are edge to edge, so the window no longer resizes for the keyboard (even with the
 * default softwareKeyboardLayoutMode, resize) and a screen that does nothing stays under it. React Native's
 * KeyboardAvoidingView only gets it right when it starts at the top of the window (it compares its
 * layout, which is relative to its parent, with the keyboard's position on screen), so these measure
 * where they really are and leave room for exactly the part the keyboard covers. Full-window sheets and
 * dialogs (BottomSheet, Dialog) pad by useKeyboardHeight directly.
 */

/** Room kept under a focused field, and above it for its label. */
const BELOW_FIELD = 24;
const ABOVE_FIELD = 40;
/** Less scrolling room than this above a pinned footer, and the footer goes into the scrolling content. */
const MIN_SCROLL_ROOM = 160;

/** The view's own bottom padding, already space the keyboard may cover (the navigation bar inset, say). */
function bottomPadding(style: StyleProp<ViewStyle>) {
  const flat = StyleSheet.flatten(style) ?? {};
  const padding = flat.paddingBottom ?? flat.paddingVertical ?? flat.padding;
  return typeof padding === 'number' ? padding : 0;
}

/**
 * How much of this view's content the keyboard covers (beyond the view's own bottom padding, which it may
 * cover freely), and how much of the view is left above the keyboard.
 */
function useKeyboardOverlap(style: StyleProp<ViewStyle>) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  const [frame, setFrame] = useState<{ top: number; bottom: number } | null>(null);
  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x, y, _width, height) => setFrame({ top: y, bottom: y + height }));
  }, []);
  // A sheet may still have been sliding in when it was laid out; measure again whenever the keyboard moves.
  useEffect(() => {
    if (keyboard) measure();
  }, [keyboard, measure]);
  const keyboardTop = windowHeight - keyboard;
  const overlap = keyboard && frame ? Math.max(0, Math.round(frame.bottom - keyboardTop - bottomPadding(style))) : 0;
  const room = keyboard && frame ? Math.max(0, keyboardTop - frame.top) : Infinity;
  return { ref, measure, overlap, room, keyboard };
}

/**
 * A view whose content stays above the keyboard: it keeps its size and leaves an empty band at its
 * bottom as tall as the part of it the keyboard covers, so its children (laid out in a column) shrink
 * into the space above. For a screen whose input sits under a list or page, such as the address bar
 * at the bottom or the assistant's message field.
 */
export function KeyboardAvoidingContainer({ children, onLayout, style, ...props }: ViewProps) {
  const { ref, measure, overlap } = useKeyboardOverlap(style);
  return (
    <View
      {...props}
      style={style}
      ref={ref}
      onLayout={(e) => {
        measure();
        onLayout?.(e);
      }}
    >
      {children}
      {overlap > 0 && <View style={{ height: overlap }} />}
    </View>
  );
}

const RevealContext = createContext<(() => void) | null>(null);

/**
 * For a field focused from code (the keyboard's Next button): scrolls the KeyboardAwareScrollView around
 * it so the field shows. Taps and the keyboard opening are handled without it.
 */
export function useRevealFocused() {
  return useContext(RevealContext);
}

type Props = ScrollViewProps & {
  ref?: Ref<ComponentRef<typeof ScrollView>>;
  /**
   * Buttons under the scrolling content (Continue, Skip). They stay above the keyboard while it is open,
   * unless that would leave too little room to scroll (a small screen, large text): then they come at
   * the end of the content, reached by scrolling, without closing the keyboard.
   */
  footer?: ReactNode;
  /** The view around the scroll view and its footer (flex: 1 unless given). */
  containerStyle?: StyleProp<ViewStyle>;
};

/**
 * A scroll view for a form: its content and footer stay above the keyboard, and the focused field
 * scrolls into view with its label and some room under it. A field that already shows is left where it
 * is, so moving between fields with the keyboard open does not make the page jump. Tapping outside a
 * field (not on a button) closes the keyboard.
 */
export function KeyboardAwareScrollView({
  ref,
  footer,
  containerStyle,
  children,
  onScroll,
  onLayout,
  keyboardShouldPersistTaps = 'handled',
  ...props
}: Props) {
  const outerStyle = containerStyle ?? styles.flex;
  const { ref: containerRef, measure, overlap, room, keyboard } = useKeyboardOverlap(outerStyle);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const viewHeight = useRef(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const footerInline = !!footer && keyboard > 0 && room - footerHeight < MIN_SCROLL_ROOM;

  const reveal = useCallback(() => {
    const scroll = scrollRef.current;
    const input = TextInput.State.currentlyFocusedInput();
    const content = scroll?.getInnerViewRef();
    if (!scroll || !input || !content || !Keyboard.isVisible()) return;
    // Fails (and leaves things alone) for a field outside this scroll view.
    input.measureLayout(
      content,
      (_x, y, _width, height) => {
        const top = offset.current;
        const visible = viewHeight.current;
        let target = top;
        if (y + height + BELOW_FIELD > top + visible) target = y + height + BELOW_FIELD - visible;
        // A field taller than the room left (a long multiline one) shows from its top.
        if (y - ABOVE_FIELD < target) target = y - ABOVE_FIELD;
        target = Math.max(0, Math.round(target));
        if (Math.abs(target - top) > 1) scroll.scrollTo({ y: target, animated: true });
      },
      () => {},
    );
  }, []);
  // After the layout settles (the band under the content is drawn in the same frame as the keyboard event).
  const revealSoon = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(reveal));
  }, [reveal]);

  useEffect(() => {
    // iOS also sends this when focus moves to another field with the keyboard already open.
    const subscription = Keyboard.addListener('keyboardDidShow', revealSoon);
    return () => subscription.remove();
  }, [revealSoon]);

  const setRefs = (node: ComponentRef<typeof ScrollView> | null) => {
    scrollRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  const footerView = footer ? (
    <View onLayout={(e: LayoutChangeEvent) => setFooterHeight(e.nativeEvent.layout.height)}>{footer}</View>
  ) : null;

  return (
    <RevealContext.Provider value={revealSoon}>
      <View ref={containerRef} style={outerStyle} onLayout={measure}>
        <ScrollView
          {...props}
          ref={setRefs}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          scrollEventThrottle={props.scrollEventThrottle ?? 16}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            offset.current = e.nativeEvent.contentOffset.y;
            onScroll?.(e);
          }}
          onLayout={(e) => {
            const resized = Math.abs(e.nativeEvent.layout.height - viewHeight.current) > 1;
            viewHeight.current = e.nativeEvent.layout.height;
            // Shrunk for the keyboard: bring the field back into view.
            if (resized) revealSoon();
            onLayout?.(e);
          }}
          // A tap on a field (or next to one) with the keyboard open.
          onTouchEnd={(e) => {
            if (keyboard) setTimeout(revealSoon, 50);
            props.onTouchEnd?.(e);
          }}
        >
          {children}
          {footerInline && footerView}
        </ScrollView>
        {!footerInline && footerView}
        {overlap > 0 && <View style={{ height: overlap }} />}
      </View>
    </RevealContext.Provider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
