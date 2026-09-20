import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { fixture } from './helpers.js';
import { mockFigma } from './figma-mock.js';
import { auditMainBundle } from '../scripts/audit-main.mjs';

test('built MAIN passes the raw-source sandbox guard and ES2015 script parser', async () => {
  const code = await readFile(new URL('../dist/code.js', import.meta.url), 'utf8');
  assert.deepEqual(auditMainBundle(code), {
    ecmaVersion: 2015, sourceType: 'script', importExpressions: 0, importMeta: 0,
    moduleDeclarations: 0, dynamicCodeGenerationReferences: 0, comments: 0,
  });
});

test('syntax guard catches the original Zod comment, modules, later syntax and aliased code generation', () => {
  for (const source of [
    '// annotated so the .d.cts emits an indexed access rather than an inline `import()` of an ESM path\n(() => {})();',
    'import("module")', 'import /* comment */ ("module")', 'import.meta.url',
    'import value from "module";', 'export const value = 1;',
    'async function f() {}', 'const x = {...value};', 'const x = value?.key;',
    'eval("1")', 'new Function("return 1")', 'const F = Function; new F("return 1");',
    'globalThis["Function"]("return 1")', 'const E = eval; E("1");',
  ]) assert.throws(() => auditMainBundle(source), Error, source);
  assert.doesNotThrow(() => auditMainBundle('(() => { const value = [1, 2]; return value.map(x => x + 1); })();'));
});

test('main bundle executes without DOM, Node APIs, network, or dynamic code generation', async () => {
  const env = mockFigma(), messages: { type: string; message?: string }[] = [];
  const controller = Object.assign(env.mock, {
    showUI: (_html: string) => {}, notify: (_text: string) => {},
    ui: { postMessage: (message: { type: string }) => messages.push(message), onmessage: async (_message: unknown) => {} },
  });
  const code = await readFile(new URL('../dist/code.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../dist/ui.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('<!-- UI_SCRIPT -->'));
  const context = createContext({ figma: controller, __html__: html, Uint8Array }, { codeGeneration: { strings: false, wasm: false } });
  // The old bundle swallowed a failed code-constructor probe, so this VM test
  // alone passed. Now also verify it never even reads the native constructor.
  let constructorReads = 0;
  Object.defineProperty(context, 'Function', { get() { constructorReads++; throw new Error('Native code constructor accessed'); } });
  runInContext(code, context, { timeout: 10000 });
  await controller.ui.onmessage({ type: 'import', payload: await fixture() });
  assert.equal(messages[0]?.type, 'success', JSON.stringify(messages));
  assert.equal(env.page.children[0].children.length, 8);
  assert.equal(constructorReads, 0);
  const invalid = await fixture();
  invalid.content.body[0].highlight = 'not present in the sentence';
  await controller.ui.onmessage({ type: 'import', payload: invalid });
  assert.equal(messages[1]?.type, 'error');
  assert.match(messages[1]?.message ?? '', /Highlight target/);
  assert.equal(env.page.children.length, 1);
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['none']);
  assert.deepEqual(manifest.editorType, ['figma']);
});
