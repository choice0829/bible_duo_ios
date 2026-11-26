# iPhone Duo 화면 구조 정리 (2026-11-26 조사)

이 앱(선한성경)을 iPhone Duo에 맞출 때 기준으로 삼는 자료입니다. **출처마다 숫자가 다른 곳이 있어, 확실한 것과 추정을 나눠 적습니다.**
웹 조사(Apple Tech Talk 녹취, 리뷰·개발자 글)와 이 앱의 실기기 캡처·녹화에서 잰 값을 함께 적습니다.

## 1. 기본 정보
| 항목 | 내용 | 확실성 |
|---|---|---|
| 발표 | 2026-09-09 (Apple 뉴스룸) | 확실 |
| 판매 | 예약 2026-10-16, 출시 2026-10-23 (일부 기사) | 기사 기준 |
| 안쪽 화면 | 7.6인치 접히는 OLED, 나노 텍스처, ProMotion | 확실(Apple 사양) |
| 바깥(커버) 화면 | 약 5.4인치 Super Retina XDR | 확실(Apple 뉴스룸) |
| 해상도 | 안쪽 1878×2670 px·430 ppi(Apple 사양), 바깥 1398×2034 px·460 ppi(기사) | 기사마다 다름 |
| 칩·가격 | A20 Pro, 256GB $1,999 | 기사 기준 |

## 2. 이 앱에서 잰 값 (가장 믿을 만함)
| 화면 | 앱이 받는 크기(pt) | 안전영역 | 근거 |
|---|---|---|---|
| 펼침(안쪽 화면 가로) | **951×669** | 오른쪽 **84**, 나머지 0 | 실기기 화면 녹화 2854×2008 px(÷3), 앱 진단 |
| 접힘(바깥 화면 세로) | **466×678** | 위 0 (오른쪽·아래는 확인 필요) | 실기기 캡처, 시험 기기 목록(`tests/devlib.mjs`) |
| 상태 표시(시계·배터리 묶음) | 펼침: 오른쪽 84pt 열의 맨 위(약 x 877~930, y 22~114) | — | 실기기 캡처(v39·v84) |
| | 접힘: 오른쪽 위 모서리, 아래 끝 약 160 | — | 실기기 캡처(v84) |

- 다른 개발자 글(시뮬레이터 관찰)에는 바깥 화면도 **오른쪽에 84pt 세로 띠**가 있다고 되어 있습니다(466×678, 위 0·아래 34·오른쪽 84). 이 앱의 접힘 안전영역 값과 다를 수 있어 **실기기 진단으로 확인이 필요**합니다.
- 안쪽 화면 세로로 들기(세로 펼침)도 있습니다. 이 자세에서만 예전처럼 위·아래 가로 막대 배치를 씁니다(Apple).

## 3. 시스템 화면 배치 (Apple Tech Talk 기준)
- **세로 띠(사이드 레일):** 예전에 위·아래에 있던 탭 막대·도구 막대·뒤로 단추가 **화면 옆(오른쪽)**으로 갑니다. 같은 세로 공간에 **새 상태 표시(와이파이·통신·배터리를 합친 동그란 표시)**와 **Dynamic Island**가 있고, Dynamic Island는 실시간 현황(Live Activity)이 오면 **아래로 늘어납니다.**
- 바깥 화면(닫힘)에서는 앱이 **상태 표시와 카메라의 왼쪽 공간**을 씁니다. 펼쳐 가로로 들어도 띠의 위치는 같은 쪽에 유지됩니다.
- 안쪽 화면 세로(펼쳐 세로로 듦)는 예전 아이폰처럼 위·아래 가로 막대를 씁니다.
- 안전영역은 **좌우가 다릅니다.** 화면 나누기(두 앱 나란히)에서 왼쪽에 놓인 앱은 띠가 왼쪽에 올 수 있으므로 한쪽 값을 두 배로 쓰면 안 됩니다.
- 상태 표시의 **위치는 시스템이 정하며 앱이 옮길 수 없습니다.** 네이버 지도처럼 그 뒤까지 앱 바탕을 까는 것만 가능합니다.

## 4. 접기·펴기 때 앱에 일어나는 일
- 앱은 **창 크기가 바뀝니다**(닫힘: 좁은 화면, 열림: 넓은 화면). 화면 크기 구분은 바깥 = 좁은 폭, 안쪽 = 넓은 폭.
- 바깥 화면에서 연 앱이 펼치면 안쪽 화면으로 매끄럽게 이어집니다(리뷰).
- **경첩이 몇 도일 때 화면이 바뀌는지는 공개 자료에 없습니다.** 웹 화면은 창 크기가 바뀌는 순간(`resize`)에야 알 수 있습니다.
- 크기와 안전영역 값이 **따로따로 도착**할 수 있어, 잠깐 다른 방향의 안전영역이 읽히기도 합니다(개발자 이슈). 이 앱의 `settleTick`·`suspectGeo`가 이를 처리합니다.

## 5. 새 API (iOS 27.1 SDK, Xcode 27.1) — 이 앱은 이미 27.1 SDK로 빌드됨
| API | 하는 일 | 이 앱에 쓸 수 있는 곳 |
|---|---|---|
| **경첩**: SwiftUI `onHingeChange`, UIKit `UIHingeInteraction` | 상태(닫힘·일부 열림·완전 열림) + 연속 각도(평평하면 180°). 갱신 빈도는 시스템이 정함 | **접기·펴기 직전 움직임 시작**(Apple 지침: 배치가 아닌 *효과*에만 쓰라고 함 — 머리줄 미끄러짐은 효과라 맞음) |
| **예약 영역**: `reservedRegions(kind: .division / .occlusion)`, `UIViewReservedRegion` | 접히는 선(division, 일부 접혔을 때만 활성), 안쪽 카메라(occlusion) 자리 | 반쯤 접은 상태(탁자에 세움)에서 접히는 선을 피하는 배치 |
| **배열**: `ArrangementView`, `UIArrangementViewController` | 나란히(split)·겹쳐(overlay) 두 화면 배치 | 해당 없음(웹 화면) |
| **세로 도구 막대**: `toolbarVerticalEdge` 등 | 기본 막대를 옆 띠로 | 해당 없음(머리줄은 웹으로 그림) |

- 이름·단위(각도 단위 등)는 글마다 조금씩 달라, 쓰기 전에 Xcode 27.1 SDK 헤더에서 확인합니다.
- 웹(WKWebView·Safari)에 대한 Duo 전용 안내는 찾지 못했습니다. `env(safe-area-inset-*)`는 일반 규칙대로 좌우를 따로 씁니다.

## 6. 이 앱에 주는 시사점
1. **접기·펴기 반응을 더 앞당기려면** Swift에서 `UIHingeInteraction`으로 경첩 각도를 받아 웹에 알려 주고(예: 닫는 중 일정 각도 아래로 내려가면), 창 크기가 바뀌기 전에 머리줄 움직임을 시작할 수 있습니다. 실기기에서만 확인 가능합니다.
2. 접힘의 실제 안전영역(오른쪽 84pt 띠·아래 34pt 여부)을 앱 진단으로 다시 재어 `tests/devlib.mjs` 기기 값과 맞춥니다.
3. 상태 표시는 앱이 옮길 수 없으므로, 머리줄은 그 옆을 피하는 지금 방식(펼침: 오른쪽 84pt 열, 접힘: 오른쪽 레일)을 유지합니다.
4. 반쯤 접은 자세(일부 열림)에서는 화면 가운데 접히는 선(약 40pt 폭)이 생깁니다. 필요하면 본문이 그 선을 피하게 할 수 있습니다.

## 출처
- Apple Tech Talk: [Prepare your app for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111461/), [Design for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111466/), [111462](https://developer.apple.com/videos/play/tech-talks/111462/), [111463](https://developer.apple.com/videos/play/tech-talks/111463/), [111464](https://developer.apple.com/videos/play/tech-talks/111464/)
- Apple: [뉴스룸 발표](https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/), [기술 사양](https://support.apple.com/en-us/148588) (이 환경에서는 열리지 않아 검색 요약으로 확인)
- 예제·개발자 글: [iPhone-Duo-by-Examples](https://github.com/artemnovichkov/iPhone-Duo-by-Examples), [iOS 27.1 Duo API 정리(classmethod)](https://dev.classmethod.jp/en/articles/ios27-1-iphone-duo-new-apis/), [hinge 읽기(heynavid)](https://heynavid.com/blog/reading-the-iphone-duo-hinge/), [onHingeChange(bleepingswift)](https://bleepingswift.com/blog/onhingechange-hinge-angle-swiftui), [safearea.info](https://safearea.info/iphone-duo), [Expo 가이드](https://expo.dev/blog/supporting-iphone-duo), [Capacitor 가이드](https://capgo.app/blog/capacitor-iphone-duo-safe-area-guide/), [nsgo 이슈 #824](https://github.com/nsgo-dev/nsgo/issues/824)
- 리뷰·기사: [MacRumors](https://www.macrumors.com/2026/09/10/apple-details-how-ios-27-adapts-to-iphone-duo/), [TapSmart](https://www.tapsmart.com/tips-and-tricks/iphone-duo-sideways-interface/), [AppleMagazine 상태 표시](https://applemagazine.com/iphone-duo-status-icon-wifi-cellular-battery/), [AppleInsider 리뷰](https://appleinsider.com/articles/26/10/30/iphone-duo-review-proof-that-foldables-dont-have-to-suck), [TechRadar 체험](https://www.techradar.com/phones/iphone/iphone-duo-hands-on), [Tom's Guide](https://www.tomsguide.com/phones/iphones/iphone-duo-is-official-price-release-date-specs-and-everything-you-need-to-know), [Wikipedia](https://en.wikipedia.org/wiki/IPhone_Duo)
