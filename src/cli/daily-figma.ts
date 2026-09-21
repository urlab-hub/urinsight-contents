import { runDailyFigma } from '../handoff/daily-figma.js';

try {
  const result = await runDailyFigma({
    root: process.cwd(),
    args: process.argv.slice(2),
    figmaFileUrl: process.env.URINSIGHT_FIGMA_FILE_URL,
  });
  if (result.failed) process.exitCode = 1;
} catch (error) {
  console.error(`Daily failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
