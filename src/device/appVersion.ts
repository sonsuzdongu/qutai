import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Qutai's version and build number. In Expo Go the native values belong to Expo Go itself, so
 * there they come from app.json; in real builds from the installed app.
 */
export function appVersion(): { version: string; build: string } {
  const config = Constants.expoConfig;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    const build = Platform.OS === 'ios' ? config?.ios?.buildNumber : config?.android?.versionCode;
    return { version: config?.version ?? '–', build: build != null ? String(build) : '–' };
  }
  return {
    version: Application.nativeApplicationVersion ?? config?.version ?? '–',
    build: Application.nativeBuildVersion ?? '–',
  };
}
