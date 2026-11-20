import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppModal } from '../ui/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLanguage, t } from '../i18n';
import { formatDate } from '../i18n/format';
import { LEGAL_UPDATED, legalDocument, LegalKind } from '../legal/documents';
import { makeStyles } from '../ui/theme';
import { DialogHost } from './Dialog';

/** The full privacy policy or terms of use, from onboarding and Settings. */
export function LegalScreen({ kind, onClose }: { kind: LegalKind | null; onClose: () => void }) {
  return (
    <AppModal visible={kind !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {kind && <LegalContent kind={kind} onClose={onClose} />}
      <DialogHost />
    </AppModal>
  );
}

function LegalContent({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  const styles = useStyles();
  const doc = legalDocument(kind, getLanguage());
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {doc.title}
        </Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.done}>{t('common.done')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>{t('legal.updated', { date: formatDate(new Date(LEGAL_UPDATED)) })}</Text>
        <Text style={styles.body}>{doc.intro}</Text>
        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {section.heading}
            </Text>
            <Text style={styles.body} selectable>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  title: { color: c.text, fontSize: 17, fontWeight: '600', flex: 1 },
  done: { color: c.tintText, fontSize: 16, fontWeight: '600' },
  content: { padding: 20, gap: 14, maxWidth: 680, alignSelf: 'center', width: '100%' },
  updated: { color: c.textSecondary, fontSize: 13 },
  section: { gap: 6, marginTop: 6 },
  heading: { color: c.text, fontSize: 16, fontWeight: '700' },
  body: { color: c.text, fontSize: 15, lineHeight: 22 },
}));
