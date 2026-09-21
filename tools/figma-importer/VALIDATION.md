# URINSIGHT Figma Importer v1 — 검증 기록

초기 검증일: 2026-09-20 (Asia/Seoul)
Desktop acceptance 완료 기록일: 2026-09-21 (Asia/Seoul)

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

## 초기 자동 검증의 acceptance coverage (2026-09-20)

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

## 초기 실제 Figma 검증 제한과 알려진 한계

초기 v1 구현 시점에는 Figma Desktop을 찾지 못해 실제 canvas import와 편집을 검증하지 못했습니다. 아래 runtime hotfix에서 UI 실행을 확인했고, 이후 사용자가 실제 Desktop에서 package import와 편집 workflow를 완료했습니다. 현재 완료 범위와 증거 출처는 아래 Desktop acceptance 기록을 따릅니다. 위 표의 미검증 표시는 초기 자동 검증 시점의 범위입니다.

Highlight는 Figma text advance와 font size 기반의 편집 가능한 초기 근사치입니다. 브라우저 renderer의 glyph ink bounds 및 keep-all wrapping과 픽셀 단위 일치를 보장하지 않습니다. 텍스트 수정 후 배경 Rectangle/형제 줄의 위치를 자동 동기화하지 않습니다. 길이가 넘치는 원고는 폰트/anchor를 자동 변경하지 않고 경고와 함께 import합니다.

현재 v1 editable workflow의 실제 Figma Desktop acceptance는 **완료**입니다(아래 사용자 확인 기록 참조). 알려진 편집 동작의 한계는 그대로 유지됩니다.

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

## 실제 Figma Desktop acceptance 완료 — 2026-09-21

- Branch: `feature/figma-importer-v1`
- Before SHA: `2e6d4765f10834ceb2af907719634a010063fe7f`
- Checkpoint tag: `urinsight-figma-importer-v1.0.0`
- 증거 출처: 사용자가 실제 Figma Desktop 검증 완료 결과를 보고했습니다. 이번 체크포인트 작업에서 에이전트가 Desktop 조작을 재실행한 것은 아닙니다.

| 실제 Desktop acceptance 항목 | 결과 |
| --- | --- |
| Plugin UI 실행 | PASS — 사용자 확인 |
| 실제 package import | PASS — 사용자 확인 |
| 8개 frame 생성 | PASS — 사용자 확인 |
| TextNode 편집 | PASS — 사용자 확인 |
| 줄바꿈 수정 | PASS — 사용자 확인 |
| Highlight Rectangle 수정 | PASS — 사용자 확인 |
| Image crop/position 수정 | PASS — 사용자 확인 |
| Overlay opacity 수정 | PASS — 사용자 확인 |
| 실제 editable workflow | PASS — 사용자 확인 |

**Figma Importer v1 editable workflow acceptance: 완료.** PNG export/시각 비교, Desktop 재import 시 수동 수정 보존, 세부 typography/anchor/색상/크기 수치의 별도 실측은 이번 사용자 완료 보고에 포함되지 않았습니다. 해당 항목을 추가 검증 완료로 표시하지 않습니다.

이번 체크포인트는 `VALIDATION.md`와 plugin `README.md`의 상태 기록만 갱신합니다. 기존 Daily Runner / renderer / schema 및 plugin 구현 변경은 없으며, `daily:figma` helper 작업은 시작하지 않았습니다.

### 체크포인트 자동 검증 재실행 — 2026-09-21

| 명령 | 결과 |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm test` | 62/62 PASS, fail 0, skip 0 |
| `npm --prefix tools/figma-importer run typecheck` | PASS |
| `npm --prefix tools/figma-importer run build` | PASS, offline code.js + ui.html |
| `npm --prefix tools/figma-importer test` | 15/15 PASS, fail 0, skip 0; 실제 package 포함 |

실제 package 테스트에는 `URINSIGHT_FIGMA_TEST_PACKAGE=processed/2026-09-20/ai-workflow-redesign`의 절대 경로를 지정했습니다. 원본 package bytes 보존 검사와 built UI 폴더 선택 테스트도 통과했습니다. MAIN ES2015 audit의 import expressions / import.meta / module declarations / dynamic code generation references / comments는 모두 0입니다. Root에는 build script가 없으므로 build 검증은 plugin의 build script로 수행했습니다. `dist/`와 UI screenshot은 기존 정책대로 Git 제외 생성물입니다.
