# 책장성경 (iPhone 앱) 작업 안내 — Claude용

사용자는 한국어로 대화합니다. 답변은 **한국어, 핵심 먼저, 표·체크리스트 선호**, 문서는 격식 있는 어조로 씁니다.
시험은 PC 브라우저 모의일 뿐이므로 **실기기에서 확인하지 못한 것은 반드시 따로 밝힙니다.**

## 무엇인가
- 개역한글 성경 보기 앱. 넓은 화면은 StPageFlip 두 쪽 펼침, 좁은 화면은 세로 스크롤. 웹 화면 코드(`www/`)를 Swift(WKWebView, 커스텀 스킴 `bibleflip://app/index.html`)로 감싼 아이폰 앱이며 iPhone Duo에서 주로 씁니다.
- 앱은 GitHub Actions에서 서명 없이 빌드해 IPA를 `releases/latest`에 올리고, 사용자가 Windows PC의 Sideloadly로 사이드로드합니다(무료 Apple ID, 7일마다 다시 서명).

## 저장소 구조
| 경로 | 내용 |
|---|---|
| `www/` | **웹 화면 코드의 원본** (app.js, style.css, index.html, sw.js, lib/…). 앱에 그대로 들어감 |
| `BibleFlip/` | Swift: ViewController(웹뷰·메시지), BundleSchemeHandler, LocationBridge(위치·주소 찾기) 등 |
| `project.yml` | XcodeGen 설정(앱 버전 `MARKETING_VERSION`, 권한 안내 문구) |
| `tests/` | Puppeteer 시험(헤드리스 크롬 모의) — `tests/runreg.sh` |
| `docs/WEB-README.md` | 웹 화면 쪽 버전별 설명서(길음). 새 버전은 여기 맨 아래 항목에 이어 적기 |
| `NOTES.md` | 진행 기록 + 실기기 확인 목록(버전마다 한 줄 추가) |
| `docs/HANDOFF-map-theme.md` | 진행 예정 작업(지도 그림을 앱 테마에 맞추기)의 인수 메모 |
| `docs/HANDOFF-brand-cafes.md` | 모임 장소 지도의 **카페 층**(서울 모든 카페·프랜차이즈/개인 걸러 보기·내 장소 핀 색)과 **보드게임 카페 층**(별도 단추·서울)의 인수 메모 |
| `docs/SUPPORT-SETUP.md` | **문의하기(메일 작성 창)·후원하기(앱 안 결제)** 설정 안내: 받는 메일 주소(`INQUIRY_EMAIL`), App Store Connect 후원 상품 ID, 세무·법률 상담 권고, 실기기 확인표 |
| `docs/emergency-raster/` | **비상용 래스터(A) 지도**(v68에서 앱에서 삭제). v67의 래스터 코드·CSS·시험(map4)과 되살리는 순서(README). 앱에는 들어가지 않음 |
| `scripts/filter-cafes.py` | 공공데이터 상가정보 CSV에서 서울 모든 카페 + 서울 밖 스타벅스·투썸을 걸러 `cafes.json` 을, 이름에 '보드게임'이 든(또는 브랜드·'○○보드카페' 이름인) 서울 가게를 걸러 `boardgame.json` 을 함께 만드는 PC용 스크립트(시험: `tests/filter-cafes-test.py`) |

`scripts/sync-web.sh`는 예전 작업 폴더(`bible-pwa`)에서 `www/`로 복사하던 도구입니다. 지금은 `www/`가 원본이라 쓰지 않습니다.

## 버전을 올릴 때 (화면 파일도 앱에 들어 있어 매번 재설치가 필요함)
1. `www/app.js`의 `APP_VER = 'vNN'`  2. `www/sw.js`의 `CACHE = 'bibleflip-vNN'`  3. `project.yml`의 `MARKETING_VERSION: "NN"`  4. `BibleFlip/ViewController.swift`의 `"BibleFlip/NN"`(User-Agent)  5. `docs/WEB-README.md`·`NOTES.md`에 기록.

## 시험
`cd tests && npm install && bash runreg.sh`(결과 `reg.log`). 하나만: `node map1.mjs 펼침`. 동시에 여러 개를 돌리지 않습니다. 오래 걸리는 시험은 백그라운드로 돌리고 기다립니다. 기기별 화면 크기·안전영역은 `tests/devlib.mjs`의 `DEVICES`(듀오 펼침 951×669, 오른쪽 안전영역 84px).
시험 파일의 지도 타일 가로채기·네이티브 메시지 모의(`window.webkit.messageHandlers.bf`)는 `tests/map1.mjs`·`map2.mjs`의 `openDev`를 참고합니다.

## 빌드·확인 순서
1. `git push` → Actions(`Build iOS (서명 전 IPA)`)가 자동 실행(문서·시험만 바뀌면 실행 안 됨). 결과: `gh api "repos/choice0829/bible_duo_ios/actions/runs?head_sha=$SHA" --jq '.workflow_runs[] | [.id,.status,.conclusion]'`
2. Swift는 샌드박스에서 컴파일할 수 없으므로 Actions 결과로만 확인합니다. 실패하면 로그를 보고 고칩니다.
3. IPA 확인: `https://github.com/choice0829/bible_duo_ios/releases/download/latest/BibleFlip.ipa`를 받아 unzip 후 `Payload/BibleFlip.app/www/app.js`의 `APP_VER`, `Info.plist`의 버전·권한 키를 확인합니다.

## 사용자에게 꼭 안내할 것
- Swift나 `www/`가 바뀌면 **Sideloadly로 다시 설치**해야 하고 7일 주기가 다시 시작됩니다. 설치 전에 앱의 **데이터 백업**을 먼저 하게 안내합니다.
- Apple ID 정보와 모든 API 키·지도 키는 **채팅에 붙여 넣지 않게** 합니다(Sideloadly 또는 앱 안에만 입력).
- 샌드박스의 네트워크는 허용 목록 방식이라 지도·타일 서버에는 접속할 수 없습니다. 그런 부분은 사용자 PC·실기기에서 확인해야 한다고 분명히 밝힙니다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` 를 붙입니다(세션 링크 줄이 안내되면 함께).
