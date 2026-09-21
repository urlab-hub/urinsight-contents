# URINSIGHT Figma Editable Importer v1

**Daily Runner: 빠른 자동 완성본**

**Figma Importer: 수정이 필요한 콘텐츠의 editable version**

동일한 INBOX package를 두 경로에서 사용합니다. Daily Runner는 기존대로 PNG/contact-sheet를 만들고, 이 로컬 Figma plugin은 1080 × 1350 editable frame을 만듭니다. JSON은 canonical source, Figma는 최종 수동 편집 공간입니다. JSON → Figma 단방향이며 원본·inbox·processed·output 파일을 수정하거나 이동하지 않습니다. Daily 완료 후에는 processed에 보존된 원래 package를 선택해도 됩니다.

## 1. 준비 및 build

필요한 환경: repository의 Node.js 22 이상/pnpm, Figma Desktop, 로컬 Pretendard Regular와 Bold. Figma가 사용할 수 있는 폰트는 npm renderer용 웹폰트와 별개입니다. Plugin은 폰트를 다운로드하거나 다른 폰트로 대체하지 않습니다.

PowerShell에서 repository 루트로 이동한 뒤 실행합니다.

```powershell
cd "C:\Users\Jungsoo Bae\Documents\ChatGPT\URINSIGHT_콘텐츠\urinsight-contents"
pnpm install --frozen-lockfile
npm --prefix tools/figma-importer ci --ignore-scripts
npm --prefix tools/figma-importer run typecheck
npm --prefix tools/figma-importer run build
```

기존 root 의존성을 설치한 상태라면 첫 install은 생략합니다. `npm ci`는 plugin의 별도 `package-lock.json`을 사용합니다. root package.json/pnpm lock/workspace 설정은 변경하지 않습니다. TypeScript, tsx, zod는 설치된 root 의존성을 재사용하며 plugin 개발 의존성은 공식 Figma typings, esbuild, MAIN 구문 검사용 Acorn입니다. `--ignore-scripts` 상태에서도 esbuild의 플랫폼별 선택 의존성으로 build됩니다. 설치 시 optional dependencies를 제외하지 마세요.

MAIN은 ES2015 IIFE로, UI는 기존 ES2017로 build합니다. MAIN에서는 주석을 제거하고 dependency의 코드 생성 기능을 차단합니다. build 중 raw-source 검사와 ES2015 parser 검사를 통과해야 code.js를 저장합니다. `possible import expression rejected` 오류가 있던 이전 build를 사용했다면 의존성 설치/build 후 Figma에서 plugin을 종료하고 다시 실행하세요.

build 결과:

```text
tools/figma-importer/
├─ manifest.json
└─ dist/
   ├─ code.js
   └─ ui.html
```

`dist/`는 생성물로 Git에서 제외합니다. 처음 clone했거나 소스를 변경했다면 build를 실행하세요. 다른 PC로 옮길 때는 manifest.json과 dist 폴더를 함께 옮깁니다. 실행 시 Node.js나 개발 서버는 필요 없습니다.

## 2. Figma Desktop에 등록

1. Figma Desktop을 열고 편집 가능한 **Figma Design 파일**을 엽니다(FigJam/Dev Mode 대상 아님).
2. 캔버스에서 우클릭 → **Plugins → Development → Import plugin from manifest…**를 선택합니다. Quick Actions에서 `Import plugin from manifest`를 검색해도 됩니다.
3. 이 repository의 `tools/figma-importer/manifest.json`을 선택합니다. `dist` 안의 파일을 선택하는 것이 아닙니다.
4. **Plugins → Development → URINSIGHT Figma Editable Importer v1**을 실행합니다.

manifest의 `id`는 로컬 개발 식별자입니다. Community 게시/API 연동을 설정할 필요가 없습니다. 등록 메뉴나 실행 권한이 없으면 파일의 편집 권한과 Figma Desktop 사용 여부를 확인하세요. UI가 없거나 code.js 오류가 나오면 build 성공 여부와 dist 위치를 확인합니다.

등록 방식과 로컬 ID 형식은 [Figma 공식 plugin samples](https://github.com/figma/plugin-samples)와 [공식 sample manifest](https://github.com/figma/plugin-samples/blob/main/barchart/manifest.json)를 따릅니다.

## 3. Package 선택 및 import

```text
ai-workflow-redesign/
├─ carousel.json  필수
├─ cover.png      필수
├─ insight.png    필수
└─ sources.md     선택, 렌더링에는 사용하지 않음
```

1. **Select Package Files**를 누릅니다.
2. 한 package 안의 `carousel.json`, `cover.png`, `insight.png`를 Ctrl 키로 함께 선택하고 열기를 누릅니다.
3. 또는 **폴더 선택**, 파일 3개 drag & drop, package 폴더 하나 drag & drop을 사용합니다. 폴더 drop은 그 폴더 바로 아래 파일만 읽습니다. 폴더 선택이 작동하지 않으면 다중 파일 선택으로 돌아갑니다.
4. 파일 3개의 체크 표시, Slug, Category와 `Ready`를 확인합니다.
5. **Import to Figma**를 누릅니다. 사용 가능한 `Pretendard`의 실제 `Regular`/`Bold` style을 조회하고 `loadFontAsync`로 로드합니다.
6. 생성된 Section으로 viewport가 이동합니다. `Imported`의 폰트 이름과 검토 경고를 확인합니다.

파일을 새로 선택하면 이전 선택 전체가 교체됩니다. 여러 package를 한꺼번에 넣으면 동일 이름 파일 중복 오류가 납니다. 이름은 대소문자를 구분하지 않습니다. JSON은 기존 strict schema를 그대로 검증하므로 category 값은 `business`, `money`, `insight`입니다. UI에는 사업/돈/인사이트로 표시합니다.

v1은 PNG pair만 지원합니다. JSON 1 MB 이하, PNG 각 32 MB 이하·가로/세로 각각 최대 4096 px입니다([Figma Image API 제한](https://developers.figma.com/docs/plugins/api/properties/figma-createimage/)). JPG/WebP package는 별도로 PNG pair를 준비하세요. 원본 파일의 확장자만 바꾸면 안 됩니다. ZIP은 미리 압축 해제하세요. JSON의 `cover.image` 경로는 읽지 않으며 선택한 cover.png를 사용하고 경고합니다.

## 4. 결과와 Layers panel

상위 Section: `URINSIGHT — <slug>`. 각 페이지는 가로 1080, 세로 1350, 간격 100px로 왼쪽부터 배열됩니다. 다시 import하면 `(2)`, `(3)` 등 사용하지 않은 이름의 새 세트를 기존 캔버스 콘텐츠 아래에 생성합니다. 기존 세트와 수동 수정 내용을 덮어쓰지 않습니다.

```text
URINSIGHT — ai-workflow-redesign
├─ 01 COVER
│  ├─ Background Image             Rectangle + Image Fill, FILL
│  ├─ Black Overlay                Rectangle, opacity 45%
│  ├─ Brand                        TextNode
│  ├─ Title                        투명한 편집용 Frame
│  │  ├─ Line 01                   TextNode
│  │  ├─ Line 02                   TextNode
│  │  ├─ Highlight Background 03   독립 Rectangle
│  │  └─ Line 03 — Highlight Text  TextNode, 강조 구절만 흰색
│  ├─ Category                     TextNode
│  └─ Footer                       TextNode
├─ 02 BODY 01 … 06 BODY 05
│  ├─ Background
│  ├─ Brand / Number               각각 TextNode (Number는 본문 항목 번호)
│  ├─ Subtitle                     Frame: Highlight Background + Line TextNode
│  ├─ Paragraph 01 / 02 / 03       semantic paragraph별 TextNode
│  └─ Key Sentence                 category 색상 TextNode
├─ 07 SUMMARY
│  ├─ Background / Label
│  ├─ Headline                     Frame: Highlight Background + Line TextNode
│  ├─ Paragraph 01 / 02 / …
│  └─ Key Sentence                 Frame: Highlight Background + Line TextNode
└─ 08 INSIGHT
   ├─ Background Image / Black Overlay (opacity 65%)
   ├─ Brand
   ├─ Headline                     Frame: Highlight Background + Line TextNode
   ├─ Slogan
   └─ Footer Brand
```

BODY 6~7개도 기존 schema가 허용하므로 총 9~10페이지를 생성합니다. SUMMARY/INSIGHT는 항상 마지막 두 페이지입니다. 출력 페이지 전체를 PNG로 합치거나 텍스트를 vector/path로 변환하지 않습니다.

## 5. 텍스트·줄바꿈·highlight 수정

- Layers에서 `Title > Line 01`, `Headline > Line …` 또는 `Paragraph 01`을 선택하고 텍스트 편집 모드로 들어갑니다. 문구를 바꾸거나 Enter로 줄을 나눕니다.
- COVER의 titleLines 3개는 각각 TextNode입니다. SUMMARY/INSIGHT의 headlineLines, BODY의 paragraphLines/keySentenceLines가 있으면 초기 줄바꿈에 반영합니다. 없으면 headline은 로드한 Figma 폰트의 폭을 측정해 단어와 강조 구절을 보존하며 나눕니다. 본문은 고정 폭에서 Figma가 자동 wrapping합니다.
- 오른쪽 Text 패널에서 font size, line height, letter spacing을 수정합니다. 텍스트 위치는 X/Y나 드래그로 바꿉니다.
- `Highlight Background …`를 선택하면 Rectangle의 X/Y, W/H, Fill 색상을 직접 수정할 수 있습니다. 상하좌우 크기를 조정해 padding 느낌을 바꿉니다.
- Highlight의 텍스트는 위에 있는 `Line … — Highlight Text`입니다. **한 줄을 하나의 TextNode로 유지**하고 강조 범위에 흰색 fill을 적용합니다. 글자를 조각내지 않아 문장 편집이 쉽고, 배경은 별도 레이어입니다.
- 텍스트 수정 후 Rectangle은 자동으로 늘어나거나 이동하지 않습니다. 줄별 TextNode의 형제 레이어도 자동 재배치되지 않습니다. 새 줄이 생기면 아래 줄과 배경을 함께 이동·resize하세요. 강조 구절을 바꾸면 해당 문자 범위의 흰색 fill도 직접 조정합니다.
- Category는 `Category` TextNode의 Fill에서 바꿉니다. 다른 강조색과 brand 색상도 각각 편집할 수 있습니다.
- 모든 최종 레이어는 unlocked입니다. Title/Headline 편집용 Frame의 clipping은 꺼져 있고, 최종 페이지 Frame의 clipping은 켜져 있습니다.

초기 highlight 배경은 글자 advance 폭을 기준으로 좌 최대 5px/우 최대 7px를 더합니다. 인접 공백이 있으면 공백 폭의 절반에서 1px를 뺀 값으로 제한하고 인접 글자에는 추가 padding을 주지 않습니다. 세로는 font size를 line box 가운데 놓고 기존 top/bottom token을 적용합니다. **브라우저 renderer의 실제 glyph ink bounds와 완전히 동일한 계산은 아닙니다.** Rectangle 편집성을 우선하며 사용자가 보정할 수 있습니다.

## 6. 이미지·overlay 수정

`Background Image`를 선택하고 오른쪽 Fill의 이미지 미리보기를 열어 Crop 모드에서 이미지 위치/확대 비율을 바꿉니다. 초기값은 가운데 정렬 FILL로 object-fit: cover에 해당합니다. `Black Overlay`는 별도 검정 Rectangle입니다. 레이어 Opacity를 조정하면 cover 45%, insight 65% 초기값을 자유롭게 변경할 수 있습니다.

## 7. PNG export

1. 전체 Section이 아닌 내보낼 **페이지 Frame**을 선택합니다. 8개를 Shift로 함께 선택할 수도 있습니다.
2. 오른쪽 Export 영역에서 미리 설정된 PNG / 1x를 확인합니다.
3. Export를 눌러 원하는 로컬 위치에 저장합니다. 각 페이지는 1080 × 1350 PNG입니다.
4. 줄 잘림, highlight 크기, 이미지 crop과 overlay를 확인한 뒤 사용합니다. Figma export는 기존 Daily output 경로에 자동 저장되지 않습니다.

## 8. 오류와 알려진 한계

| 메시지/현상 | 조치 |
| --- | --- |
| carousel.json / cover.png / insight.png missing | 한 package의 필수 파일 3개를 함께 선택 |
| invalid JSON / 형식 오류 | 표시된 JSON 경로와 기존 schema 규칙 확인 |
| unsupported category | business / money / insight 사용 |
| PNG 오류 | 확장자가 아닌 실제 이미지 형식, 파일 손상, 용량/크기 확인 |
| Pretendard Regular/Bold unavailable | 로컬 Pretendard의 두 style 설치와 Figma Desktop 재실행; 임의 대체 없음 |
| 본문/강조문장 겹침 또는 너비 경고 | import된 TextNode/Rectangle에서 원고·줄바꿈·위치를 직접 검토 |

Daily의 `designTokens(true)`와 coverOverlay, 기존 contentSchema를 읽기 전용 재사용합니다. renderer·schema·package processing·CLI 코드를 import하거나 수정하지 않습니다(schema와 tokens만 build에 포함). font size/anchor를 자동 축소·이동하지 않습니다. Figma wrapping/폰트 metrics가 브라우저와 달라 보일 수 있고, 내용이 길면 경고와 함께 editable 결과를 남깁니다. 따라서 **schema-valid가 Daily 레이아웃 검증 통과를 의미하지는 않습니다.**

Plugin 실행 코드는 외부 API/Figma MCP/ChatGPT API, OS 경로 접근, 파일 쓰기, 게시, JSON sync를 사용하지 않습니다. manifest의 networkAccess는 `none`입니다. 최초 개발 의존성 설치에는 네트워크가 필요하며, Figma 문서 자체의 저장/동기화는 Figma 앱 동작을 따릅니다.

**v1 editable workflow Desktop acceptance 완료 (2026-09-21, 사용자 확인).** 실제 package import, 8개 frame 생성과 텍스트·줄바꿈·highlight·이미지·overlay 편집을 확인했습니다. 체크포인트 tag는 `urinsight-figma-importer-v1.0.0`이며, 검증 출처와 범위는 [VALIDATION.md](VALIDATION.md)에 기록했습니다.

## 9. 개발 검증

repository 루트에서:

```powershell
pnpm typecheck
pnpm test
pnpm daily -- --dry-run
npm --prefix tools/figma-importer run typecheck
npm --prefix tools/figma-importer run build
npm --prefix tools/figma-importer test
```

브라우저 UI 테스트는 기존 Playwright 환경을 재사용합니다. 브라우저가 없다면 기존 `pnpm setup:browser`로 준비합니다. `test` 전에 build해야 현재 소스의 bundle을 테스트합니다.

실제 local-only package의 읽기 전용 테스트(존재하는 경로로 변경):

```powershell
$env:URINSIGHT_FIGMA_TEST_PACKAGE = (Resolve-Path "processed/2026-09-20/ai-workflow-redesign").Path
npm --prefix tools/figma-importer test
Remove-Item Env:URINSIGHT_FIGMA_TEST_PACKAGE
```

변수가 없으면 실제 package 테스트 한 개만 skip합니다. 휴대 가능한 사업 JSON fixture는 위 실제 package의 carousel.json 사본이며 사진은 commit하지 않았습니다. 일반 테스트 이미지는 메모리에서 생성합니다. 실제 package 테스트는 원본 이미지 byte와 파일 hash 보존을 검증합니다.

Figma API contract mock은 노드 구조·속성·폰트 오류·재import·실패 rollback을 검사합니다. Playwright는 빌드된 UI와 controller를 연결하여 파일 선택·이미지 decode·JSON 검증·import/reimport·오류 표시·네트워크 요청 0건을 검사합니다. mock의 텍스트 폭은 근사치이고 Figma의 실제 font load/paint/crop 핸들을 재현하지 않습니다.

### 실제 Figma Desktop acceptance checklist

사용자가 실제 Figma Desktop에서 완료했다고 확인한 항목:

- [x] plugin UI 실행
- [x] 실제 package import 및 8개 frame 생성
- [x] TextNode 편집
- [x] 줄바꿈 수정
- [x] highlight Rectangle 수정
- [x] image crop/position 수정
- [x] overlay opacity 수정
- [x] 실제 editable workflow 정상 확인

추가 검증 항목 (이번 Desktop 완료 보고 범위 밖):

- [ ] 1080×1350, 페이지 순서, category #3B5BDB, Pretendard Regular/Bold, Spec 1.10 typography/anchors 및 45%/65% overlay 수치 실측
- [ ] 같은 package 재import 후 기존 수동 수정 유지 확인
- [ ] 페이지별 PNG export와 실제 시각 품질 비교

검증 실행 기록: [VALIDATION.md](VALIDATION.md).

## 10. 코드 구성

`src/package.ts`: 사용자 선택 파일/이미지·기존 schema 검증. `fonts.ts`: 실제 Figma font 목록 조회/로드. `tokens.ts`: Daily token 읽기 전용 어댑터. `text.ts`: TextNode/Rectangle와 초기 highlight/줄 측정. `importer.ts`: Section·페이지 생성/재import/rollback. `code.ts`: Figma main controller. `ui.html`/`ui.ts`: 파일 선택 및 상태 UI. `types.ts`: message payload 타입. 기존 production renderer와 분리된 도구입니다.

참고 문서: [Spec 1.10](../../docs/URINSIGHT_CAROUSEL_V6_SPEC.md), [Daily workflow](../../docs/DAILY_WORKFLOW.md), [Figma font loading](https://developers.figma.com/docs/plugins/api/properties/figma-loadfontasync/). 지정된 `URINSIGHT_CONTENT_FLOW_v1.6.md`는 repository 추적 파일과 바로 위 운영 폴더에서 찾지 못했으며 기존 Daily workflow를 확인했습니다. `_LEGACY_ARCHIVE`는 접근하지 않았습니다.
