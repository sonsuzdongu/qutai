import { PermissionDeniedError } from './settings';

type LocationModule = typeof import('expo-location');

/** A position as the app hands it on: to a web page or to the assistant. */
export type Position = {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in metres (large when the user allowed only approximate location). */
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  /** When the position was measured, in ms since the epoch. */
  timestamp: number;
};

/** Why no position could be read. `denied` comes as PermissionDeniedError instead. */
export class LocationUnavailableError extends Error {
  constructor(
    message: string,
    readonly reason: 'needsBuild' | 'servicesOff' | 'timeout' | 'failed',
  ) {
    super(message);
  }
}

// Loaded on first use, so a build without the native module still starts.
async function load(): Promise<LocationModule> {
  try {
    return await import('expo-location');
  } catch {
    throw new LocationUnavailableError('Location is not in this build of Qutai (a new app build is needed).', 'needsBuild');
  }
}

/**
 * Asks the system for "while using the app" location, only if it was never decided; never background.
 * Approximate location is accepted as it is. Throws PermissionDeniedError when it is not allowed.
 */
export async function ensureLocationPermission(): Promise<void> {
  const Location = await load();
  let status = await Location.getForegroundPermissionsAsync();
  if (!status.granted && status.canAskAgain) status = await Location.requestForegroundPermissionsAsync();
  if (!status.granted) {
    throw new PermissionDeniedError('The user has not allowed Qutai to use their location.', status.canAskAgain);
  }
}

/** True when the system permission is already granted (nothing is asked). */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const Location = await load();
    return (await Location.getForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function servicesCheck(Location: LocationModule) {
  if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
    throw new LocationUnavailableError('Location services are turned off on the phone.', 'servicesOff');
  }
}

function toPosition(location: import('expo-location').LocationObject): Position {
  const c = location.coords;
  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracy: c.accuracy ?? 0,
    altitude: c.altitude,
    altitudeAccuracy: c.altitudeAccuracy,
    heading: c.heading,
    speed: c.speed,
    timestamp: location.timestamp,
  };
}

export type ReadOptions = {
  /** GPS-level accuracy (slower, more battery); otherwise about 100 m. */
  highAccuracy?: boolean;
  /** A cached position up to this old (ms) is good enough. */
  maximumAge?: number;
  /** Give up after this long (ms). */
  timeout?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;

/** Reads the current position. Call ensureLocationPermission first. */
export async function readPosition(options: ReadOptions = {}): Promise<Position> {
  const Location = await load();
  await servicesCheck(Location);
  if (options.maximumAge && options.maximumAge > 0) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: options.maximumAge }).catch(() => null);
    if (last) return toPosition(last);
  }
  const timeout = Math.max(0, Math.min(options.timeout ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS * 4));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: options.highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
      }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new LocationUnavailableError('Timed out while reading the location.', 'timeout')),
          timeout,
        );
      }),
    ]);
    return toPosition(location);
  } catch (e) {
    if (e instanceof LocationUnavailableError) throw e;
    throw new LocationUnavailableError(e instanceof Error ? e.message : String(e), 'failed');
  } finally {
    clearTimeout(timer);
  }
}

/** Follows the position until the returned function is called. Call ensureLocationPermission first. */
export async function watchPosition(
  highAccuracy: boolean,
  onPosition: (position: Position) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  const Location = await load();
  await servicesCheck(Location);
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
      // Small moves are enough to update a "you are here" dot; no faster than once a second.
      distanceInterval: 5,
      timeInterval: 1000,
    },
    (location) => onPosition(toPosition(location)),
    onError,
  );
  return () => subscription.remove();
}
