// The shared test loader (../test-support/register.mjs) with this harness's stand-ins (./fakes.mjs): the speech
// recogniser's native module and the app's dialog, which the tests drive and read.
import { registerTestLoader } from '../test-support/register.mjs';
import { DIALOG, SPEECH } from './fakes.mjs';

registerTestLoader({ natives: { 'expo-speech-recognition': SPEECH }, stubs: { '/src/components/Dialog.tsx': DIALOG } });
