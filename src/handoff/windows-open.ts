import { execFile } from 'node:child_process';
import path from 'node:path';

export type OpenTarget = { kind: 'explorer'; target: string } | { kind: 'figma-app' };
export interface LaunchRequest {
  file: string;
  args: string[];
  options: { env: NodeJS.ProcessEnv; windowsHide: boolean; timeout: number; shell: false };
}
type Execute = (request: LaunchRequest) => Promise<void>;

// The script is constant. Explorer paths travel as child environment data;
// preferred file URLs are never launched. Only the launcher console is hidden;
// Explorer/Figma are the visible interactive applications requested by the user.
const openScript = String.raw`
$ErrorActionPreference = 'Stop'
function Find-FigmaDesktop {
  $keys = @(
    'Registry::HKEY_CLASSES_ROOT\figma\shell\open\command',
    'Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\App Paths\Figma.exe',
    'Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\App Paths\Figma.exe'
  )
  foreach ($key in $keys) {
    $item = Get-Item -LiteralPath $key -ErrorAction SilentlyContinue
    if ($null -eq $item) { continue }
    $command = [Environment]::ExpandEnvironmentVariables([string]$item.GetValue(''))
    # Extract only the executable; never execute the registry command or its arguments.
    $candidate = $null
    if ($command -match '^\s*"([^"]+\.exe)"(?:\s|$)') { $candidate = $Matches[1] }
    elseif ($command -match '^\s*([^"\r\n]+\.exe)\s*$') { $candidate = $Matches[1] }
    elseif ($command -match '^\s*([^\s"]+\.exe)(?:\s|$)') { $candidate = $Matches[1] }
    if ($candidate -and [IO.Path]::IsPathRooted($candidate) -and
        [IO.Path]::GetFileName($candidate) -ieq 'Figma.exe' -and
        (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate }
  }
  if ($env:LOCALAPPDATA) {
    $install = Join-Path $env:LOCALAPPDATA 'Figma'
    $candidate = Join-Path $install 'Figma.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    $versions = Get-ChildItem -LiteralPath $install -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^app-\d+\.\d+\.\d+(\.\d+)?$' } |
      Sort-Object { [version]$_.Name.Substring(4) } -Descending
    foreach ($version in $versions) {
      $candidate = Join-Path $version.FullName 'Figma.exe'
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
  }
  throw 'Figma Desktop installation not found. Install Figma Desktop and retry; no browser was opened.'
}
try {
  if ($env:URINSIGHT_HANDOFF_KIND -eq 'explorer') {
    if (-not (Test-Path -LiteralPath $env:URINSIGHT_HANDOFF_TARGET -PathType Container)) {
      throw 'Processed folder does not exist'
    }
    Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $env:URINSIGHT_HANDOFF_TARGET + '"') -ErrorAction Stop
  } else {
    $figmaExe = Find-FigmaDesktop
    Start-Process -FilePath $figmaExe -ErrorAction Stop
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
  if (target.kind === 'explorer' && (!path.win32.isAbsolute(target.target) || /["\x00-\x1f]/.test(target.target))) {
    throw new Error('Explorer requires an absolute Windows folder path');
  }
  await (dependencies.execute ?? execute)({
    file: 'powershell.exe',
    args: ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(openScript, 'utf16le').toString('base64')],
    options: {
      shell: false, windowsHide: true, timeout: 10000,
      env: { ...(dependencies.env ?? process.env), URINSIGHT_HANDOFF_KIND: target.kind, URINSIGHT_HANDOFF_TARGET: target.kind === 'explorer' ? target.target : '' },
    },
  });
}
