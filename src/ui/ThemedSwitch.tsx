import { Platform, Switch, SwitchProps } from 'react-native';
import { toggle } from '../device/haptics';
import { usePalette } from './theme';

/** A platform switch in the brand colour instead of the platform default blue/green, with a light haptic tick. */
export function ThemedSwitch({ onValueChange, ...props }: SwitchProps) {
  const c = usePalette();
  return (
    <Switch
      trackColor={{ false: c.sunken, true: c.tint }}
      thumbColor={Platform.OS === 'android' ? c.onTint : undefined}
      ios_backgroundColor={c.sunken}
      onValueChange={
        onValueChange
          ? (value) => {
              toggle(value);
              return onValueChange(value);
            }
          : undefined
      }
      {...props}
    />
  );
}
