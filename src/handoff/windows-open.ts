import { execFile } from 'node:child_process';
import path from 'node:path';

export type OpenTarget = { kind: 'explorer' | 'figma'; target: string };
export interface LaunchRequest {
  file: string;
  args: string[];
  options: { env: NodeJS.ProcessEnv; windowsHide: boolean; timeout: number; shell: false };
}
type Execute = (request: LaunchRequest) => Promise<void>;

// The script is constant. Paths/URLs travel as child environment data and are
// never evaluated as PowerShell/cmd source. Only the launcher console is hidden;
// Explorer/Figma are the visible interactive applications requested by the user.
const openScript = `
$ErrorActionPreference = 'Stop'
try {
  if ($env:URINSIGHT_HANDOFF_KIND -eq 'explorer') {
    if (-not (Test-Path -LiteralPath $env:URINSIGHT_HANDOFF_TARGET -PathType Container)) {
      throw 'Processed folder does not exist'
    }
    Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $env:URINSIGHT_HANDOFF_TARGET + '"') -ErrorAction Stop
  } else {
    if ($env:URINSIGHT_HANDOFF_TARGET.StartsWith('figma:', [StringComparison]::OrdinalIgnoreCase) -and
        -not (Test-Path -LiteralPath 'Registry::HKEY_CLASSES_ROOT\\figma\\shell\\open\\command')) {
      throw 'Figma Desktop protocol is unavailable; install Figma Desktop or set URINSIGHT_FIGMA_FILE_URL'
    }
    Start-Process -FilePath $env:URINSIGHT_HANDOFF_TARGET -ErrorAction Stop
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

const execute: Execute = request => new Promise((resolve, reject) => {
  execFile(request.file, request.args, request.options, (error, _stdout, stderr) => {
    if (!error) { resolve(); return; }
    reject(new Error(stderr.trim() || (error.killed ? 'Windows opener timed out after 10 seconds' : `Windows opener failed (${error.code ?? 'unknown'})`)));
  });
});

/** Allow only Figma links, never an executable path or an arbitrary URI handler. */
export function validateFigmaUrl(value: string): void {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('URINSIGHT_FIGMA_FILE_URL must be a Figma https:// or figma:// URL'); }
  const fileRoute = /^\/(?:design|file|proto|board|slides)\/[^/]+/;
  const isWeb = url.protocol === 'https:' && ['figma.com', 'www.figma.com'].includes(url.hostname) && fileRoute.test(url.pathname);
  const isDesktop = value === 'figma://' || (url.protocol === 'figma:' && /^figma:\/\//i.test(value) && fileRoute.test(`/${url.hostname}${url.pathname}`));
  if ((!isWeb && !isDesktop) || url.username || url.password || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error('URINSIGHT_FIGMA_FILE_URL must be a Figma https:// or figma:// URL');
  }
}

export async function openWindowsTarget(target: OpenTarget, dependencies: {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  execute?: Execute;
} = {}): Promise<void> {
  if ((dependencies.platform ?? process.platform) !== 'win32') throw new Error('Desktop handoff is supported on Windows only');
  if (target.kind === 'figma') validateFigmaUrl(target.target);
  else if (!path.win32.isAbsolute(target.target) || /["\x00-\x1f]/.test(target.target)) {
    throw new Error('Explorer requires an absolute Windows folder path');
  }
  await (dependencies.execute ?? execute)({
    file: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(openScript, 'utf16le').toString('base64')],
    options: {
      shell: false, windowsHide: true, timeout: 10000,
      env: { ...(dependencies.env ?? process.env), URINSIGHT_HANDOFF_KIND: target.kind, URINSIGHT_HANDOFF_TARGET: target.target },
    },
  });
}
