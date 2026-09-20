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

초기 v1 구현 시점에는 Computer Use의 설치 앱 목록, 실행 프로세스와 Figma 기본 설치 경로에서 Figma Desktop을 찾지 못했습니다. 당시 local plugin 등록, 실제 Pretendard font load, canvas paint, 텍스트 편집·highlight resize·이미지 crop 핸들 조작, PNG export와 시각 비교는 수행하지 못했습니다. 아래 runtime hotfix에서 UI 실행을 추가 확인했으며, 나머지는 [README의 실제 Figma checklist](README.md#실제-figma-desktop-acceptance-checklist)에 남아 있습니다. 자동 검증 통과를 전체 실제 Figma acceptance 통과로 표시하지 않습니다.

Highlight는 Figma text advance와 font size 기반의 편집 가능한 초기 근사치입니다. 브라우저 renderer의 glyph ink bounds 및 keep-all wrapping과 픽셀 단위 일치를 보장하지 않습니다. 텍스트 수정 후 배경 Rectangle/형제 줄의 위치를 자동 동기화하지 않습니다. 길이가 넘치는 원고는 폰트/anchor를 자동 변경하지 않고 경고와 함께 import합니다.

개발 구현/build/자동 검증은 완료했지만 실제 Figma acceptance가 남아 있으므로 전체 acceptance 기준 상태는 **미완료**입니다.

## Actual Figma Runtime Hotfix — 2026-09-20

시작 commit: `71301a27ac46283312f8ca27cafcf1c6e6088ca7`. 같은 feature branch에서 MAIN runtime 호환성만 수정했습니다.

### 원인과 수정

- 기존 MAIN `dist/code.js`의 17063행에 Zod 4.6.5의 `v4/core/json-schema-generator.js`에서 온 주석이 남아 있었습니다. 주석의 ``inline `import()` of an ESM path``가 raw-source import-expression 검사의 거부 조건에 해당했습니다. 실제 dynamic import, import.meta, static import/export statement는 없었습니다.
- 기존 `legalComments: 'none'`만으로는 일반 주석이 제거되지 않습니다. ES2015 target만 적용한 별도 메모리 build에서도 `import()` 주석 1개가 남는 것을 확인했습니다. MAIN에만 `minifyWhitespace: true`를 적용해 주석을 제거했습니다. 단순 정규식 문자열 치환으로 dependency 코드를 수정하지 않습니다.
- MAIN target은 ES2017 → ES2015, UI는 ES2017 유지입니다. MAIN/UI build options를 분리했습니다.
- Zod util/doc/compile에는 `const F = Function; new F(...)` 형태의 capability probe 및 JIT 경로도 있었습니다. MAIN 전용 esbuild inject가 native 코드 생성자 참조를 항상 throw하는 함수로 바꿉니다. Zod의 기존 capability probe는 실패를 처리하고 원래의 interpreted validation 경로를 사용합니다. Production schema/dependency 원본을 패치하지 않습니다.
- 기존 VM 검사는 코드 생성 실패를 Zod가 내부에서 처리하므로 통과할 수 있었습니다. 새 검사는 원시 문자열과 ES2015 AST를 모두 검사하고, native Function 접근 횟수가 0임을 확인합니다. 실제 fixture의 성공뿐 아니라 잘못된 highlight의 schema 거절도 확인합니다.

주석까지 포함하는 source scan의 배경: [Endo/SES 공식 import-expression 검사](https://github.com/endojs/endo/security/advisories/GHSA-9c4h-3f7h-322r). Figma 내부 구현 전체를 재현하는 테스트는 아니며, 이번 오류에 해당하는 거부 조건을 보수적으로 검사합니다.

### 검증

- MAIN build audit: Acorn `ecmaVersion: 2015`, `sourceType: script` PASS.
- import expressions / import.meta / module declarations / dynamic code generation references / comments: 모두 **0**.
- Regression guard: 원본 Zod 주석, dynamic import, static import/export, import.meta, async/await, object spread, optional chaining, eval, Function alias를 거절.
- Plugin typecheck/build PASS; plugin tests **15/15 PASS**, 실제 package 테스트 포함, skip 0.
- Root `pnpm typecheck` PASS; `pnpm test` **62/62 PASS**.
- 실제 Figma Desktop `126.9.10`의 기존 등록 plugin을 실행해 **UI 표시 및 Ready 상태 확인**. 기존 `possible import expression rejected` 오류 없이 MAIN이 실행되어 showUI까지 도달했습니다. 이번 hotfix에서 캔버스 import/디자인 편집성 전체 acceptance를 다시 수행한 것은 아닙니다.
- UI bundle 및 `src/`의 layer/schema/token 코드는 그대로입니다. Root package/lock, Daily Runner, renderer, production schema 변경 없음.

`dist/`는 기존 정책대로 Git 제외 생성물입니다. 다른 checkout에서는 plugin 의존성 설치 후 build가 필요합니다.
