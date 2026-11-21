// The shared test loader (../test-support/register.mjs) with this harness's stand-ins (./fakes.mjs): an in-memory
// expo-file-system and a recording native content blocker.
import { registerTestLoader } from '../test-support/register.mjs';
import { CONTENT_BLOCKER, FILE_SYSTEM } from './fakes.mjs';

registerTestLoader({
  natives: { 'expo-file-system': FILE_SYSTEM },
  stubs: { '/src/device/contentBlocker.ts': CONTENT_BLOCKER },
});
