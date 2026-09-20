# URINSIGHT Figma Importer v1 — 검증 기록

검증일: 2026-09-20 (Asia/Seoul)

- Branch: `feature/figma-importer-v1`
- Starting HEAD: `3c62f011454d1df4aa128b9a686afb0fb8ec89cf` (`main`)
- 시작 working tree: clean
- 기준: Carousel v6 / Specification Revision 1.10
- 변경 범위: `tools/figma-importer/`만 추가. 기존 src/tests/docs/root manifest/lockfile 변경 없음.

## 자동 검증 결과

| 검증 | 결과 |
| --- | --- |
| 구현 전 `pnpm typecheck` | PASS |
| 구현 전 `pnpm test` | 62/62 PASS |
| 구현 후 `pnpm typecheck` | PASS |
| 구현 후 `pnpm test` | 62/62 PASS |
| plugin `npm --prefix tools/figma-importer run typecheck` | PASS, 공식 Figma API typings 사용 |
| plugin `npm --prefix tools/figma-importer run build` | PASS, code.js + ui.html offline bundle |
| plugin `npm --prefix tools/figma-importer test` | 13/13 PASS, 실제 package 변수 설정, skip 0 |
| Daily `pnpm daily -- --dry-run` | 구현 전후 동일: Found 0, Failed 0, Ready 0 |
| 기존 production/reference 파일 diff | 없음 |

pnpm은 이 환경에서 업데이트 확인용 registry 접근 경고를 출력했지만 실제 typecheck/test/dry-run은 exit 0으로 완료되었습니다. Plugin 의존성 설치는 격리된 npm lockfile을 사용했습니다.

## 실제 package

`processed/2026-09-20/ai-workflow-redesign/`의 `carousel.json`, `cover.png`, `insight.png`, `sources.md`를 읽었습니다. 기존 JSON schema로 business/8페이지를 확인했고 실제 이미지 bytes를 mock API에 전달했습니다. 테스트 전후 모든 package 파일 SHA-256이 동일합니다. 원본을 수정·이동·삭제하지 않았습니다.

`tests/fixtures/business.json`은 이 실제 원고의 사본입니다. 일반 테스트는 생성된 PNG를 메모리에서 사용합니다. 사진은 신규 commit에 포함하지 않습니다. Playwright의 폴더 선택 테스트도 실제 package 경로로 실행했습니다.

## Acceptance coverage

| 요구사항 | 검증 수준 |
| --- | --- |
| 사업 package import, 8개 frame, 1080×1350, 순서 | API contract mock PASS |
| category 색상, anchors, 폰트 크기, 45%/65% overlay | 구현 및 노드 속성 검사 PASS |
| cover/insight 이미지 | 실제 byte 전달, Image Fill 속성, UI PNG decode PASS; 실제 Figma paint 미검증 |
| Pretendard Regular/Bold | 목록 조회/loadFontAsync 및 누락·로드 실패 분기 PASS; 실제 Figma 가용성 미검증 |
| 텍스트 TextNode, highlight 독립 Rectangle | 구조·문자 범위 색상·unlocked 검사 PASS |
| 제목/문단 텍스트 수정, Rectangle resize, 이미지 CROP 전환 | mock 속성 수정 PASS; Figma 마우스 조작 미검증 |
| 9~10페이지 및 돈/인사이트 색상 | API contract mock PASS |
| 재import/수동 수정 보존/rollback | API contract mock PASS |
| 파일 누락/중복/invalid JSON/unsupported category/손상 PNG | unit + built UI PASS |
| 다중 파일·폴더 선택 및 import UI 연결 | Playwright PASS |
| 네트워크/API 소비 없음 | UI 네트워크 요청 0건, manifest none, main bundle은 DOM/Node/network 없는 VM 및 dynamic code generation 금지 환경에서 PASS |
| Daily regression | 기존 62개 테스트와 dry-run PASS, production 변경 없음 |

UI screenshot은 테스트 실행 시 `artifacts/ui-imported.png`에 생성됩니다(Git 제외). 이 화면은 mock controller 결과이며 실제 Figma canvas screenshot이 아닙니다.

## 남은 실제 Figma 검증과 한계

Computer Use의 설치 앱 목록, 실행 프로세스와 Figma 기본 설치 경로에서 Figma Desktop을 찾지 못했습니다. 따라서 local plugin 등록, 실제 Pretendard font load, canvas paint, 텍스트 편집·highlight resize·이미지 crop 핸들 조작, PNG export와 시각 비교는 수행하지 못했습니다. [README의 실제 Figma checklist](README.md#실제-figma-desktop-acceptance-checklist)에서 확인해야 합니다. 자동 검증 통과를 실제 Figma acceptance 통과로 표시하지 않습니다.

Highlight는 Figma text advance와 font size 기반의 편집 가능한 초기 근사치입니다. 브라우저 renderer의 glyph ink bounds 및 keep-all wrapping과 픽셀 단위 일치를 보장하지 않습니다. 텍스트 수정 후 배경 Rectangle/형제 줄의 위치를 자동 동기화하지 않습니다. 길이가 넘치는 원고는 폰트/anchor를 자동 변경하지 않고 경고와 함께 import합니다.

개발 구현/build/자동 검증은 완료했지만 실제 Figma acceptance가 남아 있으므로 전체 acceptance 기준 상태는 **미완료**입니다.
