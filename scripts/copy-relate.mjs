// Copies the Relate WebAssembly engine files from node_modules into
// public/relate so Vite serves them as static files, unchanged.
// The engine glue (relate.js) fetches relate_bg.wasm from beside itself
// and imports snippets/ the same way, so the files must sit together
// and must not be bundled or renamed.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@relate', 'relate-wasm');
const dest = join(root, 'public', 'relate');

if (!existsSync(src)) {
  console.error('Missing node_modules/@relate/relate-wasm. Run npm install first.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
for (const item of ['relate.js', 'relate_bg.wasm', 'trap.js', 'snippets']) {
  cpSync(join(src, item), join(dest, item), { recursive: true });
}
console.log('Relate engine files copied to public/relate/');
