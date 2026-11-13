import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MODEL_OPTIONS, Settings } from '../storage/settings';

type Props = {
  visible: boolean;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
};

export function SettingsModal({ visible, settings, onSave, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* Mounted only while visible, so the draft always starts from the saved settings. */}
      {visible && <SettingsForm settings={settings} onSave={onSave} onClose={onClose} />}
    </Modal>
  );
}

function SettingsForm({ settings, onSave, onClose }: Omit<Props, 'visible'>) {
  const [draft, setDraft] = useState(settings);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.cancel}>Vazgeç</Text>
        </Pressable>
        <Text style={styles.title}>Ayarlar</Text>
        <Pressable onPress={() => onSave({ ...draft, apiKey: draft.apiKey.trim() })} hitSlop={8}>
          <Text style={styles.save}>Kaydet</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Anthropic API anahtarı</Text>
        <TextInput
          style={styles.input}
          value={draft.apiKey}
          onChangeText={(apiKey) => setDraft({ ...draft, apiKey })}
          placeholder="sk-ant-..."
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.hint}>Anahtar yalnızca bu cihazda, şifreli depolamada saklanır.</Text>

        <Text style={styles.label}>Model</Text>
        {MODEL_OPTIONS.map((m) => (
          <Pressable key={m.id} style={styles.option} onPress={() => setDraft({ ...draft, model: m.id })}>
            <Text style={styles.radio}>{draft.model === m.id ? '◉' : '○'}</Text>
            <Text style={styles.optionText}>{m.label}</Text>
          </Pressable>
        ))}

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Her eylemden önce onay iste</Text>
            <Text style={styles.hint}>Tıklama, yazma ve sayfa açma işlemlerinden önce size sorulur.</Text>
          </View>
          <Switch
            value={draft.confirmActions}
            onValueChange={(confirmActions) => setDraft({ ...draft, confirmActions })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf9f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d6d3c9',
  },
  title: { fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 16, color: '#666' },
  save: { fontSize: 16, color: '#c96442', fontWeight: '600' },
  content: { padding: 16, gap: 8 },
  label: { fontSize: 15, fontWeight: '600', marginTop: 12 },
  hint: { fontSize: 13, color: '#888' },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d6d3c9',
    fontSize: 15,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  radio: { fontSize: 18, color: '#c96442' },
  optionText: { fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
});
