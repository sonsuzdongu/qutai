import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** The open keyboard's height, 0 when it is closed. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    // iOS has "will" events, which line up with the keyboard animation; Android only has "did".
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const onHide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);
  return height;
}
