import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
// Only the offline Node test process maps Next's marker to its bundled server implementation.
// Production code retains literal `import 'server-only'` for Next's client boundary check.
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === 'server-only' ? pathToFileURL(resolve('node_modules/next/dist/compiled/server-only/empty.js')).href : specifier, context);
} });
