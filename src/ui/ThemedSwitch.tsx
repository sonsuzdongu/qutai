import { Platform, Switch, SwitchProps } from 'react-native';
import { usePalette } from './theme';

/** A platform switch in the brand colour instead of the platform default blue/green. */
export function ThemedSwitch(props: SwitchProps) {
  const c = usePalette();
  return (
    <Switch
      trackColor={{ false: c.sunken, true: c.tint }}
      thumbColor={Platform.OS === 'android' ? c.onTint : undefined}
      ios_backgroundColor={c.sunken}
      {...props}
    />
  );
}
