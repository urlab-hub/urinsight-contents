import path from 'node:path';
import { parseDailyArgs, runDaily } from '../daily/runner.js';
import { openWindowsTarget } from './windows-open.js';
import type { OpenTarget } from './windows-open.js';

interface HandoffOptions {
  root: string;
  args?: string[];
  figmaFileUrl?: string;
  log?: (message: string) => void;
  warn?: (message: string) => void;
}
interface Dependencies {
  daily: typeof runDaily;
  open: (target: OpenTarget) => Promise<void>;
}

/** Run the canonical runner once; only its completed result controls handoff. */
export async function runDailyFigma(options: HandoffOptions, dependencies: Partial<Dependencies> = {}) {
  const args = parseDailyArgs(options.args ?? []);
  const root = path.resolve(options.root);
  const log = options.log ?? console.log, warn = options.warn ?? console.warn;
  const result = await (dependencies.daily ?? runDaily)({ root, ...args, log });
  if (result.failed || args.dryRun || !result.results.some(p => p.status === 'success')) return result;

  const processed = path.resolve(root, 'processed', result.date);
  const open = dependencies.open ?? openWindowsTarget;
  const targets: OpenTarget[] = [
    { kind: 'explorer', target: processed },
    { kind: 'figma', target: options.figmaFileUrl?.trim() || 'figma://' },
  ];
  for (const target of targets) {
    try { await open(target); }
    catch (error) {
      warn(`! ${target.kind === 'explorer' ? 'Explorer' : 'Figma'} 열기 실패: ${error instanceof Error ? error.message : String(error)}. Daily 완료 결과는 유지됩니다.`);
    }
  }
  log(`\nFIGMA HANDOFF\nPackage folder: ${processed}\nFigma에서 URINSIGHT Importer를 직접 실행하고 필요한 package만 선택해 주세요.`);
  return result;
}
