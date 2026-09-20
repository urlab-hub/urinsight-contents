import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { fixture } from './helpers.js';
import { mockFigma } from './figma-mock.js';

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
  runInContext(code, context, { timeout: 10000 });
  await controller.ui.onmessage({ type: 'import', payload: await fixture() });
  assert.equal(messages[0]?.type, 'success', JSON.stringify(messages));
  assert.equal(env.page.children[0].children.length, 8);
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['none']);
  assert.deepEqual(manifest.editorType, ['figma']);
});
