import { authenticateAsync, getEnrolledLevelAsync, SecurityLevel } from 'expo-local-authentication';

/** Whether the phone can verify the user (biometrics or at least a passcode). */
export async function canAuthenticate(): Promise<boolean> {
  try {
    return (await getEnrolledLevelAsync()) !== SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Asks for Face ID / fingerprint, falling back to the device passcode. */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const result = await authenticateAsync({ promptMessage, disableDeviceFallback: false });
    return result.success;
  } catch {
    return false;
  }
}
