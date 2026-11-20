import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PersonalSetting, SITE_LEVELS, SiteLevel } from '../agent/sitePolicy';
import { t } from '../i18n';
import { LocationSetting, MediaKind, PERMISSION_SETTINGS, PermissionSetting } from '../storage/sitePermissions';
import { makeStyles, common } from '../ui/theme';
import { Radio } from '../ui/Radio';
import { ThemedSwitch } from '../ui/ThemedSwitch';
import { BottomSheet } from './BottomSheet';
import { WholeWordsText } from './WholeWordsText';

type Props = {
  /** The site being set; null hides the sheet. */
  host: string | null;
  level: SiteLevel;
  onSelect: (level: SiteLevel) => void;
  /** Whether the assistant may enter the user's remembered personal details on this site. */
  personal: PersonalSetting;
  onSelectPersonal: (setting: PersonalSetting) => void;
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
  /** Ad and tracker blocking is on for this site ("Don't block on this site" turns it off). */
  blocking: boolean;
  onSetBlocking: (on: boolean) => void;
  /** "Block ads and trackers" is on in Settings (otherwise the switch has nothing to do). */
  blockingEnabled: boolean;
  /**
   * Requests blocked on the page on screen: a number (Android), 'unavailable' (iOS: WebKit doesn't report them),
   * or undefined when the sheet isn't about the page on screen.
   */
  blockedCount?: number | 'unavailable';
  /** How many of the user's own rules (content/siteRules.ts) this site has; none: nothing is shown. */
  ownRules?: number;
  /** Reloads the page on screen, for a changed blocking switch to take effect (only for the page's own site). */
  onReload?: () => void;
  /** Opens the list of every site with its own setting (absent when the sheet is opened from that list). */
  onShowAll?: () => void;
  /** Opens the Cookies view of the page on screen (only for the page's own site). */
  onShowCookies?: () => void;
  onClose: () => void;
};

/**
 * Picks what Qutai may do on one site (actions, and entering the user's personal details), and whether the site may
 * use the location, camera and microphone.
 */
export function SitePermissionSheet({
  host,
  level,
  onSelect,
  personal,
  onSelectPersonal,
  location,
  onSelectLocation,
  camera,
  microphone,
  onSelectMedia,
  capturing,
  onStopCapture,
  blocking,
  onSetBlocking,
  blockingEnabled,
  blockedCount,
  ownRules,
  onReload,
  onShowAll,
  onShowCookies,
  onClose,
}: Props) {
  const styles = useStyles();
  // After the switch changes, offer to reload: blocking changes apply from the next load.
  const [changedFor, setChangedFor] = useState<string | null>(null);
  const changed = host !== null && changedFor === host;
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
      <View style={styles.blockRow}>
        <View style={styles.texts}>
          <Text style={styles.label}>{t('site.blockingTitle')}</Text>
          <Text style={styles.hint}>
            {!blockingEnabled
              ? t('site.blockingOffInSettings')
              : blocking
                ? t('site.blockingOnHint')
                : t('site.blockingOffHint')}
          </Text>
          {blockingEnabled && blocking && blockedCount !== undefined && (
            <Text style={styles.hint}>
              {blockedCount === 'unavailable'
                ? t('site.blockedCountUnavailable')
                : t('site.blockedCount', { count: blockedCount })}
            </Text>
          )}
          {!!ownRules && <Text style={styles.hint}>{t('siteRules.siteCount', { count: ownRules })}</Text>}
          {changed && onReload && (
            <Pressable
              onPress={() => {
                onReload();
                onClose();
              }}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.link}>{t('site.blockingReload')}</Text>
            </Pressable>
          )}
        </View>
        <ThemedSwitch
          value={blocking}
          disabled={!blockingEnabled}
          onValueChange={(on) => {
            onSetBlocking(on);
            setChangedFor(host);
          }}
          accessibilityLabel={t('site.blockingTitle')}
        />
      </View>
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
        title={t('site.personalTitle')}
        value={personal}
        hint={t(`site.personalHint.${personal}`)}
        onSelect={onSelectPersonal}
      />
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
      {onShowCookies && (
        <Pressable
          onPress={onShowCookies}
          style={({ pressed }) => [styles.allSites, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.link}>{t('cookies.siteLink')} ›</Text>
        </Pressable>
      )}
      {onShowAll && (
        <Pressable
          onPress={onShowAll}
          style={({ pressed }) => [styles.allSites, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.link}>{t('site.allSites')} ›</Text>
        </Pressable>
      )}
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
              <WholeWordsText
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                  selected && option === 'block' && styles.danger,
                ]}
              >
                {t(`site.setting.${option}`)}
              </WholeWordsText>
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
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  link: { fontSize: 14, fontWeight: '700', color: c.tintText, marginTop: 4 },
  allSites: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  stop: { paddingHorizontal: 20, paddingVertical: 10, gap: 2 },
  stopText: { fontSize: 15, fontWeight: '700', color: c.danger },
  section: { fontSize: 15, fontWeight: '700', color: c.text, paddingHorizontal: 20, marginTop: 12, marginBottom: 8 },
  segment: { ...common(c).segment, marginHorizontal: 20 },
  segmentButton: common(c).segmentButton,
  segmentSelected: common(c).segmentSelected,
  segmentText: common(c).segmentText,
  segmentTextSelected: common(c).segmentTextSelected,
  settingHint: { fontSize: 13, color: c.textSecondary, lineHeight: 18, paddingHorizontal: 20, marginTop: 6 },
}));
