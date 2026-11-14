import { Pressable, Text, View } from 'react-native';
import { SITE_LEVELS, SiteLevel } from '../agent/sitePolicy';
import { t } from '../i18n';
import { LocationSetting, MediaKind, PERMISSION_SETTINGS, PermissionSetting } from '../storage/sitePermissions';
import { makeStyles } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { BottomSheet } from './BottomSheet';

type Props = {
  /** The site being set; null hides the sheet. */
  host: string | null;
  level: SiteLevel;
  onSelect: (level: SiteLevel) => void;
  /** Whether the site itself may use the location. */
  location: LocationSetting;
  onSelectLocation: (setting: LocationSetting) => void;
  /** Whether the site itself may use the camera and the microphone. */
  camera: PermissionSetting;
  microphone: PermissionSetting;
  onSelectMedia: (kind: MediaKind, setting: PermissionSetting) => void;
  /** The page on screen is using the camera or microphone on this site (offers a stop button). */
  capturing?: boolean;
  onStopCapture?: () => void;
  onClose: () => void;
};

/** Picks what Qutai may do on one site, and whether the site may use the location, camera and microphone. */
export function SitePermissionSheet({
  host,
  level,
  onSelect,
  location,
  onSelectLocation,
  camera,
  microphone,
  onSelectMedia,
  capturing,
  onStopCapture,
  onClose,
}: Props) {
  const styles = useStyles();
  return (
    <BottomSheet visible={host !== null} onClose={onClose} style={styles.sheet} bottomPadding={12}>
      <Text style={styles.title}>{t('site.title')}</Text>
      <Text style={styles.host} numberOfLines={1}>
        {host}
      </Text>
      {capturing && onStopCapture && (
        <Pressable
          onPress={() => {
            onStopCapture();
            onClose();
          }}
          style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.stopText}>{t('site.stopCapture')}</Text>
          <Text style={styles.hint}>{t('site.stopCaptureHint')}</Text>
        </Pressable>
      )}
      {SITE_LEVELS.map((option) => {
        const selected = option === level;
        return (
          <Pressable
            key={option}
            onPress={() => {
              onSelect(option);
              onClose();
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Radio selected={selected} />
            <View style={styles.texts}>
              <Text style={[styles.label, option === 'blocked' && styles.danger]}>{t(`site.level.${option}`)}</Text>
              <Text style={styles.hint}>{t(`site.hint.${option}`)}</Text>
            </View>
          </Pressable>
        );
      })}
      <SettingSegment
        title={t('site.locationTitle')}
        value={location}
        hint={t(`site.locationHint.${location}`)}
        onSelect={onSelectLocation}
      />
      <SettingSegment
        title={t('site.cameraTitle')}
        value={camera}
        hint={t(`site.cameraHint.${camera}`)}
        onSelect={(setting) => onSelectMedia('camera', setting)}
      />
      <SettingSegment
        title={t('site.microphoneTitle')}
        value={microphone}
        hint={t(`site.microphoneHint.${microphone}`)}
        onSelect={(setting) => onSelectMedia('microphone', setting)}
      />
    </BottomSheet>
  );
}

/** Ask / Allow / Block for one thing the site may use. */
function SettingSegment({
  title,
  value,
  hint,
  onSelect,
}: {
  title: string;
  value: PermissionSetting;
  hint: string;
  onSelect: (setting: PermissionSetting) => void;
}) {
  const styles = useStyles();
  return (
    <>
      <Text style={styles.section}>{title}</Text>
      <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {PERMISSION_SETTINGS.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[styles.segmentButton, selected && styles.segmentSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                  selected && option === 'block' && styles.danger,
                ]}
              >
                {t(`site.setting.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.settingHint}>{hint}</Text>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  sheet: { paddingTop: 16 },
  title: { fontSize: 17, fontWeight: '700', color: c.text, paddingHorizontal: 20 },
  host: { fontSize: 13, color: c.textSecondary, paddingHorizontal: 20, marginTop: 2, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  pressed: { backgroundColor: c.pressed },
  texts: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600', color: c.text },
  danger: { color: c.danger },
  hint: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  stop: { paddingHorizontal: 20, paddingVertical: 10, gap: 2 },
  stopText: { fontSize: 15, fontWeight: '700', color: c.danger },
  section: { fontSize: 15, fontWeight: '700', color: c.text, paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: c.sunken, borderRadius: 10, padding: 3, marginHorizontal: 20 },
  segmentButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  segmentSelected: { backgroundColor: c.surface },
  segmentText: { fontSize: 14, color: c.textSecondary },
  segmentTextSelected: { color: c.text, fontWeight: '700' },
  settingHint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, paddingHorizontal: 20, marginTop: 6 },
}));
