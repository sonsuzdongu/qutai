import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { t } from '../i18n';
import { makeStyles } from '../ui/theme';

/**
 * Under an error in the assistant panel: "Details" opens the raw error text (status, the provider's own message) the
 * plain sentence above was made from (ai/plainError.ts). Selectable, so it can be copied into a bug report.
 */
export function ErrorDetails({ details }: { details: string }) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
      >
        <Text style={styles.toggle}>{t(open ? 'error.hideDetails' : 'error.details')}</Text>
      </Pressable>
      {open ? (
        <Text style={styles.details} selectable>
          {details}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { marginLeft: 25, marginTop: 2, gap: 4 },
  toggle: { color: c.tintText, fontSize: 13, fontWeight: '600' },
  details: { color: c.textSecondary, fontSize: 12 },
}));
