import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { launchBrowser } from '../../../src/renderer/browser.js';
import { fixture, packageFiles } from './helpers.js';

test('built offline UI: file validation → import controller → editable tree → safe reimport → font error', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 480, height: 760 } });
    page.setDefaultTimeout(10000);
    const errors: string[] = [], requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    const ui = await readFile(new URL('../dist/ui.html', import.meta.url), 'utf8');
    const code = await readFile(new URL('../dist/code.js', import.meta.url), 'utf8');
    const mock = await build({ entryPoints: [fileURLToPath(new URL('./figma-mock.ts', import.meta.url))], bundle: true, write: false, format: 'iife', globalName: 'FigmaMock' });
    await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
    await page.addScriptTag({ content: mock.outputFiles[0].text });
    await page.evaluate(`window.env = FigmaMock.mockFigma(); window.figma = env.api;
      figma.showUI = function(html) { const iframe = document.createElement('iframe'); iframe.id='plugin'; iframe.style='width:440px;height:720px;border:0'; iframe.srcdoc=html; document.body.appendChild(iframe); };
      figma.notify = function() {};
      figma.ui = { postMessage: message => document.querySelector('iframe').contentWindow.postMessage({pluginMessage:message}, '*') };
      window.addEventListener('message', event => { if(event.data.pluginMessage?.type === 'import') figma.ui.onmessage(event.data.pluginMessage); });`);
    await page.evaluate(html => { Object.assign(window, { __html__: html }); }, ui);
    await page.addScriptTag({ content: code });
    const frame = page.frameLocator('#plugin'), input = frame.locator('#files'), status = frame.locator('#status');
    const files = packageFiles(await fixture());
    assert.equal(await frame.locator('#import').isDisabled(), true);
    await input.setInputFiles(files.slice(0, 2));
    await status.filter({ hasText: 'insight.png missing' }).waitFor();
    await input.setInputFiles([{ ...files[0], buffer: Buffer.from('{') }, ...files.slice(1)]);
    await status.filter({ hasText: 'invalid JSON' }).waitFor();
    await input.setInputFiles([files[0], files[0], ...files.slice(1)]);
    await status.filter({ hasText: '중복' }).waitFor();
    await input.setInputFiles(files);
    await status.filter({ hasText: 'Ready — 8 pages' }).waitFor();
    assert.equal(await frame.locator('#slug').textContent(), 'ai-workflow-redesign');
    assert.equal(await frame.locator('#category').textContent(), '사업');
    await frame.locator('#import').click();
    await status.filter({ hasText: 'Imported — URINSIGHT' }).waitFor();
    assert.equal(await page.evaluate('env.page.children[0].children.length'), 8);
    assert.equal(await page.evaluate('env.images.length'), 2);
    await frame.locator('#import').click();
    await status.filter({ hasText: 'ai-workflow-redesign (2)' }).waitFor();
    assert.equal(await page.evaluate('env.page.children.length'), 2);
    await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
    await page.locator('#plugin').screenshot({ path: fileURLToPath(new URL('../artifacts/ui-imported.png', import.meta.url)) });
    await page.evaluate('figma.listAvailableFontsAsync = async () => []');
    await frame.locator('#import').click();
    await status.filter({ hasText: 'Pretendard Regular unavailable' }).waitFor();
    assert.equal(await frame.locator('#import').isEnabled(), true);
    assert.equal(await page.evaluate('env.page.children.length'), 2);
    assert.deepEqual(requests, []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('built UI rejects corrupt PNG/category and reads a package directory', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.setContent(await readFile(new URL('../dist/ui.html', import.meta.url), 'utf8'));
    const files = packageFiles(await fixture()), status = page.locator('#status'), input = page.locator('#files');
    await input.setInputFiles([files[0], { ...files[1], buffer: Buffer.from('broken image') }, files[2]]);
    await status.filter({ hasText: '유효한 PNG' }).waitFor();
    const p = await fixture();
    await input.setInputFiles([{ ...files[0], buffer: Buffer.from(JSON.stringify({ ...p.content, category: '사업' })) }, ...files.slice(1)]);
    await status.filter({ hasText: 'unsupported category' }).waitFor();
    if (process.env.URINSIGHT_FIGMA_TEST_PACKAGE) {
      await page.locator('#directory').setInputFiles(process.env.URINSIGHT_FIGMA_TEST_PACKAGE);
      await status.filter({ hasText: 'Ready — 8 pages' }).waitFor();
      assert.equal(await page.locator('#slug').textContent(), p.content.slug);
    }
  } finally { await browser.close(); }
});
