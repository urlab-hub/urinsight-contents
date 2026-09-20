import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Only bundles browser-safe schema/tokens. No renderer, Node API or network at runtime.
const root = fileURLToPath(new URL('.', import.meta.url));
const common = { absWorkingDir: root, bundle: true, platform: 'browser', format: 'iife', target: 'es2017', legalComments: 'none' };
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await build({ ...common, entryPoints: ['src/code.ts'], outfile: 'dist/code.js' });
const ui = await build({ ...common, entryPoints: ['src/ui.ts'], write: false });
const html = await readFile(new URL('./src/ui.html', import.meta.url), 'utf8');
await writeFile(new URL('./dist/ui.html', import.meta.url), html.replace('<!-- UI_SCRIPT -->', () => `<script>${ui.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`));
console.log('Built dist/code.js and dist/ui.html (offline bundles).');
