# 작업 메모 (책장성경 iPhone 앱)

## 왜 앱으로 만드나
- 홈 화면 웹앱(PWA)은 iOS 27.2 이후 듀오에서 오른쪽 상태 영역(약 84px)을 뺀 867px 창으로 열려, 그 띠를 웹페이지가 쓸 수 없었다.
- 네이티브 앱(iOS 27 SDK로 빌드)은 네이버 지도·은행 앱처럼 화면 전체를 쓰고, 안전영역(약 84)을 `env(safe-area-inset-right)`로 받는다.
- 웹앱은 원래 그 상태(전체 폭 + 오른쪽 안전영역 84)를 전제로 설계돼 있어, 껍데기 앱만 씌우면 된다.

## 결정 사항
- 무료 Apple ID로 서명 → **7일마다 다시 서명** 필요. 설치는 Windows PC의 Sideloadly.
- Mac이 없어 GitHub Actions(`xcode-27` 러너, 공개 저장소라 무료)에서 빌드한다. 서명 전 IPA를 만든다.
- 앱 구조: Swift + WKWebView. 웹 파일(`www/`)은 앱 안에 넣고 `bibleflip://app/index.html` 주소로 연다(인터넷 불필요).
- 웹앱 원본은 `bible_duo` 저장소(GitHub Pages)와 같은 파일이다. 앱 전용 동작은 웹앱 안에서 `NATIVE`(주소가 `bibleflip:`)일 때만 켜진다.
- 설정·하이라이트·설교노트는 앱마다 따로 저장된다 → PWA에서 `데이터 백업`으로 복사해 앱에서 `불러오기`.

## 파일
- `project.yml` : XcodeGen 설정(Info.plist 내용 포함). `UILaunchScreen`이 있어야 iOS가 앱을 전체 화면으로 연다.
- `BibleFlip/*.swift` : 앱 코드. `ViewController`가 웹뷰를 안전영역 아래까지 깔고(`contentInsetAdjustmentBehavior = .never`), 웹이 보내는 테마로 상태 표시줄 색과 바탕색을 바꾼다.
- `www/` : 웹앱 복사본. `scripts/sync-web.sh <웹앱 폴더>`로 갱신.
- `.github/workflows/build-ios.yml` : push하면 빌드 → Release `latest`에 `BibleFlip.ipa` 업로드. 빌드 기록은 `build-logs` 브랜치에 남는다.

## 설치 (Windows PC)
1. 아이폰 개발자 모드 켜기(설정 → 개인정보 보호 및 보안 → 개발자 모드).
2. 저장소 Releases의 `latest`에서 `BibleFlip.ipa` 내려받기.
3. Sideloadly에 IPA를 끌어다 놓고 Apple ID로 설치.
4. 설정 → 일반 → VPN 및 기기 관리에서 개발자 앱 신뢰.

## 확인할 것 (실기기)
- 오른쪽 열까지 책이 이어지는지, 머리줄 버튼이 상태 아이콘과 겹치지 않는지.
- 고급설정 → 화면 정보: 안전영역 우측 값, 앱 버전 `v38 (아이폰 앱)`.
- 테마 변경 시 상태 표시줄 글자색이 따라 바뀌는지.

## 진행 기록
- 2026-11-18: 프로젝트 생성, 첫 빌드 시도.
