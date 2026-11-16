import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityActionEvent,
  Animated,
  AppState,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import type { DownloadItem, DownloadStore } from '../storage/downloads';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette } from '../ui/theme';
import { useScreenReader } from './useHoldGesture';

/** "42%" when the size is known, else the bytes so far ("3.1 MB"), or "" before anything arrived. */
export function downloadProgressLabel(a: DownloadItem): string {
  if (a.total) return `${Math.min(100, Math.floor((a.received / a.total) * 100))}%`;
  return a.received > 0 ? formatBytes(a.received) : '';
}

/** 0…1 when the size is known, else null (an indeterminate bar). */
export function downloadFraction(a: DownloadItem): number | null {
  return a.total ? Math.min(1, a.received / a.total) : null;
}

type Props = {
  store: DownloadStore;
  /** Distance from the bottom safe area (above a bottom address bar). */
  bottomOffset: number;
  /** Opens the Downloads screen. */
  onOpen: () => void;
  /** "Open" on a download that just finished. */
  onOpenFile: (item: DownloadItem) => void;
};

/** How long the "finished" pill stays (longer with a screen reader, to reach its buttons). */
const FINISHED_MS = 6000;
const FINISHED_SCREEN_READER_MS = 15000;
/** A sideways swipe this far (or this fast) hides the pill. */
const SWIPE_DISTANCE = 72;
const SWIPE_VELOCITY = 0.6;

const running = (a: DownloadItem) => a.state === 'downloading' || a.state === 'queued' || a.state === 'waiting';

/**
 * A small pill over the page for downloads (both platforms). While files download: the newest one's name and
 * progress, how many more are running; a tap opens the Downloads screen. When one finishes or fails while Qutai is on
 * screen: "Downloaded: name" with Open (or "Couldn't download"), gone by itself after a few seconds.
 *
 * Always dismissible: the close button, a sideways swipe, or the screen reader's dismiss / escape action hide it. Hiding
 * never stops a download: it goes on, with its notification, and the Downloads screen still lists it; the pill
 * comes back only for a download that starts after that.
 */
export function DownloadIndicator({ store, bottomOffset, onOpen, onOpenFile }: Props) {
  const styles = useStyles();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const screenReader = useScreenReader();
  useSyncExternalStore(store.subscribe, store.getVersion);
  /** Downloads the user hid the pill for (their "finished" pill doesn't show either). */
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [finished, setFinished] = useState<DownloadItem | null>(null);
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  useEffect(
    () =>
      store.onFinished((item) => {
        if (AppState.currentState !== 'active' || hiddenRef.current.has(item.id)) return;
        setFinished(item);
      }),
    [store],
  );
  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setFinished(null), screenReader ? FINISHED_SCREEN_READER_MS : FINISHED_MS);
    return () => clearTimeout(timer);
  }, [finished, screenReader]);

  const active = store.activeList().filter((a) => running(a) && !hidden.has(a.id));
  const current = active[active.length - 1];
  // A finished pill only while nothing else is running on screen; the list is where the rest is.
  const done = !current && finished ? (store.get(finished.id) ?? finished) : null;
  const shownId = current?.id ?? (done ? `done:${done.id}` : null);

  // Hides the pill: for every download running now (it comes back for the next one that starts) and the finished
  // one. Made once, so the swipe's handlers (also made once) can call it; it only uses the store and state setters.
  const [hide] = useState(() => () => {
    const ids = store
      .activeList()
      .filter(running)
      .map((a) => a.id);
    setHidden((prev) => new Set([...prev, ...ids]));
    setFinished(null);
  });

  const [drag] = useState(() => new Animated.Value(0));
  useEffect(() => drag.setValue(0), [shownId, drag]);
  // Made once (a new responder mid-gesture would lose it); it only touches the animated value and a state setter.
  const [pan] = useState(() =>
    PanResponder.create({
      // Only a clear sideways move takes the touch; taps stay with the buttons.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => drag.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > SWIPE_DISTANCE || Math.abs(g.vx) > SWIPE_VELOCITY) {
          const to = (g.dx === 0 ? Math.sign(g.vx) : Math.sign(g.dx)) * 500;
          Animated.timing(drag, { toValue: to, duration: 140, useNativeDriver: true }).start(hide);
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => drag.setValue(0),
    }),
  );

  if (!current && !done) return null;

  const primary = () => {
    if (current) return onOpen();
    if (done?.state === 'done') {
      setFinished(null);
      return onOpenFile(done);
    }
    setFinished(null);
    onOpen();
  };

  const a11yActions = [
    {
      name: 'activate',
      label: current ? t('downloads.openList') : done?.state === 'done' ? t('downloads.open') : t('downloads.openList'),
    },
    // A custom action ("Hide") for TalkBack and VoiceOver; VoiceOver's escape gesture also hides it.
    { name: 'dismiss', label: t('downloads.hide') },
  ];
  const onA11yAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'dismiss') hide();
    else if (e.nativeEvent.actionName === 'activate') primary();
  };
  const opacity = drag.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });
  const closeButton = (
    <Pressable
      onPress={hide}
      hitSlop={10}
      style={styles.close}
      accessibilityRole="button"
      accessibilityLabel={t('downloads.hide')}
      accessibilityHint={t('downloads.hideHint')}
    >
      <Icon name="close" size={16} color={palette.textSecondary} />
    </Pressable>
  );

  let body;
  let label: string;
  if (current) {
    const fraction = downloadFraction(current);
    const progress = downloadProgressLabel(current);
    const more = active.length > 1 ? ` +${active.length - 1}` : '';
    label = t('downloads.inProgress', { name: current.name, progress });
    body = (
      <>
        <Icon name="download" size={16} color={palette.tintText} />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {current.name}
            {more}
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${Math.round((fraction ?? 0.15) * 100)}%` }]} />
          </View>
        </View>
        {progress ? <Text style={styles.progress}>{progress}</Text> : null}
      </>
    );
  } else {
    const ok = done!.state === 'done';
    label = t(ok ? 'downloads.done' : 'downloads.failed', { name: done!.name });
    body = (
      <>
        <Icon name={ok ? 'check' : 'insecure'} size={16} color={ok ? palette.tintText : palette.textSecondary} />
        <Text style={[styles.name, styles.texts]} numberOfLines={2}>
          {label}
        </Text>
        {ok ? (
          <Pressable
            onPress={primary}
            hitSlop={8}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t('downloads.open')}
          >
            <Text style={styles.actionText}>{t('downloads.open')}</Text>
          </Pressable>
        ) : null}
      </>
    );
  }

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + bottomOffset }]} pointerEvents="box-none">
      <Animated.View
        {...pan.panHandlers}
        style={[styles.pill, { opacity, transform: [{ translateX: drag }] }]}
        accessibilityLiveRegion={done ? 'polite' : 'none'}
      >
        <Pressable
          onPress={primary}
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityActions={a11yActions}
          onAccessibilityAction={onA11yAction}
          onAccessibilityEscape={hide}
        >
          {body}
        </Pressable>
        {closeButton}
      </Animated.View>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '90%',
    minWidth: 240,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    minHeight: 44,
  },
  texts: { flex: 1, gap: 4 },
  name: { fontSize: 13, color: c.text },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: c.sunken,
    overflow: 'hidden',
  },
  bar: { height: 3, borderRadius: 2, backgroundColor: c.tint },
  progress: {
    fontSize: 12,
    color: c.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  action: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  pressed: { opacity: 0.6 },
  actionText: { fontSize: 14, fontWeight: '600', color: c.tintText },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
