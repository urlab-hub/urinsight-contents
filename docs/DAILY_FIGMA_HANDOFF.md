# Daily → Figma 수동 편집 handoff

기준 checkpoint: `a7487ddaa6b730b2e1e1d59bddaeffc3a0792ee6` / `urinsight-figma-importer-v1.0.0`.

repository 루트의 PowerShell에서 실행합니다.

```powershell
npm.cmd run daily:figma
```

1. 기존 `parseDailyArgs` / `runDaily`를 그대로 호출합니다.
2. 기존 Daily Runner가 PNG/contact-sheet를 생성하고 성공 package를 processed로 이동합니다.
3. 전체 성공한 실행에서 `processed/<runDaily가 반환한 날짜>` 폴더를 Explorer에 한 번 엽니다. 여러 package가 성공해도 날짜 폴더 하나만 엽니다.
4. 설정된 Figma 파일 URL을 열거나, 설정이 없으면 Figma Desktop 실행을 시도합니다.
5. 사용자가 Figma Importer를 직접 실행하고 수정할 package의 파일을 선택한 뒤 Import를 누릅니다.

Plugin 실행, Import 버튼 클릭, MCP/API, 파일 자동 업로드, Figma → JSON sync는 수행하지 않습니다. Daily Runner는 빠른 자동 완성본을 만들고 Figma Importer는 필요한 콘텐츠의 수동 편집 공간을 제공합니다.

## 실행 조건과 오류

| Daily 결과 | Explorer/Figma 열기 | 명령 종료 코드 |
| --- | --- | --- |
| 성공 package 1개 이상, 실패 0개 | Explorer 1회 → Figma 1회 시도 | 0 |
| 실패 또는 예외 | 열지 않음 | 1 |
| 성공/실패가 섞인 실행 | 열지 않음; 기존 성공 결과는 유지 | 1 |
| dry-run | 열지 않음 | 기존 Daily 결과에 따름 |
| package 0개 | 열지 않음 | 0 |

날짜는 helper가 새로 계산하지 않습니다. 자정을 넘어 완료되어도 Daily가 반환한 실행 날짜를 사용합니다. 원래 package의 위치·출력·processed 정책을 바꾸지 않습니다.

Explorer/Figma 실행 오류, 잘못된 URL, 미설치 앱, Windows 이외의 환경은 경고만 출력합니다. Explorer 열기에 실패해도 Figma 열기를 시도합니다. 앱 실행 오류 때문에 성공한 PNG/processed 결과를 되돌리거나 종료 코드를 실패로 바꾸지 않습니다. 실행 시도는 각각 최대 10초이며, 앱을 닫을 때까지 기다리지 않습니다. OS에 실행을 요청한 뒤 실제 창 표시/파일 접근 권한까지 확인하는 기능은 없습니다.

기존 옵션도 그대로 사용할 수 있습니다.

```powershell
npm.cmd run daily:figma -- --dry-run
npm.cmd run daily:figma -- --only ai-workflow-redesign
```

## URINSIGHT_FIGMA_FILE_URL 설정

설정은 사용자별 환경변수입니다. URL을 repository 코드나 공용 설정 파일에 저장하지 않습니다. `.env` 파일을 자동으로 읽는 기능은 추가하지 않았습니다.

현재 PowerShell 세션에서 사용할 때 (`FILE_KEY`를 실제 Figma 파일 키로 교체):

```powershell
$env:URINSIGHT_FIGMA_FILE_URL = 'https://www.figma.com/design/FILE_KEY/URINSIGHT'
npm.cmd run daily:figma
```

Windows 사용자 환경변수로 유지하려면:

```powershell
[Environment]::SetEnvironmentVariable('URINSIGHT_FIGMA_FILE_URL', 'https://www.figma.com/design/FILE_KEY/URINSIGHT', 'User')
```

영구 설정 후에는 새 PowerShell을 열어 실행합니다. 현재 세션에 바로 적용하려면 위 `$env:` 설정도 사용하세요.

설정 해제:

```powershell
Remove-Item Env:URINSIGHT_FIGMA_FILE_URL -ErrorAction SilentlyContinue
[Environment]::SetEnvironmentVariable('URINSIGHT_FIGMA_FILE_URL', $null, 'User')
```

설정이 없거나 공백이면 Windows에 등록된 `figma://` handler로 Desktop 실행을 시도합니다. 해당 handler가 없으면 경고합니다. 파일 링크는 `https://figma.com/...`, `https://www.figma.com/...` 또는 `figma://...`의 `design`, `file`, `proto`, `board`, `slides` 경로를 지원합니다. 실행 파일 경로, 외부 사이트, plugin 실행 URL은 받지 않습니다.

HTTPS 링크는 원래 URL을 OS 기본 handler로 엽니다. 기본 브라우저가 열릴 수 있으며 Figma의 [Open links in desktop app 설정](https://help.figma.com/hc/en-us/articles/360039824334-Open-links-in-the-desktop-app)을 따릅니다. helper가 URL을 임의로 Desktop 링크로 바꾸지는 않습니다.

## Windows 실행 방식

- `explorer.exe`에 processed 날짜 폴더를 인자로 전달합니다. `Test-Path -LiteralPath`로 폴더 존재를 먼저 확인합니다.
- Figma 링크는 PowerShell `Start-Process -FilePath`로 Windows URL handler에 전달합니다. Desktop protocol은 등록 여부를 먼저 확인합니다.
- Node `execFile`은 `shell: false`, `windowsHide: true`, `timeout: 10000`으로 짧은 PowerShell launcher를 실행합니다. 사용자가 요청한 Explorer/Figma 창은 표시하고 launcher의 콘솔 창만 숨깁니다.
- PowerShell script는 고정된 UTF-16LE encoded command이며 경로/URL은 자식 프로세스 환경변수로만 전달합니다. 명령 소스에 사용자 값을 보간하지 않습니다. 한글·공백·`&`·따옴표 중 Windows 경로에 허용되는 문자가 명령으로 실행되지 않습니다.

참고: [Node execFile](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback), [PowerShell Start-Process](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process).

## 검증과 범위

`tests/daily-figma.test.ts`는 조건별 open 횟수·반환 날짜·인자 재사용·warning 처리를 검증합니다. 실제 PowerShell bridge 테스트에서는 앱 실행 함수를 대체해 Unicode/특수문자의 원형 보존을 확인합니다. 실제 Daily 통합 테스트는 OS 임시 디렉터리에 package를 생성하고 PNG/contact-sheet 및 processed 이동 이후에만 handoff가 발생하는지 확인합니다. 테스트는 사용자 Explorer/Figma를 열지 않습니다.

```powershell
pnpm typecheck
pnpm test
npm.cmd --prefix tools/figma-importer run typecheck
npm.cmd --prefix tools/figma-importer run build
npm.cmd --prefix tools/figma-importer test
```

Plugin의 최초 등록과 편집 방법은 [Figma Importer README](../tools/figma-importer/README.md)를 참고하세요. Helper는 plugin build/등록도 자동 수행하지 않습니다.
