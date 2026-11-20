import { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { usePalette, radii } from '../ui/theme';

type Props = { children: ReactNode; /** Fill the screen (whole app) rather than the area it guards. */ full?: boolean };

/**
 * Keeps one broken part of the screen from taking the whole app down: it shows a short message
 * with "Try again" in that part only. Tabs and conversations are saved, so trying again resumes.
 */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Qutai: a part of the screen crashed', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <Fallback full={this.props.full} onRetry={() => this.setState({ failed: false })} />;
  }
}

function Fallback({ full, onRetry }: { full?: boolean; onRetry: () => void }) {
  const c = usePalette();
  return (
    <View style={[styles.box, full && styles.full, { backgroundColor: c.bg }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: c.text }]}>{t('error.crashTitle')}</Text>
      <Text style={[styles.body, { color: c.textSecondary }]}>{t('error.crashBody')}</Text>
      <Pressable onPress={onRetry} style={[styles.button, { backgroundColor: c.tint }]} accessibilityRole="button">
        <Text style={[styles.buttonText, { color: c.onTint }]}>{t('error.crashRetry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  full: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 360 },
  button: { marginTop: 8, height: 44, paddingHorizontal: 22, borderRadius: radii.button, justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
