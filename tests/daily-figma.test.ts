import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { runDailyFigma } from '../src/handoff/daily-figma.js';
import { openWindowsTarget, validateFigmaUrl } from '../src/handoff/windows-open.js';
import type { OpenTarget, LaunchRequest } from '../src/handoff/windows-open.js';
import type { runDaily } from '../src/daily/runner.js';
import { projectRoot } from '../src/renderer/render.js';
import { mobileContentFixture } from './fixtures/mobile-content.js';

type DailyResult = Awaited<ReturnType<typeof runDaily>>;
const quiet = () => {};
const success = (count = 1): DailyResult => ({
  date: '2026-09-20', failed: 0,
  results: Array.from({ length: count }, (_, i) => ({ name: `package-${i}`, status: 'success' })),
});
const root = path.resolve('테스트 작업 & 자료');

test('handoff: Daily failure, partial failure, dry-run, empty and ready-only results open nothing', async () => {
  for (const [result, args] of [
    [{ date: '2026-09-20', failed: 1, results: [{ name: 'bad', status: 'failed' }] }, []],
    [{ ...success(), failed: 1, results: [...success().results, { name: 'bad', status: 'failed' }] }, []],
    [success(), ['--dry-run']],
    [{ ...success(), results: [] }, []],
    [{ ...success(), results: [{ name: 'ready', status: 'ready' }] }, []],
  ] as [DailyResult, string[]][]) {
    const opens: OpenTarget[] = [];
    assert.equal(await runDailyFigma({ root, args, log: quiet }, { daily: async () => result, open: async target => { opens.push(target); } }), result);
    assert.deepEqual(opens, []);
  }
});

test('handoff: thrown Daily errors and invalid Daily options propagate with zero opens', async () => {
  let opens = 0, runs = 0;
  const dependencies = { daily: async () => { runs++; throw new Error('daily lock'); }, open: async () => { opens++; } };
  await assert.rejects(runDailyFigma({ root, log: quiet }, dependencies), /daily lock/);
  await assert.rejects(runDailyFigma({ root, args: ['--force'], log: quiet }, dependencies), /Unknown/);
  assert.equal(runs, 1); assert.equal(opens, 0);
});

test('handoff: canonical parser/runner invoked once, returned date used, multiple packages open one folder before Figma', async () => {
  const opens: OpenTarget[] = [], result = success(3); let runs = 0;
  const actual = await runDailyFigma({ root, args: ['--', '--only', '한글 package'], log: quiet }, {
    daily: async options => { runs++; assert.deepEqual(options, { root, only: '한글 package', log: quiet }); return result; },
    open: async target => { opens.push(target); },
  });
  assert.equal(runs, 1); assert.equal(actual, result);
  assert.deepEqual(opens, [
    { kind: 'explorer', target: path.resolve(root, 'processed', result.date) },
    { kind: 'figma', target: 'figma://' },
  ]);
});

test('handoff: configured Figma URL is passed exactly and blank config attempts Desktop', async () => {
  for (const url of ['https://www.figma.com/design/example/URINSIGHT?node-id=1-2&mode=design', 'figma://design/example/URINSIGHT', '   ']) {
    const opens: OpenTarget[] = [];
    await runDailyFigma({ root, figmaFileUrl: url, log: quiet }, { daily: async () => success(), open: async target => { opens.push(target); } });
    assert.equal(opens[1].target, url.trim() || 'figma://');
  }
});

test('handoff: either or both open failures only warn; Explorer failure still attempts Figma', async () => {
  for (const failedKind of ['explorer', 'figma', 'both']) {
    const result = success(), warnings: string[] = [], opens: OpenTarget[] = [];
    const actual = await runDailyFigma({ root, log: quiet, warn: message => warnings.push(message) }, {
      daily: async () => result,
      open: async target => { opens.push(target); if (target.kind === failedKind || failedKind === 'both') throw new Error('app unavailable'); },
    });
    assert.equal(actual, result); assert.equal(actual.failed, 0); assert.equal(opens.length, 2);
    assert.equal(warnings.length, failedKind === 'both' ? 2 : 1);
    assert.ok(warnings.every(w => w.includes('Daily 완료 결과는 유지')));
  }
});

test('Windows launcher: constant script, separate environment data, hidden bounded launcher and no cmd shell', async () => {
  const targets: OpenTarget[] = [
    { kind: 'explorer', target: "C:\\한글 작업 & 자료\\O'Brien $(ignored); `name`\\processed\\2026-09-20" },
    { kind: 'figma', target: 'https://www.figma.com/design/key/한글?node-id=1-2&mode=design' },
    { kind: 'figma', target: 'figma://' },
  ];
  const requests: LaunchRequest[] = [];
  for (const target of targets) await openWindowsTarget(target, { platform: 'win32', env: {}, execute: async request => { requests.push(request); } });
  requests.forEach((request, i) => {
    assert.equal(request.file, 'powershell.exe'); assert.equal(request.options.shell, false);
    assert.equal(request.options.windowsHide, true); assert.equal(request.options.timeout, 10000);
    assert.equal(request.args.at(-1), requests[0].args.at(-1));
    const script = Buffer.from(request.args.at(-1)!, 'base64').toString('utf16le');
    assert.ok(!script.includes(targets[i].target));
    assert.equal(request.options.env.URINSIGHT_HANDOFF_TARGET, targets[i].target);
    assert.equal(request.options.env.URINSIGHT_HANDOFF_KIND, targets[i].kind);
  });
});

test('Windows launcher: invalid URL/path and non-Windows hosts cannot launch apps', async () => {
  for (const value of ['file:///C:/run.exe', 'javascript:alert(1)', 'https://evil.example/design/a', 'https://www.figma.com.evil.example/design/a', 'https://www.figma.com/community/plugin/1', 'figma://plugin/run', 'C:\\run.exe', 'https://user@www.figma.com/design/a']) {
    assert.throws(() => validateFigmaUrl(value), /FIGMA_FILE_URL/);
  }
  let called = false;
  const execute = async () => { called = true; };
  await assert.rejects(openWindowsTarget({ kind: 'figma', target: 'figma://' }, { platform: 'linux', execute }), /Windows only/);
  await assert.rejects(openWindowsTarget({ kind: 'explorer', target: 'relative/path' }, { platform: 'win32', execute }), /absolute Windows/);
  assert.equal(called, false);
  await assert.rejects(openWindowsTarget({ kind: 'figma', target: 'figma://' }, { platform: 'win32', execute: async () => { throw new Error('ENOENT'); } }), /ENOENT/);
});

test('PowerShell bridge preserves Korean, spaces and metacharacters without interpreting target data', { skip: process.platform !== 'win32' }, async () => {
  const capture = `
function Test-Path { param($LiteralPath, $PathType) return $true }
function Start-Process { param($FilePath, $ArgumentList) @{ file = $FilePath; args = $ArgumentList } | ConvertTo-Json -Compress }
`;
  const target = "C:\\한글 작업 & 자료\\O'Brien $(throw 'injected'); `name`\\processed\\2026-09-20";
  await openWindowsTarget({ kind: 'explorer', target }, {
    execute: async request => {
      const script = '[Console]::OutputEncoding = [Text.Encoding]::UTF8\n' + capture + Buffer.from(request.args.at(-1)!, 'base64').toString('utf16le');
      const { stdout } = await promisify(execFile)(request.file, [...request.args.slice(0, -1), Buffer.from(script, 'utf16le').toString('base64')], request.options);
      const actual = JSON.parse(stdout.replace(/^\uFEFF/, ''));
      assert.equal(actual.file, 'explorer.exe');
      assert.equal(actual.args, `"${target}"`);
    },
  });
});

test('real Daily integration: PNG/contact-sheet and processed move finish before a single handoff', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'urinsight-handoff-한글 '));
  try {
    const content = mobileContentFixture(JSON.parse(await readFile(path.join(projectRoot, 'content/sample-insight.json'), 'utf8')));
    const input = path.join(temp, 'inbox', content.slug);
    await mkdir(input, { recursive: true });
    const json = JSON.stringify(content); await writeFile(path.join(input, 'carousel.json'), json);
    for (const name of ['cover.png', 'insight.png']) await sharp({ create: { width: 20, height: 20, channels: 3, background: '#123456' } }).png().toFile(path.join(input, name));
    const opens: OpenTarget[] = [], warnings: string[] = [];
    const result = await runDailyFigma({ root: temp, log: quiet, warn: message => warnings.push(message) }, {
      open: async target => {
        opens.push(target);
        if (target.kind !== 'explorer') return;
        assert.equal(await readFile(path.join(target.target, content.slug, 'carousel.json'), 'utf8'), json);
        assert.deepEqual(await readdir(path.join(temp, 'inbox')), []);
        const output = path.join(temp, 'output', path.basename(target.target), content.slug);
        const files = await readdir(output);
        assert.ok(files.includes('contact-sheet.png')); assert.ok(files.includes('01_cover.png')); assert.ok(files.includes('08_insight.png'));
      },
    });
    assert.deepEqual(warnings, []);
    assert.equal(result.failed, 0); assert.equal(result.results[0].status, 'success');
    assert.deepEqual(opens, [{ kind: 'explorer', target: path.resolve(temp, 'processed', result.date) }, { kind: 'figma', target: 'figma://' }]);
  } finally {
    assert.equal(path.dirname(temp), path.resolve(tmpdir()));
    assert.ok(path.basename(temp).startsWith('urinsight-handoff-'));
    await rm(temp, { recursive: true, force: true });
  }
});
