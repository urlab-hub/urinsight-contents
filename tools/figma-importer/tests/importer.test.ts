import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fixture } from './helpers.js';
import { mockFigma, descendants, MockNode } from './figma-mock.js';
import { importPackage } from '../src/importer.js';
import { parseContent, readPackage, validatePng } from '../src/package.js';
import { solid } from '../src/text.js';
import { t } from '../src/tokens.js';
import type { PackagePayload } from '../src/types.js';

function validateTree(page: MockNode, payload: PackagePayload) {
  assert.equal(page.children.length, 1);
  const section = page.children[0], frames = section.children;
  assert.equal(section.type, 'SECTION');
  assert.equal(frames.length, payload.content.body.length + 3);
  assert.equal(section.name, `URINSIGHT — ${payload.content.slug}`);
  assert.deepEqual(frames.map(n => n.name), ['01 COVER', ...payload.content.body.map((_, i) => `${String(i + 2).padStart(2, '0')} BODY ${String(i + 1).padStart(2, '0')}`), `${String(frames.length - 1).padStart(2, '0')} SUMMARY`, `${String(frames.length).padStart(2, '0')} INSIGHT`]);
  frames.forEach((n, i) => { assert.equal(n.type, 'FRAME'); assert.equal(n.width, 1080); assert.equal(n.height, 1350); if (i) assert.equal(n.x - frames[i - 1].x, 1180); assert.equal(n.exportSettings.length, 1); });
  const all = descendants(section), texts = all.filter(n => n.type === 'TEXT');
  assert.ok(texts.length > 35);
  assert.ok(texts.every(n => n.fontName.family === 'Pretendard' && !n.locked));
  assert.ok(all.every(n => ['FRAME', 'TEXT', 'RECTANGLE'].includes(n.type)));
  assert.ok(all.every(n => n.name !== 'Temporary text measurement'));
  const accent = solid(t.categories[payload.content.category].color);
  const highlights = all.filter(n => n.name.startsWith('Highlight Background'));
  assert.ok(highlights.length >= 9);
  for (const n of highlights) {
    assert.equal(n.type, 'RECTANGLE'); assert.deepEqual(n.fills, [accent]); assert.ok(!n.locked);
    const padding = JSON.parse(n.data.visualPadding);
    assert.ok(padding.left <= 5 && padding.right <= 7);
    assert.ok(n.parent!.children.some(text => text.type === 'TEXT' && text.ranges.length));
  }
  for (const [frame, opacity] of [[frames[0], 0.45], [frames.at(-1)!, 0.65]] as const) {
    assert.equal(frame.children.find(n => n.name === 'Black Overlay')!.opacity, opacity);
    assert.deepEqual((frame.children.find(n => n.name === 'Background Image')!.fills[0] as { type: string; scaleMode: string }).scaleMode, 'FILL');
  }
  const title = frames[0].children.find(n => n.name === 'Title')!;
  assert.deepEqual(title.children.filter(n => n.type === 'TEXT').map(n => n.characters), payload.content.cover.titleLines);
  assert.equal(title.y, 393);
  for (const frame of frames.slice(1, -2)) {
    assert.equal(frame.children.find(n => n.name === 'Brand')!.y, 303);
    assert.equal(frame.children.find(n => n.name === 'Subtitle')!.y, 395);
    assert.equal(frame.children.find(n => n.name === 'Paragraph 01')!.y, 504);
    const key = frame.children.find(n => n.name === 'Key Sentence')!;
    assert.equal(key.y + key.height, 1103);
  }
  const summary = frames.at(-2)!;
  const headline = summary.children.find(n => n.name === 'Headline')!;
  assert.equal(summary.children.find(n => n.name === 'Label')!.y, 255);
  assert.equal(summary.children.find(n => n.name === 'Paragraph 01')!.y, headline.y + headline.height + 51);
  const key = summary.children.find(n => n.name === 'Key Sentence')!;
  assert.equal(key.y + key.height, 1103);
}

test('business package: editable 8-page tree, anchors, fills, highlights and viewport', async () => {
  const p = await fixture(), env = mockFigma();
  const result = await importPackage(env.api, p);
  validateTree(env.page, p);
  assert.equal(result.pages, 8); assert.deepEqual(result.fonts, ['Pretendard Regular', 'Pretendard Bold']);
  assert.equal(env.loaded.length, 2); assert.deepEqual(env.images, [p.cover, p.insight]);
  assert.deepEqual(env.focused(), [env.page.children[0]]);
  const all = descendants(env.page);
  const text = all.find(n => n.name === 'Paragraph 01')!;
  text.characters = '직접 수정\n새 줄'; text.fontSize = 40; text.lineHeight.value = 56; text.letterSpacing.value = 1; text.x += 5;
  assert.equal(text.type, 'TEXT'); assert.equal(text.characters, '직접 수정\n새 줄');
  const rect = all.find(n => n.name.startsWith('Highlight Background'))!;
  rect.resize(rect.width + 20, rect.height + 4); rect.fills = [solid('#112233')];
  const image = all.find(n => n.name === 'Background Image')!;
  image.fills = [{ ...(image.fills[0] as object), scaleMode: 'CROP', imageTransform: [[1, 0, 0.1], [0, 1, 0.1]] }];
  assert.equal((image.fills[0] as { scaleMode: string }).scaleMode, 'CROP');
});
test('reimport preserves manual edits, uses unused suffix, and places below existing content', async () => {
  const env = mockFigma(), p = await fixture();
  await importPackage(env.api, p);
  const first = env.page.children[0], text = descendants(first).find(n => n.name === 'Paragraph 01')!;
  text.characters = '수동 수정 유지';
  const result = await importPackage(env.api, p);
  assert.equal(result.name, `${first.name} (2)`); assert.equal(text.characters, '수동 수정 유지');
  assert.equal(first.removed, false); assert.ok(env.page.children[1].y > first.y + first.height);
  assert.equal((await importPackage(env.api, p)).name, `${first.name} (3)`);
});
test('schema-valid 9/10 pages and all categories retain the shared contract', async () => {
  for (const [count, category] of [[6, 'money'], [7, 'insight']] as const) {
    const p = await fixture(); p.content.category = category;
    p.content.body = Array.from({ length: count }, (_, i) => ({ ...p.content.body[i % 5], number: i + 1 }));
    const env = mockFigma(); await importPackage(env.api, p); validateTree(env.page, p);
  }
});
test('editorial lines are kept, paragraphs stay semantic, auto headlines stay editable', async () => {
  const p = await fixture();
  p.content.body[0].paragraphLines = p.content.body[0].paragraphs.map(v => [v]);
  p.content.body[0].keySentenceLines = [p.content.body[0].keySentence];
  p.content.summary.headlineLines = ['인공지능 성과는 도구보다', '업무 흐름을 다시 설계할 때 커진다'];
  const env = mockFigma(); await importPackage(env.api, p);
  const summary = env.page.children[0].children.at(-2)!;
  const headline = summary.children.find(n => n.name === 'Headline')!;
  assert.deepEqual(headline.children.filter(n => n.type === 'TEXT').map(n => n.characters), p.content.summary.headlineLines);
  assert.equal(descendants(env.page).filter(n => n.name.startsWith('Paragraph ')).length, 17);
});
test('missing Regular/Bold and failed font load create no canvas nodes', async () => {
  for (const style of ['Regular', 'Bold']) {
    const env = mockFigma();
    env.mock.listAvailableFontsAsync = async () => [{ fontName: { family: 'Pretendard', style } }];
    await assert.rejects(importPackage(env.api, await fixture()), /unavailable/);
    assert.equal(env.page.children.length, 0); assert.equal(env.images.length, 0);
  }
  const env = mockFigma(); env.mock.loadFontAsync = async () => { throw new Error('offline font helper'); };
  await assert.rejects(importPackage(env.api, await fixture()), /load failed/);
  assert.equal(env.page.children.length, 0);
});
test('runtime failures remove only the current attempt, including temporary measurement nodes', async () => {
  const env = mockFigma(), p = await fixture();
  await importPackage(env.api, p);
  const original = env.page.children[0];
  const create = env.mock.createText; let calls = 0;
  env.mock.createText = () => { if (++calls === 5) throw new Error('simulated Figma failure'); return create(); };
  await assert.rejects(importPackage(env.api, p), /simulated Figma failure/);
  assert.deepEqual(env.page.children, [original]); assert.equal(original.removed, false);
});
test('bad schema/image bytes and Figma decode failures leave the canvas unchanged', async () => {
  const env = mockFigma(), p = await fixture();
  assert.throws(() => parseContent({ ...p.content, category: 'unsupported' }), /unsupported category/);
  assert.throws(() => parseContent({ ...p.content, body: [] }), /형식 오류/);
  await assert.rejects(importPackage(env.api, { ...p, cover: new Uint8Array(40) }), /PNG/);
  env.mock.createImage = () => { throw new Error('decode'); };
  await assert.rejects(importPackage(env.api, p), /cover.png/); assert.equal(env.page.children.length, 0);
  const huge = new Uint8Array(p.cover); new DataView(huge.buffer).setUint32(16, 5000);
  assert.throws(() => validatePng(huge, 'cover.png'), /4096/);
});
test('overflow is reported without silently changing fonts, anchors or content', async () => {
  const p = await fixture(); p.content.body[0].paragraphs = ['긴 본문 '.repeat(150)];
  const env = mockFigma(); const result = await importPackage(env.api, p);
  assert.ok(result.warnings.some(w => w.includes('02 BODY 01')));
  const frame = env.page.children[0].children[1], node = frame.children.find(n => n.name === 'Paragraph 01')!;
  assert.equal(node.characters, p.content.body[0].paragraphs[0]); assert.equal(node.fontSize, 38); assert.equal(node.y, 504);
});
test('package missing/duplicate files, invalid JSON, BOM, optional sources and same-folder checks', async () => {
  const p = await fixture();
  const file = (name: string, bytes: Uint8Array) => ({ name, size: bytes.length, text: async () => Buffer.from(bytes).toString('utf8'), arrayBuffer: async () => new Uint8Array(bytes).buffer });
  const json = file('carousel.json', Buffer.from('\ufeff' + JSON.stringify(p.content)));
  const cover = file('cover.png', p.cover), insight = file('insight.png', p.insight);
  await assert.rejects(readPackage([json, cover]), /insight.png missing/);
  await assert.rejects(readPackage([json, cover, cover, insight]), /중복/);
  await assert.rejects(readPackage([file('carousel.json', Buffer.from('{')), cover, insight]), /invalid JSON/);
  assert.equal((await readPackage([json, cover, insight, file('sources.md', Buffer.from('optional'))])).content.slug, p.content.slug);
  await assert.rejects(readPackage([{ ...json, webkitRelativePath: 'a/carousel.json' }, { ...cover, webkitRelativePath: 'b/cover.png' }, insight]), /다른 폴더/);
});

// Opt-in real package test reads local-only files and verifies byte preservation.
test('actual local URINSIGHT package imports without changing any package bytes', { skip: !process.env.URINSIGHT_FIGMA_TEST_PACKAGE }, async () => {
  const root = path.resolve(process.env.URINSIGHT_FIGMA_TEST_PACKAGE!);
  const names = await readdir(root);
  const bytes = await Promise.all(names.map(async name => ({ name, data: await readFile(path.join(root, name)) })));
  const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
  const p = await readPackage(bytes.map(({ name, data }) => ({ name, size: data.length, text: async () => data.toString('utf8'), arrayBuffer: async () => new Uint8Array(data).buffer })));
  assert.equal(p.content.category, 'business');
  const env = mockFigma(); await importPackage(env.api, p); validateTree(env.page, p);
  for (const file of bytes) assert.equal(hash(await readFile(path.join(root, file.name))), hash(file.data));
});
