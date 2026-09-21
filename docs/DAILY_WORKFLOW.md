# URINSIGHT 일상 운영

평소에는 Codex를 실행할 필요가 없다. ChatGPT에서 받은 package를 넣고 PowerShell에서 `npm.cmd run daily`를 실행한다. 사용자가 output의 PNG/contact-sheet를 확인하며, 수정이 필요한 콘텐츠만 아래 Figma 수동 보정 절차를 따른다. Instagram에는 직접 업로드한다.

## 매일 하는 일

1. ChatGPT에 “오늘 URINSIGHT 만들어줘”라고 요청한다. 기존 v6 carousel JSON 형식을 전달하고 package를 받는다.
2. 받은 ZIP 또는 package를 압축 해제한다. 이 프로그램은 ZIP 압축을 자동으로 풀지 않는다.
3. `carousel.json`이 바로 들어 있는 폴더를 `C:\Users\Jungsoo Bae\Documents\ChatGPT\URINSIGHT_콘텐츠\urinsight-contents\inbox\` 아래에 넣는다.
4. PowerShell을 연다.
5. 프로젝트로 이동한다.

```powershell
cd "C:\Users\Jungsoo Bae\Documents\ChatGPT\URINSIGHT_콘텐츠\urinsight-contents"
```

6. 실제 이미지를 생성한다.

```powershell
npm.cmd run daily
```

7. `output\YYYY-MM-DD\<slug>\`에서 PNG와 contact-sheet.png를 확인한다. 날짜는 실행 시작 시 한국 날짜다.
8. 완료 입력은 `processed\YYYY-MM-DD\<package-name>\`에서 확인한다.
9. 오류 package는 inbox에 그대로 있다. 안내에 따라 수정하고 다시 실행한다. 다른 정상 package는 계속 처리된다. 실패가 하나라도 있으면 command exit code는 1이다.

## 수정이 필요할 때만: Figma 수동 보정

1. 사용자가 processed에서 수정할 콘텐츠의 원본 package를 확인한다.
2. Figma Desktop을 직접 실행하고 편집할 Figma Design 파일을 연다.
3. 로컬 development plugin인 **URINSIGHT Figma Editable Importer v1**을 실행한다.
4. 해당 package의 `carousel.json` + `cover.png` + `insight.png`를 선택해 editable layer로 import한다.
5. 줄바꿈, 강조배경, 이미지 위치 등을 수동 보정하고 Figma에서 최종 PNG를 export한다.

Daily Runner는 자동 완성본 생성, Figma Importer는 검수 후 필요한 콘텐츠의 수동 보정에 사용한다. 원본 JSON은 canonical source이며 Figma에서 수정해도 inbox/output/processed나 JSON에 자동으로 다시 쓰지 않는다. Plugin 등록·편집·export 절차와 PNG pair 요구사항은 [Importer README](../tools/figma-importer/README.md)를 참고한다.

자동으로 열리는 항목은 없다. Figma Desktop, Explorer/processed 폴더, 브라우저는 사용자가 필요할 때 직접 연다. 실제 운영 명령은 `npm.cmd run daily` 하나다. `daily:figma` / `daily:review`와 자동 handoff는 사용하지 않는다. `feature/daily-figma-handoff`는 main에 반영하지 않은 실험 기록으로 보존한다.

## Package 형식

```text
URINSIGHT_YYYYMMDD_<slug>/
├─ carousel.json
├─ cover.png
├─ insight.png
└─ sources.md
```

ChatGPT가 정상적으로 제작한 package에는 cover와 insight 이미지가 함께 들어가는 것이 기본이다. 위 폴더를 inbox 아래에 넣는다. 두 이미지는 jpg/jpeg/png/webp를 지원하며 carousel.json에 새 필드를 넣지 않는다. sources.json도 선택적으로 추가할 수 있다. 정상 제작 시 sources.md를 준비하되 runner는 출처 파일이 없는 입력도 처리한다.

insight 파일이 없으면 Daily Runner가 cover를 다른 framing으로 사용하지만 이는 비상 fallback이다. 실전 게시 전 insight image를 별도로 준비하는 것을 원칙으로 한다. 실제 게시 전 마지막 장을 반드시 검수한다.

AI 이미지 pair는 Cover를 먼저 만든 뒤 그 이미지를 visual reference로 삼아 같은 인물·공간·조명의 다른 순간/앵글로 Insight를 파생 제작한다. 실제 사진·stock·실존 인물은 같은 촬영 시리즈/인터뷰/행사/장소의 다른 컷을 우선한다. Cover는 주제를 여는 장면, Insight는 더 차분하게 닫는 장면이다. 두 장은 최소 3개 이상의 시각적/개념적 요소를 공유한다.

폴더명과 JSON slug가 다르면 경고가 나오지만 정상 처리한다. cover 또는 insight 파일이 각각 여러 개면 오류다. sources는 파싱·재포맷 없이 byte 그대로 복사한다. 심볼릭 링크·junction을 통한 입력/출력 경로는 지원하지 않는다.

특정 package만 처리하려면:

```powershell
npm.cmd run daily -- --only URINSIGHT_20260917_ai-judgment
```

없는 이름, 잘못된 옵션, 경로 이동 문자열은 오류다. 명령은 프로젝트 루트에서 실행한다. 운영 루트는 현재 작업 폴더다.

## Cover 선택

1. JSON의 `cover.image`가 존재하는 로컬 파일이면 사용한다. 상대경로는 package 폴더 기준이다. 로컬 절대경로도 지원하지만 이동 후에도 재사용하려면 package 안의 상대경로를 권장한다.
2. 지정 파일이 없으면 경고 후 package의 `cover.jpg`, `cover.jpeg`, `cover.png`, `cover.webp`를 찾는다(대소문자 무관).
3. 이미지가 없으면 경고 후 기존 개발용 placeholder를 사용한다.

여러 cover가 있으면 명시 경로가 있어도 오류로 처리한다. URL, UNC 네트워크 경로, 지원하지 않는 확장자, 깨진 이미지, 링크 파일은 오류다. 외부 파일을 다운로드하지 않는다. 이미지 decode는 기존 로컬 cover provider를 사용한다. 원본 carousel.json에는 cover 경로를 쓰지 않고 runtime provider로 이미지만 전달한다.

## 결과와 덮어쓰기 방지

```text
output/YYYY-MM-DD/<slug>/
  01_cover.png
  02_body.png ...
  07_summary.png
  08_insight.png
  contact-sheet.png
  validation.json
  manifest.json
  sources.md       있을 때
  sources.json     있을 때
```

BODY 5~7개, 전체 8~10페이지를 지원한다. 모든 페이지 PNG는 1080×1350이다. contact sheet는 여러 페이지를 모은 별도 크기의 검수용 이미지다. manifest에는 slug/category/pageCount/processedAt/inputPackage/cover/outputs/sources를 기록한다.

같은 날짜의 output slug 또는 processed package 폴더가 이미 있으면 `ERROR_EXISTING_OUTPUT` 또는 `ERROR_EXISTING_PROCESSED`를 출력한다. 덮어쓰거나 자동 삭제하지 않는다. `--force`는 없다. 기존 결과를 먼저 확인하고 새 콘텐츠에는 다른 slug/package 이름을 사용한다.

dry-run은 JSON schema, highlight, BODY 수, cover decode, 최종 경로와 충돌만 확인한다. PNG·output·processed·temp를 만들지 않는다. 실제 font 기반 subtitle single-line/overflow/clipping 검증은 생성 시 수행하며, 실패하면 성공으로 표시하지 않는다.

## 내부 처리와 실패 복구

Daily Runner는 기존 `generate()`를 호출하는 로컬 orchestration layer다. renderer/schema/tokens/reference를 복제하거나 수정하지 않는다. 기존 `pnpm generate <carousel.json>`도 그대로다.

`.tmp/daily-<unique>/`에서 임시 JSON과 전체 렌더링을 생성한다. renderer 검증, contact sheet, sources 복사, manifest 저장 후 최종 폴더로 rename한다. 이어 package 전체를 processed로 rename한다. processed 이동이 실패하면 이번 output을 다시 임시 위치로 돌려놓고 정리한다. 렌더 실패는 inbox를 이동하지 않으며 임시 파일을 정리한다. 기존 성공 output은 건드리지 않는다.

동시 Daily Runner 실행은 `.tmp/daily.lock`으로 차단한다. 실행 중 inbox 파일을 편집하거나 다른 generate 명령으로 같은 output 경로에 쓰지 않는다. 두 폴더 이동은 단일 filesystem transaction은 아니다. 전원 종료/프로세스 강제 종료 시 완료 output과 inbox가 함께 남을 수 있으며, 다음 실행은 덮어쓰기 대신 충돌 오류를 낸다. 이때 output의 manifest/validation과 PNG를 확인해 수동 정리한다. 남은 lock은 실행 중인 daily가 없는 것을 확인한 뒤 지운다. output과 processed는 같은 로컬 디스크의 일반 폴더로 사용한다.

## 처음 한 번 준비

프로젝트의 Node.js/pnpm, 설치된 dependency와 Playwright Chromium이 필요하다. 기존 renderer 설치가 끝나 있으면 추가 설치는 없다. Daily Runner 실행 자체에는 인터넷이나 API key가 필요 없다. 설치 과정은 일상 실행과 별도다. 네트워크 드라이브는 사용하지 않는다.

샘플은 `examples/inbox-sample/`에 있다. 실제 inbox로 자동 복사하지 않는다. 시험하려면 사용자가 직접 복사한다. 이 샘플 sources.md는 형식 예시이며 외부 뉴스 검증 자료가 아니다.

## 이번 단계에서 하지 않는 일

- 자동 주제 탐색, 뉴스 크롤링, X 수집
- ChatGPT 자동 호출, Codex 자동 호출, OpenAI API, LLM 호출
- AI 표지 생성, 스톡 이미지 자동 검색, 외부 이미지 다운로드
- Instagram 자동 업로드, 예약 게시, 성과 분석

미래 API 자동화용 `feature/content-engine`과 `content-engine-step3`는 별도 보존한다. Daily Runner에 merge하지 않는다.

## Specification 1.3: INSIGHT 이미지

package에 cover와 같은 사진 시리즈처럼 보이는 `insight.png`를 추가한다. `insight.jpg`, `insight.jpeg`, `insight.webp`도 지원한다. carousel.json은 수정할 필요가 없다. Cover와 INSIGHT 이미지가 주제·공간·인물·조명·무드 등 최소 3개 요소로 연결되는지는 사람이 검수한다.

- insight 파일 1개: 별도로 decode하여 마지막 페이지 배경에 사용한다.
- insight 파일 없음 + 실제 cover 있음: 비상 상태로 경고하고 cover를 1.08배 확대, 58% 50% position으로 재사용한다. manifest.insight.requiresQualityReview=true이며 품질검수가 필요하다.
- 실제 cover도 없음: 강한 품질검수 경고와 placeholder fallback. manifest.insight.requiresQualityReview=true이므로 게시 전에 실제 이미지를 준비한다.
- insight 파일 여러 개 또는 깨진 파일: 오류. package는 inbox에 남는다.

이미지는 전체 canvas를 채우고 검정 overlay 65%로 텍스트 가독성을 확보한다. 실제 사진이 전혀 없는 경우에는 기존 dark placeholder를 유지한다. category color로 사진을 tint하지 않는다. 명시적 이미지의 position은 50% 50%다.

manifest.insight.status는 provided / cover-fallback / placeholder-fallback 중 하나다. source는 읽은 원본 경로이며, package 이동 전 경로를 provenance로 기록한다. 원본 insight 파일은 processed에 보존한다. output에는 원본 이미지를 별도 복사하지 않는다.

`npm.cmd run daily -- --dry-run`도 insight 탐색·decode·fallback 상태를 확인한다. 기존 `pnpm generate <carousel.json>`은 optional runtime insightImage가 없으므로 종전 v6 dark INSIGHT 결과를 유지한다. 자동 사진 검색/생성이나 외부 API 호출은 하지 않는다.

## Specification 1.4: 고정된 본문 프레임

`npm.cmd run daily`는 BODY와 SUMMARY의 상단 위치, 마지막 강조문장 하단(Y=1103)을 고정한다. 본문 분량이 달라도 강조문장은 아래에 정렬된다. 1~2줄 강조문장 위의 공간에 원고를 맞춘다.

`BODY_CONTENT_OVERFLOW` 또는 `SUMMARY_CONTENT_OVERFLOW`가 나오면 오류의 page/region/currentHeight/allowedHeight를 확인하고 해당 원고를 줄인다. 중복 제거, 문장 간결화, 3문단을 2문단으로 압축하는 순서로 편집한다. 폰트를 줄이거나 마지막 문장을 아래로 밀지 않는다. 오류 package는 inbox에 남는다.

기존 `pnpm generate <carousel.json>`은 v6 legacy 배치를 유지한다. Daily Runner만 runtime `contentLayout: 'anchored'`를 전달하며 원본 JSON은 바꾸지 않는다. dry-run은 파일/schema/이미지/경로 검사이고 실제 높이 검증은 생성 시 수행한다. Cover와 INSIGHT의 1.3 이미지 규칙은 그대로다.

## Specification 1.5: SUMMARY 제목 다음에 설명 배치

SUMMARY 설명은 headline 실제 마지막 줄 하단에서 57px 아래에 시작한다. BODY 소제목과 본문 사이의 기존 간격과 같다. headline 1/2/3줄의 본문 시작은 각각 Y=515/579/643이며, 마지막 강조문장 하단은 Y=1103을 유지한다. 제목이 길어져 설명이 넘치면 원고를 압축한다. 폰트 크기나 고정 anchor를 바꾸지 않는다. 기존 generate의 legacy 배치는 그대로다.
