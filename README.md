# URINSIGHT carousel renderer · v6

구조화된 JSON → React HTML/CSS → Playwright Chromium → 1080 × 1350 PNG.
뉴스 수집, 이미지 생성/검색, Instagram 게시 기능은 포함하지 않습니다.

## 시작

Node.js 22 이상, pnpm 11.19.0 기준입니다.

```sh
pnpm install --frozen-lockfile
pnpm setup:browser
pnpm generate content/sample-insight.json
pnpm compare output/2026-09-16/information-and-judgment
pnpm typecheck
pnpm test
```

`generate`의 날짜는 실행 시점 **Asia/Seoul** 날짜입니다. compare에는 실제 생성 경로를 전달하세요.
첫 설치 후 렌더링은 외부 네트워크 요청 없이 작동합니다. Chromium 버전과 의존성은 lockfile로 고정됩니다.
기본은 Playwright의 headless shell입니다. Windows 브라우저 런타임 설치 오류가 있는 환경에서는 설치된 Chrome/Edge를 명시적으로 선택할 수 있습니다. PowerShell: `$env:URINSIGHT_BROWSER_CHANNEL='chrome'` 또는 `'msedge'`. `validation.json`에 실제 채널과 버전이 기록됩니다. 환경변수를 해제하면 기본 엔진으로 돌아갑니다.
샘플 cover는 단색 개발용 placeholder입니다. `cover.image`를 넣으면 JSON 파일 기준 상대경로 또는 절대경로의 로컬 이미지를 사용합니다. 없는 파일을 지정하면 실패합니다.

Windows에서 Daily 완료 후 수동 Figma 편집으로 이어가려면 repository 루트에서 `npm.cmd run daily:figma`를 실행합니다. 기존 Daily가 전체 성공하면 해당 실행 날짜의 processed 폴더를 한 번 열고 설치된 Figma Desktop을 직접 실행합니다. 브라우저는 자동으로 열지 않습니다. `URINSIGHT_FIGMA_FILE_URL`은 Desktop에서 열고 싶은 preferred file이며 파일 자동 열기는 best-effort입니다. 현재는 Desktop에서 URINSIGHT 파일을 직접 열고 로컬 development plugin인 Importer를 실행합니다. 설정과 오류 처리: [Daily → Figma handoff](docs/DAILY_FIGMA_HANDOFF.md).

## 구조

```text
docs/                 원본 명세·설정, 설계 및 검증 설명
references/v6/        수정하지 않은 원본 PNG 9개, SHA-256 manifest
src/config/           공통 디자인 tokens
src/schema/           Zod 스키마 및 콘텐츠 무결성 검증
src/renderer/         React 템플릿, 이미지 provider, 검증, PNG/contact sheet 생성
src/cli/              generate / compare 명령
content/              완전한 v6 sample JSON
tests/                스키마·브라우저·통합 테스트
output/               날짜/slug별 생성물 (Git 제외)
```

세부사항: [설계](docs/ARCHITECTURE.md), [폰트 라이선스](docs/FONT_LICENSE.md), [검토 보고서](docs/IMPLEMENTATION_REPORT.md).
원본 자료의 수집·게시·commit 제안은 향후 참고 사항이며 이번 단계의 실행 지시가 아닙니다.
