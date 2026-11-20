import { Pressable, Text, View } from 'react-native';
import { siteKey } from '../agent/sitePolicy';
import { t } from '../i18n';
import { cleanScriptSites, type ScriptSite } from '../storage/settings';
import { Icon } from '../ui/Icon';
import { makeStyles, usePalette, radii, common } from '../ui/theme';
import { dialog } from './Dialog';

/**
 * Settings › Assistant, under "Let the assistant run scripts on pages": sites with their own script setting — scripts
 * off there, or allowed on its sensitive pages (sign-in, payment, bank, pages with password or one-time code fields;
 * docs/page-customisation.md › Sensitive pages). Only here: never from the approval, the chat or the assistant.
 */
export function ScriptSitesSection({ value, onChange }: { value: ScriptSite[]; onChange: (next: ScriptSite[]) => void }) {
  const styles = useStyles();
  const palette = usePalette();

  const add = async () => {
    const text = await dialog.prompt({
      title: t('settings.scriptSitesAdd'),
      message: t('settings.scriptSitesAddBody'),
      label: t('siteRules.siteLabel'),
      placeholder: 'example.com',
      maxLength: 300,
      confirmText: t('siteRules.next'),
    });
    if (!text) return;
    const raw = text.trim();
    const host = siteKey(/^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\*\./, '').replace(/\/.*$/, '')}/`);
    if (!host) return dialog.alert(t('settings.scriptSitesAdd'), t('siteRules.badSite'));
    const choice = await dialog.show({
      title: host,
      choices: {
        label: t('settings.scriptSitesChoice'),
        options: [t('settings.scriptSite.off'), t('settings.scriptSite.sensitive')],
        initial: 0,
      },
      message: t('settings.scriptSitesSensitiveNote'),
      buttons: [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.save'), primary: true }],
    });
    if (choice.button !== 1) return;
    const setting = choice.choice === 1 ? 'sensitive' : 'off';
    onChange(cleanScriptSites([...value.filter((s) => s.host !== host), { host, setting }]));
  };

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{t('settings.scriptSites')}</Text>
      <Text style={styles.hint}>{t('settings.scriptSitesHint')}</Text>
      {value.map((site) => (
        <View key={site.host} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.host}>{site.host}</Text>
            <Text style={[styles.hint, site.setting === 'sensitive' && styles.warn]}>{t(`settings.scriptSite.${site.setting}`)}</Text>
          </View>
          <Pressable
            onPress={() => onChange(value.filter((s) => s.host !== site.host))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('settings.scriptSitesRemove', { site: site.host })}
          >
            <Icon name="close" size={16} color={palette.textSecondary} />
          </Pressable>
        </View>
      ))}
      <Pressable onPress={() => void add()} style={({ pressed }) => [styles.button, pressed && styles.pressed]} accessibilityRole="button">
        <Text style={styles.buttonText}>{t('settings.scriptSitesAdd')}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: { gap: 8, marginTop: 4, marginBottom: 8 },
  label: common(c).label,
  hint: common(c).hint,
  warn: { color: c.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: radii.card, padding: 12 },
  flex: { flex: 1 },
  host: { fontSize: 15, color: c.text },
  button: { backgroundColor: c.surface, borderRadius: radii.control, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600', color: c.tintText },
  pressed: { backgroundColor: c.pressed },
}));
