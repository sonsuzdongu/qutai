// `node --import ./scripts/test-support/loader.mjs`: the shared test loader with no harness options (register.mjs).
import { registerTestLoader } from './register.mjs';

registerTestLoader();
