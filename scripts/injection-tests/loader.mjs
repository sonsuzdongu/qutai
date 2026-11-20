// The shared test loader (../test-support/register.mjs) with this harness's stand-ins for the app modules that only
// talk to native code (./stubs.mjs): PDF text comes from globalThis.__qutaiPdfs, attachments' files are never read.
import { registerTestLoader } from '../test-support/register.mjs';
import { STUBBED } from './stubs.mjs';

registerTestLoader({ stubs: STUBBED });
