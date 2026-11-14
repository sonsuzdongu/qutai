import type { PermissionResponse } from 'expo-camera';
import type { MediaKind } from '../storage/sitePermissions';
import { PermissionDeniedError } from './settings';

type CameraModule = typeof import('expo-camera');

async function load(): Promise<CameraModule['Camera']> {
  return (await import('expo-camera')).Camera;
}

async function status(kind: MediaKind, request: boolean): Promise<PermissionResponse> {
  const Camera = await load();
  if (kind === 'camera') return request ? Camera.requestCameraPermissionsAsync() : Camera.getCameraPermissionsAsync();
  return request ? Camera.requestMicrophonePermissionsAsync() : Camera.getMicrophonePermissionsAsync();
}

/**
 * Asks the system for the camera or the microphone, only if it was never decided. Throws
 * PermissionDeniedError when it is not allowed (canAskAgain false: only Settings helps).
 */
export async function ensureMediaPermission(kind: MediaKind): Promise<void> {
  let current = await status(kind, false);
  if (!current.granted && current.canAskAgain) current = await status(kind, true);
  if (!current.granted) {
    throw new PermissionDeniedError(`The user has not allowed Qutai to use the ${kind}.`, current.canAskAgain);
  }
}

/** True when the system permission is already granted (nothing is asked). */
export async function hasMediaPermission(kind: MediaKind): Promise<boolean> {
  try {
    return (await status(kind, false)).granted;
  } catch {
    return false;
  }
}
