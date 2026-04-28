import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await build({
  entryPoints: [path.join(root, 'server/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(root, 'dist/server/index.js'),
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  // Bundle every npm dep including pidusage so the lite zip (which has
  // no node_modules folder) can run with just `node server.js`.
  external: [],
  minify: false,
  sourcemap: false,
  logLevel: 'info',
});

console.log('✓ server bundled → dist/server/index.js');
