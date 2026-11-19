# 인수 메모 — 모임 장소 지도의 '지도 그림'을 앱 테마에 맞추기

작성 시점: v49 (2026-11-19). 이 문서는 새 대화(또는 새 작업자)가 이전 대화 없이도 바로 시작할 수 있도록 적었습니다.
먼저 `CLAUDE.md`(작업 규칙)와 이 문서를 읽고, 아래 '시작 전에 사용자와 정할 것'부터 확인하세요.

## 1. 요청 내용
- 사용자 말: "지도가 앱 테마랑 맞지 않는데 앱 테마에 맞게 UI 및 디자인을 수정할 수 있는지?" → 확인 결과 **지도 그림 자체(도로·건물·글자 색)까지 바꾸는 쪽**으로 진행하기로 함(색조 덧씌우기만 하는 가벼운 방법이 아님).
- 함께 할 일: 지도 주변 UI(확대·축소·내 위치 단추의 흰색, 파란 저작권 링크, 핀·카드)도 테마 색으로 통일.
- 앱 테마 3가지(`www/app.js`의 `THEMES`, 색은 `www/style.css` 위쪽 변수):

| 테마 | 바탕 `--bg` | 글자 `--fg` | 강조 `--accent` |
|---|---|---|---|
| 종이(paper, 기본) | #FBF8F1 | (기본값) | #9E4033 |
| 세피아(sepia) | #F1E4C8 | #3B2F1E | #94481F |
| 야간(night) | #14161A | #D9D9D9 | #E6997A |

## 2. 지금 지도가 만들어진 방식 (v49)
- 라이브러리: Leaflet 1.9.4 (`www/lib/leaflet.js`·`leaflet.css`, BSD-2). 처음 열 때만 불러옴(`mpLoadLeaflet`).
- 바탕: `www/app.js`의 `MP_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'`, 표기 `MP_ATTR`. 앱의 User-Agent에 `BibleFlip/버전`을 붙임(`ViewController.swift`, OSM 이용 정책 대응).
- 야간 테마: `www/style.css`의 `body.theme-night .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) ... }` 로 그림을 어둡게 처리 — 도로·글자 색은 바꿀 수 없음.
- 핀은 DOM 마커(`mpIcon` → `L.divIcon`, SVG는 `MP_PIN`, 스타일 `.mp-pin`). 내 위치는 `L.circleMarker`(파란색 `#2f7de1` 하드코딩, `mpDrawMe`).
- 지도 위 단추: Leaflet 확대·축소(`mpZoomCtl`, 펼침에서는 오른쪽 위로 `setPosition`), 내 위치 단추 `.mp-me`(흰 바탕 하드코딩), 저작권 링크 색 `#0b63c8` 하드코딩(`#mp .leaflet-control-attribution a`).
- 화면 배치(v49): `#mp.two`(가로 길고 높이 520px 이상: 지도 가로 전체 + 위 줄 검색·키워드 + 아래 오른쪽 내 위치 + 떠 있는 접이식 목록 창) / `#mp.narrow`(탭). 함수: `layoutMp`, `mpPlace`(부품을 위 줄·아래 줄로 옮김), `mpGo`·`mpPanelW`(창에 가려지지 않는 쪽 가운데로 이동).
- 지도 위 모든 이동은 Leaflet API(`setView`, `fitBounds`, `project`/`unproject`, 마커, `circle`)를 씁니다. 지도 엔진을 바꾸면 이 호출들을 모두 손봐야 합니다.

## 3. 비교할 방법 (사용자와 상의해 고를 것)
| 방법 | 내용 | 장점 | 확인·주의할 것 |
|---|---|---|---|
| A. 다른 무료 래스터 바탕 | 부드러운 색의 래스터 타일(예: CARTO 계열)로 교체 | 코드 변경 적음(`MP_TILE`·표기·시험의 타일 가로채기만) | 이용 조건·표기 의무, **한국어 글자 표기**, 서울 지역 품질, 실기기에서 로딩 확인. 테마마다 다른 타일을 쓸 수 있음 |
| B. 벡터 지도 + 자체 스타일 | MapLibre GL JS로 테마별 스타일(JSON)을 만들어 그림 전체를 설계 | 도로·건물·글자 색을 완전히 통제 | 앱 용량, **한글 글자체(glyph) 파일**, WKWebView에서 WebGL 동작, 아래 '지도 파일' 문제, Leaflet 호출 전부 교체(또는 `maplibre-gl-leaflet` 같은 연결 플러그인으로 Leaflet을 유지하는 방법 — 사용 가능 여부 확인 필요) |
| C. 지금 바탕에 색조 덧씌우기 | 테마별 CSS 필터(채도·세피아·밝기)로 분위기만 맞춤 | 가장 가볍고 안전 | 도로·글자 색은 못 바꿈(이미 선택에서 제외됨, 보조 수단으로만) |

### B를 고를 때의 지도 파일 문제 (중요)
- 한국 지도 데이터는 Protomaps 등의 PMTiles 형식 파일로 만들 수 있고, 사용자는 **Windows PC만** 씁니다(샌드박스에서는 지도 데이터 서버에 접속할 수 없음). 파일 만들기는 사용자 PC에서 명령 몇 줄로 하게 안내해야 합니다.
- **현재 `BibleFlip/BundleSchemeHandler.swift`는 Range 요청을 처리하지 않고 항상 전체 파일(200)로만 응답합니다.** PMTiles를 앱 안(`bibleflip://`)에서 읽으려면 Range(206) 지원을 Swift에 추가해야 하며, Swift는 샌드박스에서 컴파일할 수 없고 GitHub Actions에서만 확인됩니다. 대안은 파일을 https 주소에 올려 두고 읽는 것(Range·CORS 필요, 인터넷 필요).
- 큰 파일을 앱에 넣으면 IPA가 커지고 재설치(7일마다)가 느려집니다.

## 4. 시험하는 방법 (tests/)
- `cd tests && npm install && bash runreg.sh` (전체, 약 10분) / 하나만: `node map1.mjs 펼침`(`접힘`, `세로`도 가능), `node map2.mjs`.
- `map1.mjs`·`map2.mjs`의 `openDev`는 **`https://tile.openstreetmap.org/` 요청을 가로채 1×1 그림으로 응답**합니다. 바탕 주소가 바뀌면 이 부분(startsWith 조건)도 함께 고쳐야 하고, 벡터 타일·PMTiles를 쓰면 가로채기 방식을 새로 만들어야 합니다.
- 헤드리스 크롬 모의이므로 **실기기 동작은 확인하지 못합니다.** 지도 그림이 실제로 어떻게 보이는지는 사용자가 아이폰에서 확인해야 합니다.
- `www/index.html`에는 CSP(Content-Security-Policy)가 없습니다. 새 외부 주소를 쓰면 https여야 합니다(iOS 기본 설정).
- 지도 안내 문구·오류(`#mp-note`)는 타일 오류가 연속 2회일 때 뜹니다(`tileerror`).

## 5. 시작 전에 사용자와 정할 것
1. 3가지 테마(종이·세피아·야간) 각각의 지도 분위기(예: 종이=따뜻한 베이지·옅은 도로, 야간=어두운 회청색 등) — 가능하면 말로 방향을 받고 화면으로 확인.
2. 인터넷 없이도 지도가 보여야 하는지(오프라인) / 앱 용량 증가를 감수할지.
3. 지도 범위: 한국 전체 / 서울·수도권만.
4. 무료 서비스만 쓸지(키·계정이 필요한 서비스는 사용자가 앱에만 입력하고 채팅에는 붙여 넣지 않음).

## 6. 실기기에서 확인할 것 (작업이 끝날 때마다 사용자에게 안내)
- 세 테마에서 지도 그림이 앱 색과 어울리는지, 글자(지명)가 한글로 읽히는지.
- 확대·축소·이동이 부드러운지, 처음 로딩 시간, 인터넷이 약할 때의 모습.
- 듀오 펼침(951×669)·접힘·아이폰 세로에서 단추·핀·카드 색과 위치.
- 저작권·출처 표기가 화면에 남아 있는지(이용 조건 필수).

## 7. 진행 상태 (v50, 2026-11-19)
**사용자와 정한 것(§5):** 방법 = **A 먼저, 부족하면 B** · 오프라인 불필요(인터넷 연결 전제, 앱 용량 증가 없음) · 범위 = 한국 전체 · 테마별 분위기 = 제안대로(종이=따뜻한 베이지·옅은 도로 / 세피아=갈색 톤 / 야간=어두운 회청색, 핀·단추·카드는 테마 강조색으로 통일) · 무료 서비스만.

**한 일(v50):**
- CARTO 래스터 타일 적용. 종이·세피아 = Positron(`light_all`) + 색조 필터, 야간 = Dark Matter(`dark_all`) + 청회색 필터. 타일 주소는 `https://basemaps.cartocdn.com/rastertiles/{light_all|dark_all}/{z}/{x}/{y}.png?key=열쇠`, 표기 '© OpenStreetMap contributors, © CARTO'(이용 조건), 18단계까지.
- **새로 알게 된 것(§3 A의 '이용 조건'):** CARTO 래스터 타일은 현재 **무료 API 키가 필요**하다(비상업 월 500만 요청까지 무료, 계정 불필요·이메일로 발급). 키를 소스에 넣으면 공개 저장소에 노출되므로 **고급설정에서 사용자가 앱 안에 입력**하게 했다(`bf.mapkey`, 백업 제외). 키가 없으면 OSM + 색조 필터로 계속 동작한다(`mpTileCfg`, `mpApplyTile`).
- 지도 주변 UI 테마화: 확대·축소·내 위치 단추, 출처 링크, 핀 테두리·컵, 내 위치 점(`--mp-me`), 로딩 전 바탕(`--mp-land`). 테마 변경 시 바탕 자동 교체(`themeHooks`).
- 시험: `tests/map4.mjs`(테마 3 × 열쇠 유무, 확대 한계, 테마 전환, 열쇠 입력·백업 제외, 오류 안내문). 필터 값은 근사 타일 색으로 계산(Filter Effects 행렬)해 정함.

**아직 모르는 것·남은 일:**
- 실기기 확인 전이다: 실제 타일 색이 근사값과 다르면 `style.css`의 `.mp-src-carto`·`.mp-src-osm` 필터 값을 조정한다. 필터로 도로·글자 색을 개별로 바꿀 수는 없으므로, 그래도 어울리지 않으면 **B(MapLibre 벡터 + 자체 스타일)** 로 넘어간다(§3 B의 한글 글자체 파일·WebGL·Leaflet 호출 교체 문제는 그대로).
- **한글 지명:** ~~확인하지 못했다~~ → **v50 실기기에서 확인됨**(사용자 스크린샷, 종이 테마, 한글 지명 표시).

- **고해상도(@2x) 타일:** CARTO 문서에 @2x 파일 이름이 명시돼 있지 않아 적용하지 않았다. 아이폰에서 글자가 흐리게 보이면 문서를 다시 확인해 `detectRetina`/`{r}` 적용을 검토한다.
- 키 발급 화면에 '사용할 사이트·앱 제한' 옵션이 있으면 처음에는 걸지 않는다(앱 화면 주소가 `bibleflip://`). 사용량이 월 500만 요청을 넘길 일은 사실상 없다.

## 8. 진행 상태 (v51, 2026-11-20) — B(벡터) 비교용 구현
**요청:** v50(A)이 괜찮아 보이지만, B 방식을 실제로 구현해 실기기에서 A와 비교해 보고 싶다.

**한 일(v51):**
- 방식 전환: 고급설정 '모임 장소 지도 그림'의 **래스터(A)/벡터(B)** 단추(`bf.mapeng`, 기본 A, 백업 제외). 코드는 `mpApplyTile`(바탕 층 선택)·`mpLoadVector`(부품 지연 로딩)·`mpAddVector`(MapLibre 층 생성·감시)·`mpVecFailed`(자동 복귀) — `www/app.js`.
- 구성: Leaflet은 그대로 두고 바탕 층만 `L.maplibreGL`(plugin 0.1.4)로 교체. maplibre-gl 5.24.1(최신 6.x도 plugin이 허용하나 보수적으로 5.x). MapLibre 줌 = Leaflet 줌 − 1이라 스타일의 줌 값은 MapLibre 기준(`www/mapstyle.js` 머리 주석).
- 스타일: `www/mapstyle.js`가 테마별(`PAL`) OpenMapTiles 스키마 층 37개를 만든다(땅·물·공원·건물·도로 5등급(케이싱 포함)·철길·샛길·경계·도로명·지명·물이름·POI·번지). `name:ko`가 있으면 우선, 없으면 `name`. 글꼴은 OpenFreeMap이 가진 `Noto Sans Regular/Bold/Italic`만. 스프라이트(아이콘)는 쓰지 않고 POI는 점+이름.
- 자료: OpenFreeMap 공개 인스턴스(`https://tiles.openfreemap.org/planet` TileJSON). 키·가입 없음, 상업 이용 가능, 출처 표기 필수('OpenFreeMap © OpenMapTiles Data from OpenStreetMap'). 이용 조건은 `https://openfreemap.org/tos/`.
- 한글: MapLibre 기본값(`localIdeographFontFamily: sans-serif`)이 한글 자모·음절·CJK를 **글자 파일 없이 기기 글꼴로** 그린다(`maplibre-gl.js` 안 범위표 확인). 영문·숫자만 글자 파일 요청(서버 실패해도 같은 방식으로 기기 글꼴 대체).
- 자동 복귀: WebGL2 없음(부품도 받지 않음)·부품 실패·TileJSON/스타일 오류·15초(`MP_VEC_WAIT`) 무응답 → `mpVecFail`에 이유를 기억하고(그 실행 동안) 래스터로 복귀 + 안내문 9초. 방식 단추를 다시 누르면 기록을 지우고 재시도. 복귀했을 때 **고급설정 상태 줄에 '진단:' 한 줄**(스타일 ○/× · 자료 주소 ○/× · 타일 N개 · 마지막 오류, 또는 받지 못한 파일 이름·WebGL2 없음)이 남으므로, 실기기에서 안 될 때 그 줄을 스크린샷으로 받으면 원인(Blob 워커·CORS·서버 등)을 좁힐 수 있다. 워커가 원인이면 `maplibre-gl-csp.js`+`setWorkerUrl`(파일 워커)로 바꾸는 것을 검토한다.
- 시험: `tests/map5.mjs` 89개 항목(스타일 규격·세 테마 렌더·확대·테마 전환·방식 단추·복귀 4종). 가짜 타일은 `tests/vtscene.mjs`(geojson-vt + vt-pbf).

**샌드박스에서 확인하지 못한 것(실기기 필요):** 실제 OpenFreeMap 응답(TileJSON·타일·글자 파일 주소·CORS), 아이폰 WKWebView의 WebGL2·Blob 워커(MapLibre는 인라인 워커를 Blob URL로 띄움)·커스텀 스킴(`bibleflip://app`) 출처에서의 fetch(CORS), 실제 한글 글꼴 모양·세로 도로명, 속도·배터리, 실제 색감.

**비교 후 선택지:**
1. B가 낫다 → 기본값을 B로 바꾸고(`mpEngGet` 기본) A는 비상용으로 남기거나 제거. 열쇠 UI 정리.
2. A가 낫다 → B 부품(약 1.1MB)과 `mapstyle.js`를 제거해 앱 용량을 줄인다(`lib/maplibre-gl.*`, `lib/leaflet-maplibre-gl.js`, `lib/MAPLIBRE-*`).
3. B의 색·글자 크기·도로 폭은 `mapstyle.js`의 `PAL`·`Z`/`ZE` 값만 고치면 된다(스크린샷을 받아 조정).
