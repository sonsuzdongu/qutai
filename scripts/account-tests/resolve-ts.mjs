// Lets Node run the app's pure TypeScript modules as they are written for Metro: relative imports without an
// extension resolve to the `.ts` file. Used only by the account tests (see README.md in this folder).
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try {
          return await next(specifier, context);
        } catch (error) {
          if (!specifier.startsWith('.') || /\\.[cm]?[jt]s$/.test(specifier)) throw error;
          return next(specifier + '.ts', context);
        }
      }
    `),
);
