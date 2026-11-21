import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useWaitingForUser } from '../device/backgroundTask';
import { EdgeLight } from './AssistantGlass';

/**
 * The working light at screen level (docs/working-mode.md): a line of light travelling around the whole screen while a
 * task runs, over the page and the panel, under the step strip (EdgeLight in AssistantGlass.tsx). Off while a dialog
 * waits for the user's answer and while Qutai isn't in the foreground (nothing runs then). Takes no touches, is hidden
 * from screen readers, and lies outside the tabs' containers, so the assistant's screenshots never contain it.
 */
export function WorkingGlow({ visible }: { visible: boolean }) {
  const waiting = useWaitingForUser();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  if (!visible || waiting || !active) return null;
  return <EdgeLight />;
}
