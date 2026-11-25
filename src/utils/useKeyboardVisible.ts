import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { isIosAppOnMac } from '../device/macDevice';

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // A Mac has no on-screen keyboard, only an input bar iOS reports as one (UI-77).
    if (isIosAppOnMac) return;
    // iOS has "will" events, which line up with the keyboard animation; Android only has "did".
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
