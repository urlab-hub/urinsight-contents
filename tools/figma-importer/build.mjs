import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { auditMainBundle } from './scripts/audit-main.mjs';

// Only bundles browser-safe schema/tokens. No renderer, Node API or network at runtime.
const root = fileURLToPath(new URL('.', import.meta.url));
const common = { absWorkingDir: root, bundle: true, platform: 'browser', format: 'iife', legalComments: 'none' };
const mainBuildOptions = {
  ...common, entryPoints: ['src/code.ts'], target: 'es2015', write: false,
  // Figma's source scanner also sees import-like text inside dependency comments.
  // legalComments:none alone does not remove ordinary comments in a readable build.
  minifyWhitespace: true,
  inject: ['scripts/no-code-generation.js'],
};
const uiBuildOptions = { ...common, entryPoints: ['src/ui.ts'], target: 'es2017', write: false };
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
const main = await build(mainBuildOptions);
const audit = auditMainBundle(main.outputFiles[0].text);
await writeFile(new URL('./dist/code.js', import.meta.url), main.outputFiles[0].text);
console.log('MAIN syntax audit:', JSON.stringify(audit));
const ui = await build(uiBuildOptions);
const html = await readFile(new URL('./src/ui.html', import.meta.url), 'utf8');
await writeFile(new URL('./dist/ui.html', import.meta.url), html.replace('<!-- UI_SCRIPT -->', () => `<script>${ui.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`));
console.log('Built dist/code.js and dist/ui.html (offline bundles).');
