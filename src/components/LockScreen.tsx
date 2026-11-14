import { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';
import { DialogHost } from './Dialog';

type Props = {
  /** What is locked; null hides the screen. */
  locked: 'app' | 'incognito' | null;
  onUnlock: () => void;
  /** Incognito lock only: leave incognito instead of unlocking. */
  onLeave: () => void;
};

/** Covers the app until the user proves it's them; asks right away when it appears. */
export function LockScreen({ locked, onUnlock, onLeave }: Props) {
  const styles = useStyles();
  useEffect(() => {
    if (locked) onUnlock();
    // Ask once when the lock appears; the button asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  return (
    <Modal visible={locked !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={[styles.container, locked === 'incognito' && styles.incognito]}>
        <Text style={styles.icon}>{locked === 'incognito' ? '🕶' : '🔒'}</Text>
        <Text style={styles.title}>{t(locked === 'incognito' ? 'lock.incognitoTitle' : 'lock.appTitle')}</Text>
        <Pressable onPress={onUnlock} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('lock.unlock')}</Text>
        </Pressable>
        {locked === 'incognito' && (
          <Pressable onPress={onLeave} hitSlop={8} accessibilityRole="button">
            <Text style={styles.leave}>{t('lock.leaveIncognito')}</Text>
          </Pressable>
        )}
      </View>
      <DialogHost hold />
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: c.chrome,
    padding: 32,
  },
  incognito: { backgroundColor: '#1c1b22' },
  icon: { fontSize: 52 },
  title: { fontSize: 18, fontWeight: '700', color: c.textSecondary, textAlign: 'center' },
  button: { paddingHorizontal: 28, height: 48, borderRadius: 24, backgroundColor: c.tint, justifyContent: 'center' },
  buttonText: { color: c.onTint, fontSize: 16, fontWeight: '700' },
  leave: { color: '#a9a8b3', fontSize: 15 },
}));
