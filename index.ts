import { registerRootComponent } from 'expo';

// First: the interface language chosen in Qutai's settings, before any other module reads a string.
import './src/i18n/startup';
import App from './App';
import { registerBackgroundTaskRunner } from './src/device/backgroundTask';

// Android: the headless task that keeps JS timers running while an assistant task goes on in the background.
registerBackgroundTaskRunner();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
