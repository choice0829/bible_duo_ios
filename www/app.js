/* 책장성경 — 개역한글 + 책 넘김 효과 (PWA)
 * - 쪽 나누기: 숨은 요소(#measure)에 글을 넣어 보며 한 쪽에 들어가는 만큼 자른다.
 * - 책 넘김: page-flip(StPageFlip) 라이브러리
 * - 화면이 넓으면(펼친 상태) 두 쪽, 좁으면(접힌 상태) 한 쪽
 */
(() => {
  'use strict';

  // ---------- 설정 ----------
  const AUTO_SPREAD_MIN_WIDTH = 700;   // 자동 모드에서 이 폭(px) 이상이면 두 쪽 펼침
  const AUTO_SPREAD_MIN_LANDSCAPE = 640;   // 가로로 눕힌 화면(폭 > 높이)은 이 폭부터 두 쪽 (아이폰 SE 가로 667 등)
  const COMPACT_H = 500;   // 높이가 이보다 낮으면(가로로 돌린 아이폰) 머리줄을 작게 줄여 본문 자리를 넓힌다
  // 여백 기본값. 설정 → 고급설정에서 바꾸거나 기본값으로 되돌릴 수 있다.
  //  - 윗 여백: 머리줄(책 이름·메뉴)과 상태 아이콘이 차지하는 윗부분(px)
  //  - 가로 위치: 펼친 화면에서 두 쪽을 오른쪽으로 옮기는 양(px)
  //  - 아래 여백(펼침): 펼친 화면의 맨 아래 비워 두는 높이(px)
  const TOP_DEFAULT = { topSpread: 96, topSingle: 150 };
  const TOP_COMPACT = { topSpread: 58, topSingle: 100 };   // 낮은 화면용
  const SHIFT_DEFAULT = 52;        // 아이폰 듀오 펼침 기준 (아래 geometry의 duo)
  const SPREAD_MIN_SHIFT = 28;     // 그 밖의 기기: 책 왼쪽에 최소로 남기는 폭 (노트 탭이 붙는 자리)
  const BOTTOM_SPREAD_DEFAULT = 20;
  // 아이폰 앱(껍데기) 전용 — 펼친 화면의 책을 '카드'로 둔다: 좌우 여백을 같게, 아래도 화면 끝에서 띄운다.
  const NATIVE_TEXT_OUT = 38;           // 앱 펼침: 화면 바깥쪽 가장자리에서 본문 글자까지(px). 책 카드 없이 화면 전체를 책장으로 쓴다 (v41, v64: 30 → 24, v65: 26, v66: 노트 탭이 화면 끝에서 10px 떨어지고 본문과도 10px 띄우도록 38)
  const NATIVE_SIDE_SINGLE = 24;        // 앱 한 쪽(접은·세로) 화면: 본문 좌우 여백(px). 웹앱은 8 (v43)
  const NATIVE_TEXT_IN = 22;            // 앱 펼침: 가운데(책등) 쪽 글자 여백(px). 두 쪽 사이 간격은 이 값의 두 배
  const NATIVE_BOTTOM_GAP = 12;         // 앱 펼침: 본문 아래 끝과 화면 맨 아래 사이(px, 안전영역이 더 크면 그만큼). 낮은 화면(가로로 돌린 아이폰)은 10
  const NATIVE_HEAD_STAGE_GAP = 16;     // 머리줄(책 이름·메뉴) 아래에서 카드 윗면까지(px). 웹앱은 6 (v40: 책 이름을 10px 위로)
  const NATIVE_BOTTOM_GAP_COMPACT = 10;
  const NATIVE_PAD_BOTTOM = 14;         // 앱 펼침: 위 간격에 더하는 본문 아래 여백(px)
  const NATIVE_PILL_BOTTOM = 118;       // 듀오 오른쪽 열의 상태 알약(시계·배터리)이 끝나는 높이(실기기 화면에서 잰 약 114px + 4px). 글자가 알약 쪽까지 올 때 본문·책장 넘김 영역은 이 아래에서 시작한다
  const NATIVE_PILL_LEFT = 10;          // 알약이 오른쪽 열(안전영역) 왼쪽 끝에서 안쪽으로 들어온 만큼(px)
  // 여백 기본값을 바꿀 때 이 번호를 올리면, 기기에 저장돼 있던 펼침 여백 값이 새 기본값으로 한 번 바뀐다.
  const MARGIN_REV = 19;
  const TOP_MIN_SPREAD = 48, TOP_MIN_SINGLE = 96, TOP_MAX = 280;
  const SIDE_PAD = 8;   // 본문 좌우 여백(px). 더 줄이려면 숫자를 낮추세요
  const FONT_MIN = 14, FONT_MAX = 30;
  const NATIVE = location.protocol === 'bibleflip:' || /[?&]native=1/.test(location.search);   // 아이폰 앱(껍데기) 안에서 열린 경우 (index.html 맨 위 스크립트도 같은 기준으로 html.native를 단다)
  const APP_VER = 'v73';   // sw.js의 CACHE 숫자와 함께 올린다. (v68부터 화면에는 표시하지 않는다. 설치된 앱의 버전은 IPA 안의 app.js·Info.plist 로 확인한다.)
  const THEMES = { paper: '종이', sepia: '세피아', night: '야간' };
  const SYS_SERIF = '"AppleMyungjo","Noto Serif KR","Noto Serif CJK KR","Apple SD Gothic Neo",serif';
  const SYS_SANS = '"Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",-apple-system,sans-serif';
  // 글씨체: face가 있는 것은 fonts/ 폴더의 글꼴 파일(앱에 포함, 오프라인 사용 가능)
  const FONTS = {
    myeongjo: { label: '기본 명조', stack: SYS_SERIF },
    gothic: { label: '기본 고딕', stack: SYS_SANS },
    nanumM: { label: '나눔명조', face: 'KF Nanum Myeongjo', stack: '"KF Nanum Myeongjo",' + SYS_SERIF },
    gowunB: { label: '고운바탕', face: 'KF Gowun Batang', stack: '"KF Gowun Batang",' + SYS_SERIF },
    gowunD: { label: '고운돋움', face: 'KF Gowun Dodum', stack: '"KF Gowun Dodum",' + SYS_SANS },
    nanumG: { label: '나눔고딕', face: 'KF Nanum Gothic', stack: '"KF Nanum Gothic",' + SYS_SANS },
  };
  const LAYOUTS = { auto: '자동', single: '한 쪽', spread: '펼침(두 쪽)' };

  const $ = (s) => document.querySelector(s);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const store = {
    get(key, fallback) {
      try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key))); }
      catch (e) { return Object.assign({}, fallback); }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 무시 */ } },
  };

  // 처음 설치한 기기는 여백 값을 저장하지 않는다 → 화면 크기·안전영역에 맞춰 자동으로 정해진다 (geometry의 auto).
  // 고급설정에서 직접 바꾼 값만 저장되고, 그 값이 자동값보다 우선한다.
  const freshInstall = (() => { try { return localStorage.getItem('bf.settings') === null; } catch (e) { return true; } })();
  let settings = store.get('bf.settings', { fontSize: 18, theme: 'paper', layout: 'auto', font: 'myeongjo', std: false });
  delete settings.desk;   // v63: 책상 질감 설정은 없앴다(이전 버전이 저장해 둔 값은 버린다)
  // 이전 버전에서 저장된 펼침 여백(윗 144 · 아래 8 등)을 새 기본값(96 · 52 · 20)으로 한 번만 바꾼다.
  // 이후에는 고급설정에서 바꾼 값이 그대로 유지된다. (처음 설치한 기기는 해당 없음)
  if (settings.marginRev !== MARGIN_REV) {
    settings = Object.assign({}, settings, freshInstall ? { marginRev: MARGIN_REV } : {
      topSpread: TOP_DEFAULT.topSpread, shiftX: SHIFT_DEFAULT, bottomSpread: BOTTOM_SPREAD_DEFAULT, marginRev: MARGIN_REV,
    });
    store.set('bf.settings', settings);
  }
  // 아이폰 앱: 카드 여백 기본값이 바뀐 버전(NATIVE_REV)에서는 저장돼 있던 여백 값(윗·가로 위치·아래)을 한 번 지워 새 기본값을 쓴다.
  // 그 뒤 고급설정에서 바꾼 값은 그대로 유지된다. (글자 크기·테마·글씨체는 건드리지 않는다)
  const NATIVE_REV = 3;
  if (NATIVE && settings.nativeRev !== NATIVE_REV) {
    settings = Object.assign({}, settings, { nativeRev: NATIVE_REV });
    delete settings.topSpread; delete settings.shiftX; delete settings.bottomSpread;
    store.set('bf.settings', settings);
  }
  let pos = store.get('bf.pos', { book: 0, chapter: 0, verse: 1 });
  // 표시(하이라이트·동그라미 등): { 'gen.6.8': [ { id, s, e, kind, pen, c } ] }  (s~e = 그 절 본문의 글자 위치)
  let anns = store.get('bf.ann', {});
  let tool = store.get('bf.tool', { pen: 'marker', c: 0 });   // 마지막으로 고른 펜 종류와 색
  // 설교노트: { items: [ { id, title, body, date:'YYYY-MM-DD', bk:'jhn', c1, v1, c2, v2 (장은 1부터), ts } ] }
  let notesDB = store.get('bf.notes', { items: [] });
  if (!Array.isArray(notesDB.items)) notesDB = { items: [] };
  const NOTE_COLORS = ['#C2553B', '#2F7FB5', '#3E9468', '#B58A2B', '#7C5BB0', '#CC5C8E'];
  let sel = null;       // 지금 고른 낱말들 { items: [{ bookId, k, s, e }], act: 마지막으로 만진 범위 번호 }
  let selecting = false; // 길게 누른 채 끌어서 범위를 넓히는 중
  let bible = null;     // { version, books: [{id, name, chapters: [[{n,t}]]}] }
  let flip = null;      // St.PageFlip (펼친 화면에서만)
  let flipUp = 0;       // 넘길 때 들린 쪽이 책 위쪽 경계 밖으로 올라가도 보여 주는 높이(px) — 머리줄과 책 사이 간격 안쪽만, 아이폰 앱 펼침에서만 (v56)
  let scroller = null;  // 접힌(한 쪽) 화면: 한 쪽씩 옆으로 밀어 넘기는 스크롤 영역
  let scrollIdx = 0;
  let pg = null;        // 현재 책의 쪽 나누기 결과
  let generation = 0;   // 오래된 비동기 작업을 버리기 위한 번호
  let lastGeo = '';

  const stage = $('#stage');
  const measure = $('#measure');

  // ---------- 화면 크기 ----------
  // 실제로 화면을 채우는 보이지 않는 요소의 크기를 잰다. (접기/펼치기 직후 innerWidth가 어긋나는 경우를 피한다)
  const vp = document.createElement('div');
  vp.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;visibility:hidden;pointer-events:none;z-index:-1';
  document.body.appendChild(vp);
  function viewSize() {
    return {
      w: Math.floor(vp.clientWidth || window.innerWidth),
      h: Math.floor(vp.clientHeight || window.innerHeight),
    };
  }
  let siLast = null, nudgeUntil = 0;   // 가벼운 확인(viewport 갈아 끼우기) 중에는 안전영역이 잠깐 0으로 읽히므로, 그동안은 직전 값을 쓴다
  function safeInsets() {
    if (siLast && Date.now() < nudgeUntil) return Object.assign({}, siLast);
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const r = {
      top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0,
    };
    probe.remove();
    siLast = r;
    return Object.assign({}, r);
  }

  // 머리줄 크기: 접힘(한 쪽) = 책 이름 위 + 메뉴 아래(두 줄), 펼침 = 한 줄. 높이를 CSS와 같은 값으로 계산해 둔다.
  const HEAD_TOP_GAP = 4;    // 안전영역(상태 표시줄) 아래에서 머리줄까지
  const HEAD_BODY_GAP = 8;   // 머리줄 아래에서 본문 첫 줄까지 (최소)
  const TXT_GAP = 10;        // 펼친 화면: 책(무대) 맨 위에서 본문 첫 줄까지. 책이 머리줄 아래에서 시작하므로 넘김 효과가 머리줄을 덮지 않는다
  const HEAD_STAGE_GAP = 6;  // 펼친 화면: 머리줄 아래에서 책 위쪽 가장자리까지
  const MENU_H = 36, MENU_H_COMPACT = 32;
  // 한 쪽(접힘·세로) 화면의 메뉴 단추: 책 이름 오른쪽에 2줄로 놓는다 (7개 → 윗줄 3개 · 아랫줄 4개, 둘 다 오른쪽 끝에 맞춤). 펼친 화면은 한 줄.
  // 줄 배치는 style.css(.menu-row 의 nth-child)가 정한다. MENU_COLS = 아랫줄 개수(가장 많은 줄).
  const MENU_COUNT = 7, MENU_COLS = 4, MENU_ROWS = 2;
  function headBox(spread, compact) {
    const titleFs = compact ? 30 : 44, titleH = Math.ceil(titleFs * 1.2);
    const menuH = compact ? MENU_H_COMPACT : MENU_H;
    const gridH = MENU_ROWS * menuH + (MENU_ROWS - 1) * (compact ? 5 : 6);   // 메뉴 덩어리의 높이 (CSS의 줄 간격과 같은 값)
    return { titleFs, titleH, menuH, rowH: spread ? Math.max(titleH, menuH) : Math.max(titleH, gridH) };
  }

  // 기기마다 다른 값(윗 여백·가로 위치·아래 여백)은 설정에 저장된 값이 있으면 그것을, 없으면 화면에 맞춘 자동값을 쓴다.
  //  - 아이폰 듀오(펼침): 오른쪽 안전영역만 크게 알려 오고(약 84px) 왼쪽은 0 → 예전과 같은 값(96 · 52 · 20)
  //  - 노치·다이내믹 아일랜드 아이폰을 가로로 돌린 화면: 좌우 안전영역이 같게 알려 온다 → 양쪽을 그만큼 비운다
  //  - 낮은 화면(가로로 돌린 아이폰): 머리줄을 작게 줄여 본문 줄 수를 늘린다
  function geometry() {
    const { w: W, h: H } = viewSize();
    const si = safeInsets();
    const spread = settings.layout === 'spread' ||
      (settings.layout === 'auto' && (W >= AUTO_SPREAD_MIN_WIDTH || (W >= AUTO_SPREAD_MIN_LANDSCAPE && W > H)));
    const compact = H < COMPACT_H;
    // 듀오 펼침: 오른쪽 안전영역만 크게 알려 오거나, 화면 크기가 듀오 펼침(867×587 안팎)이고 왼쪽 안전영역이 없는 경우
    const duo = spread && si.left < 8 && (si.right >= 60 || (W >= 800 && W <= 940 && H >= 540 && H <= 640));
    const sym = si.left >= 8 && Math.abs(si.left - si.right) <= 8;
    const auto = {
      topSpread: compact ? TOP_COMPACT.topSpread : TOP_DEFAULT.topSpread,
      topSingle: compact ? TOP_COMPACT.topSingle : TOP_DEFAULT.topSingle,
      shiftX: duo ? SHIFT_DEFAULT : Math.max(Math.round(si.left), SPREAD_MIN_SHIFT),
      bottomSpread: NATIVE && spread ? NATIVE_PAD_BOTTOM + Math.max(compact ? NATIVE_BOTTOM_GAP_COMPACT : NATIVE_BOTTOM_GAP, Math.round(si.bottom)) : duo ? BOTTOM_SPREAD_DEFAULT : Math.max(Math.round(si.bottom), compact ? 10 : BOTTOM_SPREAD_DEFAULT),
    };
    const eff = {};
    Object.keys(auto).forEach((k) => { eff[k] = typeof settings[k] === 'number' ? settings[k] : auto[k]; });
    // 펼친 화면: 오른쪽으로 옮긴 만큼 쪽 폭을 줄여, 오른쪽 끝이 화면 밖으로 잘리지 않게 한다
    // 아이폰 앱(펼침)은 책 카드 없이 화면 전체를 책장으로 쓴다(full): 책을 옮기지 않고(shiftX 0), 글자 여백만 둔다.
    const full = NATIVE && spread;
    const shiftX = spread && !full ? eff.shiftX : 0;
    const rightReserve = spread && sym && !full ? Math.round(si.right) : 0;
    const pageW = spread ? Math.floor((W - shiftX - rightReserve) / 2) : W;
    // 좌우 안전영역: 듀오는 오른쪽 상태 아이콘 때문에 오른쪽만 84px로 알리는데 아이콘은 맨 위에만 있고 윗부분은 따로 비워 두므로
    // 본문 좌우는 끝까지 쓴다. 노치 아이폰 가로 화면(좌우가 같음)은 한 쪽 보기일 때 그만큼 비운다. (펼침은 책 자체를 안쪽으로 둔다)
    const padX0 = !spread && sym ? Math.max(SIDE_PAD, Math.round(Math.max(si.left, si.right))) : SIDE_PAD;
    const padX = NATIVE && !spread ? Math.max(NATIVE_SIDE_SINGLE, padX0) : padX0;   // 앱 한 쪽 화면은 좌우 여백을 넉넉히
    // 앱 펼침: 바깥쪽(화면 가장자리 쪽)·안쪽(책등 쪽) 글자 여백을 따로 둔다. 노치·왼쪽 열 같은 안전영역은 글자가 피한다(듀오 오른쪽 열은 알약이 맨 위에만 있어 쓴다).
    const sideSafe = duo ? 0 : Math.round(Math.max(si.left, si.right));
    const padOut = full ? Math.max(NATIVE_TEXT_OUT, sideSafe + SIDE_PAD) : padX;
    const padIn = full ? NATIVE_TEXT_IN : padX;
    // 윗부분: 머리줄(책 이름·버튼)과 상태 아이콘 자리. 아랫부분 여백은 최소로 줄여 이쪽으로 옮겼다.
    // 머리줄(책 이름·메뉴)이 실제로 차지하는 높이를 계산해, 본문이 언제나 그 아래에서 시작하게 한다.
    // (상태 표시줄 자리가 큰 기기의 세로 화면에서 메뉴 단추가 본문 첫 줄을 덮던 문제)
    const hb = headBox(spread, compact);
    const topSetting = spread ? eff.topSpread : eff.topSingle;
    // 아이폰 앱(듀오): 글자가 오른쪽 열 쪽까지 들어와 상태 알약(약 x 877~930, y 22~114)과 겹치면, 본문과 책장 넘김 영역의 윗면을 알약 아래로 내린다.
    const cardRight = shiftX + pageW * 2;
    const intoPill = NATIVE && spread && !sym && si.right >= 60 && cardRight > W - si.right + NATIVE_PILL_LEFT;
    const padTop = Math.max(
      si.top + 56,
      Math.ceil(si.top + HEAD_TOP_GAP + hb.rowH + HEAD_BODY_GAP),
      Math.min(TOP_MAX, Math.round(topSetting) || (spread ? TOP_DEFAULT.topSpread : TOP_DEFAULT.topSingle)),
      intoPill ? NATIVE_PILL_BOTTOM + TXT_GAP : 0
    );
    const padBottom = spread ? eff.bottomSpread : si.bottom + 10;
    // 펼친 화면: 책 자체를 머리줄 아래(본문 첫 줄 위 TXT_GAP)에서 시작시킨다. 본문 글자가 놓이는 화면 위치와 쪽 나누기(textH)는 그대로다.
    // 한 쪽(접힘) 화면은 본문 스크롤 영역이 이미 머리줄 아래(--padtop)에서 시작한다.
    const stageTop = spread ? Math.max(0, padTop - TXT_GAP) : 0;
    const pageH = H - stageTop;
    const txtTop = padTop - stageTop;
    // 머리줄(책 이름·메뉴)의 오른쪽 끝: 책의 오른쪽 본문 끝에 맞추되, 오른쪽 안전영역(상태 아이콘 자리)은 피한다
    const bookRight = spread ? shiftX + pageW * 2 : W;
    const headR = Math.max(Math.round(W - bookRight + padOut), Math.round(si.right) + (spread ? 8 : 14), 14);
    return {
      W, H, spread, compact, duo, sym, pageW, pageH, bookW: spread ? pageW * 2 : pageW,
      padX: full ? padOut : padX, padOut, padIn, full, tabEdge: full ? Math.max(padOut - 10, 0) : shiftX,
      padTop, padBottom, si, shiftX, eff, stageTop, txtTop, headR, intoPill,
      textW: pageW - padOut - padIn, textH: pageH - txtTop - padBottom,
    };
  }

  // 책 이름이 길어 한 줄에 다 안 들어가면 글자를 조금씩 줄여 이름이 잘리지 않게 한다 (최소 16px)
  function fitTitle() {
    const b = $('#loc-book');
    if (!b) return;
    const root = document.documentElement.style;
    const base = lastTitleFs || 44;
    let fs = base;
    root.setProperty('--title-fs', fs + 'px');
    while (fs > 16 && b.scrollWidth > b.clientWidth + 1) { fs -= 2; root.setProperty('--title-fs', fs + 'px'); }   // v70: 아이콘이 4열이 되어 좁아진 작은 폰(SE)에서 '데살로니가전·후서'가 잘리지 않도록 최소를 18 → 16px
  }
  let lastTitleFs = 44;

  // 테마(종이·세피아·야간)를 body 클래스로 적용하고, 상태 표시줄 색(theme-color)을 책상 색에 맞춘다. (v63: 책상 질감은 없앴다 — 책상은 테마 색 한 가지)
  const themeHooks = [];   // 테마가 적용될 때마다 부를 함수들(모임 장소 지도가 바탕·색을 다시 맞출 때 쓴다)
  function applyDesk() {
    const look = ' theme-' + settings.theme;
    const strip = (el) => el.className.replace(/\b(theme|desk)-\w+/g, '').replace(/\s+/g, ' ').trim();
    document.body.className = strip(document.body) + look;
    // html(캔버스)에도 같은 클래스를 달아, 책 바깥 여백(듀오 오른쪽 안전영역 등)이 흰색 대신 책상 색·질감으로 칠해지게 한다
    document.documentElement.className = (strip(document.documentElement) + look).trim();
    refreshSystemColor();
    // 아이폰 앱: 상태 표시줄 글자색(밝게/어둡게)과 빈틈 색을 테마에 맞추도록 앱에 알린다
    try { if (NATIVE) window.webkit.messageHandlers.bf.postMessage({ theme: settings.theme }); } catch (e) { /* 무시 */ }
    themeHooks.forEach((f) => { try { f(); } catch (e) { /* 무시 */ } });
  }
  // iOS가 오른쪽(듀오 시스템 띠)·위쪽 색을 읽는 곳(theme-color, 가장자리에 닿은 고정 요소)은 테마를 바꿔도 곧바로 다시 읽지 않는 경우가 있다.
  // (v36 실기기: 야간으로 바꿨는데 띠에 세피아색이 그대로 남음) → 색이 바뀌면 meta와 가장자리 띠를 새 노드로 갈아 끼우고, 잠시 뒤 두 번 더 한다.
  // 앱을 켤 때·다시 열 때·화면 크기가 바뀔 때(접기/펴기)도 같은 방식으로 한 번씩 다시 읽게 한다.
  let sysColorKey = '', sysColorTimers = [];
  function refreshSystemColor(force) {
    if (NATIVE) return;   // 앱 안에서는 시스템 띠 색을 읽을 일이 없다
    const desk = getComputedStyle(document.body).getPropertyValue('--desk').trim();
    if (!desk) return;
    const key = settings.theme + '|' + desk;
    if (!force && key === sysColorKey) return;
    sysColorKey = key;
    const swap = () => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color'; meta.content = desk;
      const old = document.querySelector('meta[name="theme-color"]');
      if (old) old.replaceWith(meta); else document.head.appendChild(meta);
      ['desk-edge-l', 'desk-edge-r'].forEach((id) => { const el = document.getElementById(id); if (el) el.replaceWith(el.cloneNode(false)); });
    };
    swap();
    sysColorTimers.forEach(clearTimeout);
    sysColorTimers = [150, 700].map((ms) => setTimeout(swap, ms));
  }
  let sysColorDebounce = 0;
  const nudgeSystemColor = () => { clearTimeout(sysColorDebounce); sysColorDebounce = setTimeout(() => refreshSystemColor(true), 200); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) nudgeSystemColor(); });
  window.addEventListener('pageshow', nudgeSystemColor);
  window.addEventListener('resize', nudgeSystemColor);
  function applyLook(g) {
    const root = document.documentElement.style;
    root.setProperty('--fs', settings.fontSize + 'px');
    const fstack = (FONTS[settings.font] || FONTS.myeongjo).stack;
    root.setProperty('--serif', fstack);
    root.setProperty('--sans', fstack);   // 상단 메뉴·굵은 글씨·창도 같은 글씨체
    root.setProperty('--padx', g.padX + 'px');
    root.setProperty('--padout', g.padOut + 'px');   // 펼침 쪽의 바깥쪽·안쪽 글자 여백 (앱 펼침에서만 서로 다름)
    root.setProperty('--padin', g.padIn + 'px');
    root.setProperty('--padtop', g.padTop + 'px');
    root.setProperty('--txttop', g.txtTop + 'px');   // 쪽 안에서 본문이 시작하는 높이 (펼침: 책 위쪽 가장자리 기준)
    root.setProperty('--headh', (g.spread ? g.stageTop : g.padTop) + 'px');   // 머리줄 영역의 높이 (책·본문이 시작하기 전까지)
    root.setProperty('--headr', g.headR + 'px');
    flipUp = g.full ? Math.max(0, NATIVE_HEAD_STAGE_GAP - 1) : 0;   // 아이폰 앱 펼침(html.full)에서만. 웹(PC)은 책 카드 그림자가 있어 예전 그대로 둔다
    root.setProperty('--flip-up', flipUp + 'px');   // style.css: #stage 가 위쪽으로 이만큼 더 보여 준다(책장이 넘어갈 때 윗부분이 한 줄로 잘리지 않게)
    root.setProperty('--padbottom', g.padBottom + 'px');
    // 상단: 접힘 = 책 이름 위, 메뉴 아래(본문 바로 위) / 펼침 = 한 줄(책 이름 왼쪽, 메뉴 오른쪽)
    const hb = headBox(g.spread, g.compact), titleFs = hb.titleFs, rowH = hb.rowH;
    lastTitleFs = titleFs;
    root.setProperty('--title-fs', titleFs + 'px');
    root.setProperty('--menu-cols', MENU_COLS);
    root.setProperty('--head-top', Math.max(g.si.top + HEAD_TOP_GAP, (g.spread ? g.stageTop - (NATIVE ? NATIVE_HEAD_STAGE_GAP : HEAD_STAGE_GAP) : g.padTop - 12) - rowH) + 'px');
    applyDesk();
    stage.style.width = g.bookW + 'px';
    stage.style.height = g.pageH + 'px';
    stage.style.top = g.stageTop ? g.stageTop + 'px' : '';
    stage.dataset.o = g.H >= g.W ? 'portrait' : 'landscape';   // CSS가 돌리는 순간 낡은 무대를 바로 숨기는 데 쓴다
    stage.style.marginLeft = g.shiftX ? g.shiftX + 'px' : '';   // 펼친 화면 가운데 맞춤
    root.setProperty('--shiftx', g.shiftX + 'px');
    // 머리줄(책 이름·메뉴)의 왼쪽 끝: 펼침은 책 왼쪽 가장자리 + 14, 한 쪽은 안전영역 + 14. (좌우가 같은 아이폰은 책 자체가 이미 안쪽이다)
    root.setProperty('--headx', (g.full ? g.padOut : NATIVE && !g.spread ? g.padX : (g.spread ? (g.sym ? 0 : g.si.left) + g.shiftX : g.si.left) + 14) + 'px');
    stage.classList.toggle('spread', g.spread);
    document.body.classList.toggle('is-spread', g.spread);
    document.documentElement.classList.toggle('full', !!g.full);   // 앱 펼침: 책 카드 없이 한 색 바탕
    document.body.classList.toggle('is-compact', g.compact);
    fitTitle();
  }

  // ---------- 표시(하이라이트 · 동그라미 · 네모 · 물결 · 밑줄) ----------
  const markKey = (bookId, k) => bookId + '.' + (Math.floor(k / 1000) + 1) + '.' + (k % 1000);
  const KINDS = { fill: '형광', circle: '동그라미', rect: '네모', wave: '물결', under: '밑줄' };
  const KIND_ORDER = { fill: 0, under: 1, wave: 2, rect: 3, circle: 4, sel: 5 };
  const PENS = { marker: '싸인펜', pencil: '색연필' };
  const COLORS = [
    { n: '노랑', f: '#FFD93B', s: '#E3A400' },
    { n: '초록', f: '#7BD88F', s: '#2FA84F' },
    { n: '파랑', f: '#6EC1FF', s: '#2F86E0' },
    { n: '분홍', f: '#FF8FB8', s: '#E23E7C' },
    { n: '주황', f: '#FFA65C', s: '#E8661A' },
  ];
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const saveAnns = () => {
    Object.keys(anns).forEach((k) => { if (!anns[k] || !anns[k].length) delete anns[k]; });
    store.set('bf.ann', anns);
  };

  // 손으로 그린 듯한 모양은 작은 SVG 그림을 배경으로 깔아 만든다. (글자 위치·줄 바꿈에는 영향이 없다)
  // 같은 모양이 모두 똑같아 보이지 않도록 표시마다 3가지 변형 중 하나를 쓴다.
  const styleEl = document.createElement('style');
  document.head.appendChild(styleEl);
  const ruleDone = new Set();
  function seedOf(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed | 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const fx = (v) => v.toFixed(1);
  const poly = (pts, close) => 'M' + pts.map((q) => fx(q[0]) + ',' + fx(q[1])).join(' L') + (close ? ' Z' : '');
  const svgBG = (inner, vb) => 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" preserveAspectRatio="none">' + inner + '</svg>') + '")';
  const rgba = (hex, al) => {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + al + ')';
  };

  // 색연필 칠: 작은 캔버스에 쓱쓱 칠한 빗금과 종이결(군데군데 비치는 점)을 한 번만 그려 이미지로 만들고, 가로로 이어 붙여 깐다.
  // 무거운 SVG 필터를 쓰지 않아 아이폰에서도 가볍다. 캔버스를 못 쓰는 환경이면 null을 돌려주고 가는 빗금 그라데이션으로 대신한다.
  const tileCache = {};
  function pencilTile(col, v) {
    const key = col.f + v;
    if (key in tileCache) return tileCache[key];
    let url = null;
    try {
      const W = 192, H = 48, rad = Math.PI / 180;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      const r = rng(seedOf('tile' + key));
      g.lineCap = 'butt';
      // 한 번 긋기: 시작과 끝은 힘을 빼 옅게, 가운데는 진하게. 가로로 이어 붙여도 끊기지 않게 양옆에도 한 번씩 더 그린다.
      const hatch = (color, lw, alpha, ang, y0, y1, x) => {
        const sn = Math.sin(ang * rad), len = (y1 - y0) / sn, dx = Math.cos(ang * rad) * len;
        [-W, 0, W].forEach((ox) => {
          const px = (t) => x + ox + dx * t, py = (t) => y0 + (y1 - y0) * t;
          [[0, .3, .4, .8], [.3, .72, 1, 1], [.72, 1, .55, .75]].forEach(([a, b, al, wk]) => {
            g.strokeStyle = color; g.globalAlpha = alpha * al; g.lineWidth = lw * wk;
            g.beginPath(); g.moveTo(px(a), py(a)); g.lineTo(px(b), py(b)); g.stroke();
          });
        });
      };
      for (let i = 0; i < 40; i++) {   // 주된 빗금: 가파른 사선. 끝나는 높이가 제각각이라 위아래 가장자리가 거칠다
        hatch(col.f, 2.4 + r() * 1.2, .72 + r() * .26, 68 + v * 4 + (r() - .5) * 12, H * (.02 + .22 * r()), H * (.7 + .28 * r()), r() * W);
      }
      for (let i = 0; i < 14; i++) {   // 반대 방향으로 살짝 덧칠: 진한 색, 옅게
        hatch(col.s, 2 + r() * .8, .3 + r() * .22, 108 - v * 3 + (r() - .5) * 10, H * (.18 + .2 * r()), H * (.65 + .3 * r()), r() * W);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'destination-out';   // 종이결: 군데군데 색이 비어 종이가 비친다
      for (let i = 0; i < 520; i++) {
        g.fillStyle = 'rgba(0,0,0,' + (.5 + r() * .5).toFixed(2) + ')';
        const s = 1.2 + r() * 2.2;
        g.fillRect(r() * W, r() * H, s, s * (.6 + r() * .8));
      }
      url = cv.toDataURL('image/png');
    } catch (e) { url = null; }
    tileCache[key] = url;
    return url;
  }

  // 표시 하나에 쓸 클래스 이름. 처음 쓰일 때 CSS를 만든다.
  // 색연필: 칠은 위의 빗금 이미지로, 선(동그라미·네모·밑줄·물결)은 끊어졌다 이어지는 거친 선을 세 번 겹쳐 그어 표현한다.
  function ruleFor(a) {
    const v = seedOf(a.id) % 3;
    const cls = 'an-' + a.kind + '-' + a.pen + '-' + a.c + '-' + v;
    if (ruleDone.has(cls)) return cls;
    ruleDone.add(cls);
    const col = COLORS[a.c] || COLORS[0];
    const r = rng(seedOf(cls));
    const pencil = a.pen === 'pencil';
    const j = (m) => (r() - 0.5) * m * (pencil ? 1.7 : 1);   // 색연필은 손떨림을 더 크게
    const sattr = (w, op, dash, color, cap) => 'fill="none" stroke="' + (color || col.s) + '" stroke-width="' + w.toFixed(1) +
      '" stroke-linecap="' + (cap || 'round') + '" stroke-linejoin="round" vector-effect="non-scaling-stroke" opacity="' + op + '"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : '');
    // 끊김이 불규칙한 점선. 서로 다른 모양을 겹쳐 그으면 군데군데 종이가 비쳐 보이는 거친 선이 된다
    const grain = (gapMin, gapMax) => {
      const d = [];
      for (let i = 0; i < 18; i++) d.push(i % 2 ? (gapMin + r() * (gapMax - gapMin)).toFixed(1) : (4 + r() * 10).toFixed(1));
      return d.join(' ');
    };
    // 선 모양 만들기: 싸인펜은 매끈한 한 줄, 색연필은 가늘고 거친 선을 조금씩 어긋나게 세 번 긋는다
    const strokes = (gen, w) => pencil
      ? [[0.7, .88, col.s, .3, .8], [0.52, .72, col.s, .4, 1.1], [0.44, .62, col.f, .6, 1.5]].map(([k, op, c, g0, g1]) =>
        '<path d="' + gen() + '" ' + sattr(w * k, op, grain(g0, g1), c, 'butt') + '/>').join('')
      : '<path d="' + gen() + '" ' + sattr(w, 0.9) + '/>';
    // 색연필 선이 곧게 나오지 않도록 각 변을 잘게 나누어 조금씩 흔든다
    const rough = (pts) => {
      if (!pencil) return pts;
      const out = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i], n = Math.max(2, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 9));
        for (let k = 1; k <= n; k++) {
          const t = k / n;
          out.push([p0[0] + (p1[0] - p0[0]) * t + (k < n ? j(0.7) : 0), p0[1] + (p1[1] - p0[1]) * t + (k < n ? j(0.9) : 0)]);
        }
      }
      return out;
    };
    const NR = 'background-repeat:no-repeat;';
    let css = '';
    if (a.kind === 'fill') {
      const top = [], bot = [];
      for (let x = 2; x <= 98; x += 12) { top.push([x + j(1.6), 6 + j(2.8)]); bot.push([x + j(1.6), 35 + j(2.8)]); }
      bot.reverse();
      const d = poly(top.concat(bot), true);
      const tile = pencil ? pencilTile(col, v) : null;
      if (tile) {
        // 아주 옅은 바탕색 위에 빗금 이미지를 가로로 이어 깐다
        const wash = svgBG('<path d="' + d + '" fill="' + col.f + '" fill-opacity=".13"/>', '0 0 100 40');
        css = 'padding:.04em 0 .12em;background-repeat:repeat-x,no-repeat;background-size:auto 82%,100% 100%;background-position:0 70%,0 0;' +
          'background-image:url("' + tile + '"),' + wash;
      } else if (pencil) {   // 캔버스를 못 쓸 때: 가는 빗금 그라데이션
        const base = svgBG('<path d="' + d + '" fill="' + col.f + '" fill-opacity=".3"/>', '0 0 100 40');
        const h1 = 'repeating-linear-gradient(' + (112 + v * 8) + 'deg,' + rgba(col.s, 0.5) + ' 0 1px,transparent 1px ' + (2.7 + v * 0.4) + 'px)';
        const h2 = 'repeating-linear-gradient(' + (68 - v * 6) + 'deg,' + rgba(col.f, 0.75) + ' 0 1.2px,transparent 1.2px ' + (3.5 + v * 0.3) + 'px)';
        css = 'padding:.04em 0 .12em;' + NR + 'background-size:100% 72%,100% 72%,100% 100%;background-position:0 55%,0 55%,0 0;background-image:' + h1 + ',' + h2 + ',' + base;
      } else {
        const inner = '<path d="' + d + '" fill="' + col.f + '" fill-opacity=".5" stroke="' + col.f + '" stroke-opacity=".4" stroke-width="1.4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
        css = 'padding:.04em 0 .12em;' + NR + 'background-size:100% 100%;background-image:' + svgBG(inner, '0 0 100 40');
      }
    } else if (a.kind === 'circle') {
      const gen = () => {
        const pts = [], n = 46, a0 = -2 + j(1), turns = 1.1 + r() * 0.05;
        for (let i = 0; i <= n; i++) {
          const t = i / n, th = a0 + t * turns * Math.PI * 2, k = 1 - t * 0.06 + j(0.03);
          pts.push([50 + Math.cos(th) * 45 * k, 20 + Math.sin(th) * 15.5 * k]);
        }
        return poly(pts);
      };
      css = 'padding:.12em .3em .22em;margin:0 -.3em;' + NR + 'background-size:100% 100%;background-image:' + svgBG(strokes(gen, 2.1), '0 0 100 40');
    } else if (a.kind === 'rect') {
      const gen = () => poly(rough([[6 + j(2), 7 + j(2)], [94 + j(2), 5 + j(2)], [95 + j(2), 35 + j(2)], [5 + j(2), 36 + j(2)], [7 + j(2), 4 + j(2)], [15, 5 + j(1)]]));
      css = 'padding:.1em .2em .2em;margin:0 -.2em;' + NR + 'background-size:100% 100%;background-image:' + svgBG(strokes(gen, 2.1), '0 0 100 40');
    } else if (a.kind === 'under') {
      const gen = () => { const pts = []; for (let x = 1; x <= 99; x += 14) pts.push([x + j(2), 4 + j(1.8)]); return poly(rough(pts)); };
      css = 'padding:0 0 .28em;' + NR + 'background-size:100% .34em;background-position:0 100%;background-image:' + svgBG(strokes(gen, 2.2), '0 0 100 8');
    } else if (a.kind === 'wave') {
      const gen = () => {
        let d = 'M0,4', x = 0;
        for (let i = 0; i < 6; i++) { const dir = i % 2 ? 1 : -1, amp = 2.8 + j(1.4); d += ' Q' + fx(x + 3.33) + ',' + fx(4 + dir * amp) + ' ' + fx(x + 6.67) + ',4'; x += 6.67; }
        return d;
      };
      css = 'padding:0 0 .3em;background-repeat:repeat-x;background-size:2.3em .44em;background-position:0 100%;background-image:' + svgBG(strokes(gen, 1.9), '0 0 40 8');
    }
    styleEl.appendChild(document.createTextNode('.' + cls + '{' + css + '}\n'));
    return cls;
  }

  // 절 본문의 [off, off+raw.length) 부분을 표시가 입혀진 HTML로 만든다.
  // 표시끼리 겹치면 안쪽부터 층층이 감싸고, 엇갈리는 부분은 나누어 감싼다.
  function annOpen(a) {
    return a.kind === 'sel' ? '<span class="a-sel">' : '<span class="a ' + ruleFor(a) + '">';
  }
  function renderRange(text, off, items) {
    if (!items.length) return esc(text);
    items.sort((x, y) => x.s - y.s || y.e - x.e || KIND_ORDER[x.a.kind] - KIND_ORDER[y.a.kind]);
    const first = items[0];
    const inner = [], after = [];
    for (let i = 1; i < items.length; i++) {
      const q = items[i];
      if (q.s < first.e) inner.push({ a: q.a, s: q.s, e: Math.min(q.e, first.e) });
      if (q.e > first.e) after.push({ a: q.a, s: Math.max(q.s, first.e), e: q.e });
    }
    return esc(text.slice(0, first.s - off)) +
      annOpen(first.a) + renderRange(text.slice(first.s - off, first.e - off), first.s, inner) + '</span>' +
      renderRange(text.slice(first.e - off), first.e, after);
  }
  function annotate(bookId, k, off, raw) {
    const list = (anns[markKey(bookId, k)] || []).slice();
    if (sel) sel.items.forEach((i) => { if (i.bookId === bookId && i.k === k) list.push({ id: 'sel', kind: 'sel', s: i.s, e: i.e }); });
    if (!list.length) return esc(raw);
    const end = off + raw.length, items = [];
    list.forEach((a) => {
      const s = Math.max(a.s, off), e = Math.min(a.e, end);
      if (e > s) items.push({ a, s, e });
    });
    return renderRange(raw, off, items);
  }
  // 화면에 있는 그 절의 본문(여러 쪽에 걸쳐 있으면 모두)을 다시 그린다.
  function paintVerse(bookId, k) {
    if (!pg || !bible.books[pg.bookIndex] || bible.books[pg.bookIndex].id !== bookId) return;
    const t = verseText(pg.bookIndex, Math.floor(k / 1000), k % 1000) + ' ';
    document.querySelectorAll('#stage p[data-k="' + k + '"]').forEach((p) => {
      const o = +p.dataset.o, e = +p.dataset.e;
      p.innerHTML = (p.dataset.h ? '<sup class="vn">' + (k % 1000) + '</sup>' : '') + annotate(bookId, k, o, t.slice(o, e));
    });
  }
  // 범위 [s,e)를 지운 나머지 표시들 (pred를 만족하는 표시만 깎는다)
  function cutRange(list, s, e, pred) {
    const out = [];
    list.forEach((a) => {
      if (!pred(a) || a.e <= s || a.s >= e) { out.push(a); return; }
      if (a.s < s) out.push(Object.assign({}, a, { id: newId(), e: s }));
      if (a.e > e) out.push(Object.assign({}, a, { id: newId(), s: e }));
    });
    return out;
  }
  // 예전 방식(절 전체 하이라이트)으로 저장한 것을 새 방식으로 옮긴다.
  function migrateMarks() {
    let old = null;
    try { old = JSON.parse(localStorage.getItem('bf.hl')); } catch (e) { old = null; }
    if (!old || !Object.keys(old).length) return;
    Object.keys(old).forEach((key) => {
      const [id, c, n] = key.split('.');
      const bi = bible.books.findIndex((b) => b.id === id);
      if (bi < 0) return;
      const t = verseText(bi, +c - 1, +n);
      if (!t || (anns[key] && anns[key].length)) return;
      anns[key] = [{ id: newId(), s: 0, e: t.length, kind: 'fill', pen: 'marker', c: 0 }];
    });
    saveAnns();
    try { localStorage.setItem('bf.hl.old', JSON.stringify(old)); localStorage.removeItem('bf.hl'); } catch (e) { /* 무시 */ }
  }

  // ---------- 쉬운 말 풀이 ----------
  // 개역한글 본문을 현대 표준어로 풀어 쓴 글(참고용). 책마다 data/std/<책>.json에 장·절별로 들어 있고, 있는 곳만 보여 준다.
  // 형식: { id, v(고친 횟수), c: { "1": { "1": "문장", ... } } }  /  준비된 곳 목록: data/std/index.json = { v, books: { gen: [1, 2] } }
  const stdBooks = {};          // 책 id → 불러온 내용(없으면 null)
  let stdIndex = null;
  const stdToasted = {};
  async function loadStd(id) {
    if (id in stdBooks) return stdBooks[id];
    let d = null;
    const idx = await loadStdIndex();
    if (!idx.books[id]) { stdBooks[id] = null; return null; }   // 목록에 없는 책은 요청하지 않는다 (없는 파일을 찾느라 지연·오류가 생기지 않게)
    try {
      const r = await fetch('data/std/' + id + '.json', { cache: 'no-cache' });
      if (r.ok) d = await r.json();
    } catch (e) { d = null; }
    stdBooks[id] = d && d.c && typeof d.c === 'object' ? d : null;
    return stdBooks[id];
  }
  async function loadStdIndex() {
    if (stdIndex) return stdIndex;
    try {
      const r = await fetch('data/std/index.json', { cache: 'no-cache' });
      stdIndex = r.ok ? await r.json() : { books: {} };
    } catch (e) { stdIndex = { books: {} }; }
    if (!stdIndex || typeof stdIndex.books !== 'object' || !stdIndex.books) stdIndex = { books: {} };
    return stdIndex;
  }
  function stdFor(bookId, c, n) {   // c: 0부터 시작하는 장 번호
    const b = stdBooks[bookId];
    const ch = b && b.c && b.c[String(c + 1)];
    const t = ch && ch[String(n)];
    return typeof t === 'string' ? t.trim() : '';
  }
  // 쉬운 말 문단에도 설교노트 번호를 달아 두면 스포트라이트(노트 본문만 밝게)가 같이 따라온다
  function stdNoteAttr(bookId, k) {
    const ids = noteIdsAt(bookId, k);
    return ids ? ' data-n="' + ids.join(' ') + '"' : '';
  }

  // ---------- 본문 → 조각(unit) ----------
  // 조각 종류: 0 = 장 제목, 1 = 절 번호, 2 = 낱말, 3 = 쉬운 말 풀이의 낱말(절 아래 작은 글씨)
  // K[i] = 그 조각이 속한 절의 표식(장 번호 × 1000 + 절 번호). 이동 후 절 강조에 쓴다.
  function buildUnits(bookIndex) {
    const book = bible.books[bookIndex];
    const sb = settings.std ? stdBooks[book.id] : null;   // 쉬운 말 풀이(켜 둔 경우만)
    const unitName = book.id === 'psa' ? '편' : '장';
    const T = [], H = [], K = [], W = [], O = [];   // W: 낱말 원문, O: 그 낱말이 절 본문에서 시작하는 글자 위치
    const chapterStart = [], verseAt = [];
    book.chapters.forEach((verses, c) => {
      chapterStart.push(T.length);
      T.push(0); K.push(c * 1000); W.push(''); O.push(-1);
      H.push('<h2 class="ch">' + (c + 1) + unitName + '</h2>');   // 책 이름은 위쪽 머리줄에 있으므로 '11장'만 쓴다
      const va = [];
      verses.forEach((v) => {
        const key = c * 1000 + v.n;
        va.push({ n: v.n, u: T.length });
        T.push(1); K.push(key); W.push(''); O.push(-1);
        H.push('<sup class="vn">' + v.n + '</sup>');
        const words = v.t.split(' ');
        let off = 0;
        words.forEach((w) => { T.push(2); K.push(key); H.push(esc(w) + ' '); W.push(w); O.push(off); off += w.length + 1; });
        const st = sb ? stdFor(book.id, c, v.n) : '';
        if (st) st.split(/\s+/).filter(Boolean).forEach((w) => { T.push(3); K.push(key); H.push(esc(w) + ' '); W.push(w); O.push(-1); });   // 3 = 쉬운 말 낱말
      });
      verseAt.push(va);
    });
    return { T, H, K, W, O, chapterStart, verseAt, unitName, bookIndex, bookId: book.id, stdVer: sb ? String(sb.v || 1) : '' };
  }

  // 절마다 새 문단(<p>)으로 시작한다. 쪽이 절 중간에서 시작하면 이어지는 문단으로 연다.
  // 문단에는 data-o(절 본문에서 이 문단이 시작하는 글자 위치)·data-e(끝)를 달아, 낱말 선택·표시 위치를 알아낸다.
  function sliceHTML(u, a, b) {
    let out = '', cur = null;
    const close = () => {
      if (!cur) return;
      if (cur.std) {   // 쉬운 말 문단: 낱말 선택·하이라이트 대상이 아니므로 data-k 대신 data-s를 단다
        out += '<p class="std" data-s="' + cur.k + '"' + stdNoteAttr(u.bookId, cur.k) + '>' + esc(cur.raw.trim()) + '</p>';
        cur = null;
        return;
      }
      const o = Math.max(cur.off, 0);
      out += '<p data-k="' + cur.k + '" data-o="' + o + '" data-e="' + (o + cur.raw.length) + '"' + (cur.head ? ' data-h="1"' : '') + noteAttrs(u.bookId, cur.k) + '>' +
        cur.head + annotate(u.bookId, cur.k, o, cur.raw) + '</p>';
      cur = null;
    };
    for (let i = a; i < b; i++) {
      const t = u.T[i];
      if (t === 0) { close(); out += u.H[i]; continue; }
      if (t === 1) { close(); cur = { k: u.K[i], head: u.H[i], off: -1, raw: '' }; continue; }   // 절 번호 = 새 줄
      if (t === 3) {
        if (!cur || !cur.std) { close(); cur = { k: u.K[i], std: true, raw: '' }; }
        cur.raw += u.W[i] + ' ';
        continue;
      }
      if (!cur) cur = { k: u.K[i], head: '', off: -1, raw: '' };
      if (cur.off < 0) cur.off = u.O[i];
      cur.raw += u.W[i] + ' ';
    }
    close();
    return out;
  }

  // ---------- 쪽 나누기 ----------
  const tick = () => new Promise((r) => setTimeout(r, 0));

  // 쪽 나누기 결과(쪽마다 시작 조각 번호)는 기기에 저장해 두었다가, 같은 책·화면 크기·글꼴이면 다시 계산하지 않고 쓴다.
  // 저장된 결과가 이 기기에서 실제로 맞는지 몇 쪽만 확인하고, 틀리면 버리고 새로 나눈다. (글꼴·OS가 바뀌면 키가 달라진다)
  const PGC_KEY = 'bf.pgc', PGC_MAX = 24;
  function pgcKey(u, g) {
    const cs = getComputedStyle(measure);
    return ['2', bible.version || '', u.bookId, u.T.length, g.textW, g.textH, settings.fontSize, settings.font,
      cs.fontFamily, cs.lineHeight, cs.letterSpacing, cs.wordSpacing, navigator.userAgent].concat(u.stdVer ? ['s' + u.stdVer] : []).join('|');
  }
  function pgcLoad(key) {
    try {
      const d = JSON.parse(localStorage.getItem(PGC_KEY));
      const v = d && d.map && d.map[key];
      return Array.isArray(v) && v.length && v[0] === 0 ? v : null;
    } catch (e) { return null; }
  }
  function pgcSave(key, starts) {
    try {
      let d = JSON.parse(localStorage.getItem(PGC_KEY));
      if (!d || !Array.isArray(d.order) || !d.map) d = { order: [], map: {} };
      d.order = d.order.filter((k) => k !== key);
      d.order.push(key);
      d.map[key] = starts;
      while (d.order.length > PGC_MAX) delete d.map[d.order.shift()];
      localStorage.setItem(PGC_KEY, JSON.stringify(d));
    } catch (e) { /* 저장 공간이 없으면 무시 */ }
  }

  async function paginate(u, g, gen) {
    measure.style.width = g.textW + 'px';
    measure.style.height = (g.textH - 2) + 'px';   // 2px 여유: 마지막 줄이 잘리지 않게
    const n = u.T.length;
    const fits = (i, k) => {
      measure.innerHTML = sliceHTML(u, i, i + k);
      return measure.scrollHeight <= measure.clientHeight;
    };

    // 저장된 결과가 있으면 처음·가운데·끝 쪽이 실제로 넘치지 않는지만 확인하고 그대로 쓴다
    const ckey = pgcKey(u, g);
    const cached = pgcLoad(ckey);
    if (cached && cached[cached.length - 1] < n) {
      const m = cached.length;
      const probe = [0, m >> 1, m - 1].filter((p, j, a) => a.indexOf(p) === j);
      const good = probe.every((p) => fits(cached[p], (p + 1 < m ? cached[p + 1] : n) - cached[p]));
      if (good) { measure.innerHTML = ''; return cached; }
    }

    const starts = [];
    let i = 0, guess = 150;
    while (i < n) {
      starts.push(i);
      const maxK = n - i;
      // 앞 쪽이 담은 조각 수(guess) 근처에서 시작해 점점 넓혀 가며 경계를 찾는다 (쪽마다 분량이 비슷해 대여섯 번이면 끝난다)
      const g0 = Math.max(1, Math.min(maxK, guess));
      let step = Math.max(3, Math.round(g0 * 0.05)), lo, up;   // lo: 들어감, up: 안 들어감
      if (fits(i, g0)) {
        lo = g0; up = maxK + 1;
        while (lo < maxK) {
          const t = Math.min(maxK, lo + step);
          if (fits(i, t)) { lo = t; step *= 2; } else { up = t; break; }
        }
      } else {
        up = g0; lo = 0;
        while (up > 1) {
          const t = Math.max(1, up - step);
          if (fits(i, t)) { lo = t; break; }
          up = t; step *= 2;
        }
        if (lo === 0) lo = 1;
      }
      while (up - lo > 1) {
        const mid = (lo + up) >> 1;
        if (fits(i, mid)) lo = mid; else up = mid;
      }
      let k = lo;
      // 쪽 끝에 장 제목이나 절 번호만 덩그러니 남지 않게 앞으로 물린다
      while (k > 1 && u.T[i + k - 1] < 2) k--;
      i += k;
      guess = k;
      if (starts.length % 10 === 0) {
        await tick();
        if (gen !== generation) return null;
      }
    }
    measure.innerHTML = '';
    if (fontsReady) pgcSave(ckey, starts);   // 글꼴이 다 준비된 상태에서 나눈 결과만 저장한다
    return starts;
  }

  // ---------- 위치 ↔ 쪽 ----------
  function pageOfUnit(u) {
    const s = pg.starts;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid] <= u) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  function positionOfUnit(u, bookIndex) {
    const cs = pg.chapterStart;
    let c = 0;
    for (let i = 0; i < cs.length; i++) { if (cs[i] <= u) c = i; else break; }
    let verse = 1;
    for (const v of pg.verseAt[c]) { if (v.u <= u) verse = v.n; else break; }
    return { book: bookIndex, chapter: c, verse };
  }

  function unitOfPosition(p) {
    const c = Math.min(Math.max(p.chapter, 0), pg.chapterStart.length - 1);
    if (p.verse > 1) {
      let found = null;
      for (const v of pg.verseAt[c]) { if (v.n <= p.verse) found = v; else break; }
      if (found) return found.u;
    }
    return pg.chapterStart[c];
  }

  // ---------- 책 만들기 ----------
  function showLoading(on) {
    $('#loading').hidden = !on;
  }

  // 이동한 절을 잠깐 강조한다. (책장이 자리 잡을 시간을 조금 준 뒤 표시)
  function highlightVerse(p) {
    if (!p || !(p.verse > 1)) return;
    const key = p.chapter * 1000 + p.verse;
    setTimeout(() => {
      const els = document.querySelectorAll('#stage p[data-k="' + key + '"]');
      els.forEach((el) => el.classList.add('hl'));
      setTimeout(() => els.forEach((el) => el.classList.remove('hl')), 3000);
    }, 150);
  }

  // 글씨체 파일(보통 + 굵은 것)이 모두 준비될 때까지 기다린다. 한쪽만 기다리면, 굵은 글씨(장 제목 등)가 늦게 들어와
  // 쪽 나누기가 틀어질 수 있다. 8초 안에 못 불러오면 기다리지 않고 진행하되, 그때의 쪽 나누기는 저장하지 않는다.
  let fontsReady = true;
  async function ensureFont() {
    fontsReady = true;
    const f = FONTS[settings.font] || FONTS.myeongjo;
    if (!f.face) return;
    try {
      const r = await Promise.race([
        Promise.all([
          document.fonts.load('18px "' + f.face + '"', '가나다라 1:2'),
          document.fonts.load('700 18px "' + f.face + '"', '가나다라 1:2'),
        ]).then(() => 'ok'),
        new Promise((res) => setTimeout(() => res('timeout'), 8000)),
      ]);
      fontsReady = r === 'ok';
    } catch (e) { fontsReady = false; /* 글꼴을 못 불러오면 기본 글꼴로 대체되어 보인다 */ }
  }

  // 다시 만드는 일이 진행 중인 횟수(0이면 쉬는 중)와, 확인 때문에 다시 만드는 경우 표시
  let building = 0, verifying = false;
  async function rebuild(target, highlight) {
    const fromVerify = verifying; verifying = false;
    if (!fromVerify) verifyTries = 0;
    const gen = generation + 1;
    building++;
    try { await rebuildNow(target, highlight); }
    finally {
      building--;
      if (gen === generation && !building) { posFreezeUntil = 0; scheduleVerify(); }
    }
  }
  async function rebuildNow(target, highlight) {
    const gen = ++generation;
    showLoading(true);
    await tick();
    if (settings.std && bible.books[target.book]) {   // 쉬운 말 풀이를 켜 둔 경우, 이 책의 풀이를 먼저 불러온다
      const bid = bible.books[target.book].id;
      const sd = await loadStd(bid);
      if (gen !== generation) return;
      if (!sd && !stdToasted[bid]) { stdToasted[bid] = true; setTimeout(() => showToastLine('이 책은 AI 표준어 번역이 아직 준비되지 않았습니다'), 400); }
    }
    const g = geometry();
    lastGeo = [g.W, g.H, g.si.top, g.si.bottom, g.si.left, g.si.right].join('x');
    if (!launchSnapped) { launchSnapped = true; afterRestartCheck(g); }
    applyLook(g);
    await ensureFont();   // 글씨체 파일이 준비된 뒤에 쪽을 나눠야 쪽 경계가 맞는다
    if (gen !== generation) return;

    if (!g.spread) {   // 접힌 화면: 한 장(chapter)씩 위아래로 스크롤, 쪽 나누기 없음
      pg = { bookIndex: target.book, g, unitName: bible.books[target.book].id === 'psa' ? '편' : '장', scroll: true };
      mountChapters(target);
      showLoading(false);
      if (highlight) highlightVerse(target);
      maybeShowHint();
      return;
    }

    const u = buildUnits(target.book);
    const starts = await paginate(u, g, gen);
    if (starts === null || gen !== generation) return;

    pg = Object.assign(u, { starts, g });
    const startUnit = unitOfPosition(target);
    mount(pageOfUnit(startUnit));
    showLoading(false);
    if (highlight) highlightVerse(target);
    maybeShowHint();
  }

  function pageElement(i) {
    const first = pg.starts[i];
    const end = i + 1 < pg.starts.length ? pg.starts[i + 1] : pg.T.length;
    const el = document.createElement('div');
    el.className = 'page' + (pg.g.spread ? (i % 2 === 0 ? ' pl' : ' pr') : ' pl');   // 펼침: 짝수 쪽 = 왼쪽, 홀수 쪽 = 오른쪽
    el.innerHTML =
      '<div class="txt typo">' + sliceHTML(pg, first, end) + '</div>';
    return el;
  }

  // 책장 라이브러리는 창 크기가 바뀔 때마다 스스로 다시 계산하는 처리기를 창(window)에 달아 두는데,
  // 우리 설정(마우스 이벤트 끔)에서는 destroy()가 이를 떼어 주지 않아 회전할 때마다 쌓이고 오류를 냈다.
  // 크기 변화는 우리가 직접 다시 만들어 처리하므로, 만들자마자 떼어 둔다.
  function detachFlipResize(f) {
    try { const ui = f && f.getUI && f.getUI(); if (ui && ui.removeHandlers) ui.removeHandlers(); } catch (e) { /* 무시 */ }
  }
  function killFlip() {
    resetGestures();
    if (!flip) return;
    detachFlipResize(flip);
    try { flip.destroy(); } catch (e) { /* 무시 */ }
    flip = null;
  }

  // 접힌 화면: 한 장(chapter)이 한 칸. 위아래로 읽고, 옆으로 밀면 다음·이전 장이 슬라이드로 넘어온다.
  let scrollTimer = null;
  function chapterHTML(book, c) {
    const unit = book.id === 'psa' ? '편' : '장';
    let h = '<h2 class="ch">' + (c + 1) + unit + '</h2><div class="nt-chips">' + noteChipsHTML(book.id, c) + '</div>';
    book.chapters[c].forEach((v) => {
      const k = c * 1000 + v.n;
      h += '<p data-k="' + k + '" data-o="0" data-e="' + v.t.length + '" data-h="1"' + noteAttrs(book.id, k) + '><sup class="vn">' + v.n + '</sup>' + annotate(book.id, k, 0, v.t) + '</p>';
      const st = settings.std ? stdFor(book.id, c, v.n) : '';
      if (st) h += '<p class="std" data-s="' + k + '"' + stdNoteAttr(book.id, k) + '>' + esc(st) + '</p>';
    });
    const bi = bible.books.indexOf(book);
    const prev = c > 0 ? '‹ ' + c + unit : (bi > 0 ? '‹ ' + bible.books[bi - 1].name : '');
    const nextB = bi < bible.books.length - 1 ? bible.books[bi + 1].name : '';
    const next = c < book.chapters.length - 1 ? (c + 2) + unit + ' ›' : (nextB ? nextB + ' ›' : '');
    h += '<div class="chnav"><button data-go="-1"' + (prev ? '' : ' disabled') + '>' + esc(prev || ' ') + '</button>' +
      '<button data-go="1"' + (next ? '' : ' disabled') + '>' + esc(next || ' ') + '</button></div>';
    return h;
  }

  function scrollToVerse(pane, c, verse) {
    pane.scrollTop = 0;
    if (verse > 1) {
      const el = pane.querySelector('p[data-k="' + (c * 1000 + verse) + '"]');
      if (el) pane.scrollTop = Math.max(0, el.offsetTop - 6);
    }
  }

  function goChapter(delta) {   // 같은 책 안에서는 슬라이드, 책이 바뀌면 다시 만든다
    const book = bible.books[pos.book];
    const c = pos.chapter + delta;
    if (c >= 0 && c < book.chapters.length) { scroller.scrollTo({ left: c * scroller.clientWidth, behavior: 'smooth' }); return; }
    const nb = pos.book + (delta > 0 ? 1 : -1);
    if (nb < 0 || nb >= bible.books.length) return;
    jumpTo({ book: nb, chapter: delta > 0 ? 0 : bible.books[nb].chapters.length - 1, verse: 1 });
  }

  function mountChapters(target) {
    killFlip();
    clearSelection();
    stage.innerHTML = '';
    stage.classList.add('scroll');
    const book = bible.books[target.book];
    const root = document.createElement('div');
    root.id = 'book';
    root.className = 'scroll';
    book.chapters.forEach((_, c) => {
      const pane = document.createElement('section');
      pane.className = 'chap typo';
      pane.innerHTML = chapterHTML(book, c);
      root.appendChild(pane);
    });
    stage.appendChild(root);
    scroller = root;
    pos = { book: target.book, chapter: Math.min(Math.max(target.chapter, 0), book.chapters.length - 1), verse: target.verse || 1 };
    scrollIdx = pos.chapter;
    root.scrollLeft = pos.chapter * root.clientWidth;
    scrollToVerse(root.children[pos.chapter], pos.chapter, pos.verse);

    root.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.chnav button');
      if (b && !b.disabled) goChapter(+b.dataset.go);
      const chip = e.target.closest && e.target.closest('.nt-chip');
      if (chip) { showNoteView(chip.dataset.note); openSheet(true); }
    });
    refreshTabs();   // 접힌 화면에서는 표를 비운다
    // 읽던 위치 저장: 가로로 넘어가 멈췄을 때 장, 세로로 멈췄을 때 맨 위에 보이는 절
    root.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (posFrozen()) return;   // 회전·접기 중에 흔들린 스크롤 값으로 읽던 위치가 바뀌지 않게 한다
        if (scroller !== root || !root.isConnected) return;   // 이미 치워진 옛 화면(세로 → 가로로 돌린 직후)의 늦은 스크롤 알림은 버린다
        const w = root.clientWidth || 1;
        const idx = Math.round(root.scrollLeft / w);
        if (Math.abs(root.scrollLeft - idx * w) > 3) return;   // 아직 넘어가는 중
        const pane = root.children[idx];
        if (!pane) return;
        if (idx !== scrollIdx) { scrollIdx = idx; clearSelection(); }
        let verse = 1;
        for (const el of pane.querySelectorAll('p[data-k]')) {
          if (el.offsetTop + el.offsetHeight > pane.scrollTop + 8) { verse = (+el.dataset.k) % 1000; break; }
        }
        if (pos.chapter !== idx || pos.verse !== verse) {
          pos = { book: target.book, chapter: idx, verse };
          store.set('bf.pos', pos);
          updateHeader();
        }
      }, 120);
    }, { passive: true, capture: true });
    updateHeader();
  }

  function mount(pageIndex) {
    closeSpot();
    killFlip();
    scroller = null;
    clearSelection();
    stage.innerHTML = '';
    stage.classList.remove('scroll');
    const root = document.createElement('div');
    root.id = 'book';
    stage.appendChild(root);

    const g = pg.g;
    const pages = pg.starts.map((_, i) => pageElement(i));
    pages.forEach((el) => root.appendChild(el));

    const start = g.spread ? pageIndex - (pageIndex % 2) : pageIndex;   // 펼침은 (짝수, 홀수) 쌍
    flip = new St.PageFlip(root, {
      width: g.pageW,
      height: g.pageH,
      size: 'fixed',
      startPage: start,
      showCover: false,
      usePortrait: true,
      drawShadow: true,
      maxShadowOpacity: 0.45,
      flippingTime: 950,
      swipeDistance: 20,
      mobileScrollSupport: false,
      showPageCorners: false,
      disableFlipByClick: true,
      useMouseEvents: false,   // 끌기·탭은 아래 우리 코드가 직접 처리한다 (뒤로 넘기기가 안 되던 문제)
    });
    flip.loadFromHTML(pages);
    detachFlipResize(flip);
    flip.on('flip', (e) => { clearSelection(); onPage(e.data, true); });
    // 책장이 넘어가는 동안에는 여백의 노트 표를 숨기고, 멈추면(read) 현재 쪽에 맞춰 다시 놓는다
    flip.on('changeState', (e) => { if (e.data === 'read') { clearTimeout(tabsTimer); tabsTimer = setTimeout(() => refreshTabs(0), 120); } else hideTabs(); });
    onPage(start, false);
    setTimeout(() => refreshTabs(0), 60);
  }

  // user=true: 사용자가 책장을 넘긴 경우에만 읽던 위치(pos)를 갱신한다.
  // 화면 크기·글자 크기가 바뀌어 다시 만들 때는 위치를 유지해서, 접었다 펴도 위치가 뒤로 밀리지 않게 한다.
  function onPage(index, user) {
    if (!pg) return;
    if (user) {
      pos = positionOfUnit(pg.starts[index], pg.bookIndex);
      store.set('bf.pos', pos);
    }
    updateHeader();
  }
  function updateHeader() {
    const book = bible.books[pos.book];
    $('#loc-book').textContent = book.name;
    $('#loc-ch').textContent = (pos.chapter + 1) + (book.id === 'psa' ? '편' : '장');
    fitTitle();
  }

  function jumpTo(p) {
    if (pg && pg.bookIndex === p.book && scroller) {
      const c = Math.min(Math.max(p.chapter, 0), scroller.children.length - 1);
      pos = { book: p.book, chapter: c, verse: p.verse || 1 };
      store.set('bf.pos', pos);
      scrollIdx = c;
      scroller.scrollLeft = c * scroller.clientWidth;
      scrollToVerse(scroller.children[c], c, pos.verse);
      updateHeader();
      highlightVerse(pos);
    } else if (pg && pg.bookIndex === p.book && flip) {
      const page = pageOfUnit(unitOfPosition(p));
      pos = p;
      store.set('bf.pos', pos);
      flip.turnToPage(pg.g.spread ? page - (page % 2) : page);
      onPage(flip.getCurrentPageIndex(), false);
      setTimeout(() => refreshTabs(0), 80);   // 바로 넘어간 쪽에 맞춰 여백의 노트 표를 다시 놓는다
      highlightVerse(p);
    } else {
      pos = p;
      store.set('bf.pos', pos);
      rebuild(p, true);
    }
  }

  // ---------- 낱말 고르기 + 표시 도구 ----------
  // 길게 누르면 그 낱말이 골라지고(누른 채 끌면 범위가 넓어짐), 고른 뒤에는 다른 낱말을 눌러 계속 더할 수 있다(여러 곳 선택).
  // 이미 고른 낱말을 다시 누르면 그 낱말만 빠진다. 고르면 도구 상자(#ann-bar)가 뜬다.
  const bar = $('#ann-bar');
  const barKinds = $('#ab-kinds'), barPens = $('#ab-pens'), barColors = $('#ab-colors');
  let barTop = false;      // 고른 낱말이 화면 아래쪽이면 도구 상자를 위에 띄운다
  let dragBase = [], dragAnchor = null;   // 끌어서 넓히는 동안의 기준

  // 한 번이라도 문제가 생기면 화면에 알리고 '고르는 중' 상태를 풀어, 앱이 멈춘 것처럼 되지 않게 한다.
  function guard(fn) {
    try { return fn(); } catch (err) { selecting = false; showError(err); return undefined; }
  }

  const sameVerse = (i, j) => i.bookId === j.bookId && i.k === j.k;
  const bookIdx = (id) => bible.books.findIndex((b) => b.id === id);
  const itemText = (it) => verseText(bookIdx(it.bookId), Math.floor(it.k / 1000), it.k % 1000);
  const sig = (n) => n.items.map((i) => i.k + ':' + i.s + '-' + i.e).join(',') + '#' + n.act;

  // 같은 절 안에서 겹치거나 맞닿은(낱말 하나 차이) 범위는 하나로 합친다. act: 마지막으로 만진 범위
  function normalize(items, act) {
    const out = [];
    items.slice().sort((x, y) => x.k - y.k || x.s - y.s).forEach((it) => {
      const last = out[out.length - 1];
      if (last && sameVerse(last, it) && it.s <= last.e + 1) last.e = Math.max(last.e, it.e);
      else out.push({ bookId: it.bookId, k: it.k, s: it.s, e: it.e });
    });
    let idx = 0;
    if (act) {
      const f = out.findIndex((it) => sameVerse(it, act) && act.s >= it.s && act.s <= it.e);
      idx = f < 0 ? 0 : f;
    }
    return { items: out, act: idx };
  }

  function clearSelection() { selecting = false; setSel(null); }
  function setSel(next) {
    const old = sel;
    sel = next && next.items.length ? next : null;
    const keys = new Set();
    [old, sel].forEach((x) => x && x.items.forEach((i) => keys.add(i.bookId + '|' + i.k)));
    keys.forEach((kk) => { const q = kk.split('|'); paintVerse(q[0], +q[1]); });
    updateBar();
  }

  // 손가락 위치에서 가장 가까운 낱말을 찾는다. (낱말마다 화면 위치를 재어 비교)
  function hitWord(x, y) {
    const el = document.elementFromPoint(x, y);
    const p = el && el.closest ? el.closest('#stage p[data-k]') : null;
    if (!p || !pg) return null;
    const k = +p.dataset.k, o0 = +p.dataset.o;
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const rg = document.createRange();
    let base = 0, best = null, node;
    while ((node = walker.nextNode())) {
      if (node.parentNode.closest && node.parentNode.closest('sup.vn')) continue;
      const txt = node.nodeValue, re = /\S+/g;
      let m;
      while ((m = re.exec(txt))) {
        rg.setStart(node, m.index);
        rg.setEnd(node, m.index + m[0].length);
        const rects = rg.getClientRects();
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          const dx = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0);
          const dy = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
          const sc = dy * 4 + dx;
          if (!best || sc < best.sc) best = { sc, s: o0 + base + m.index, e: o0 + base + m.index + m[0].length };
        }
      }
      base += txt.length;
    }
    return best ? { bookId: bible.books[pg.bookIndex].id, k, s: best.s, e: best.e } : null;
  }
  const findIn = (items, h) => items.find((i) => sameVerse(i, h) && h.s >= i.s && h.e <= i.e);

  function beginSelect(x, y) {
    const h = hitWord(x, y);
    if (!h) return false;
    if (!sel) barTop = y > window.innerHeight * 0.5;
    const items = sel ? sel.items.slice() : [];
    const ex = findIn(items, h);   // 이미 고른 곳을 길게 누르면 그 범위를 끌어 넓힌다
    dragBase = ex ? items.filter((i) => i !== ex) : items;
    dragAnchor = ex ? { bookId: ex.bookId, k: ex.k, s: ex.s, e: ex.e } : { bookId: h.bookId, k: h.k, s: h.s, e: h.e };
    setSel(normalize(dragBase.concat([Object.assign({}, dragAnchor)]), dragAnchor));
    selecting = true;
    return true;
  }
  function extendSelect(x, y) {
    if (!sel || !dragAnchor) return;
    const h = hitWord(x, y);
    if (!h || !sameVerse(h, dragAnchor)) return;   // 한 절 안에서만 넓힌다
    const rng2 = { bookId: h.bookId, k: h.k, s: Math.min(dragAnchor.s, h.s), e: Math.max(dragAnchor.e, h.e) };
    const next = normalize(dragBase.concat([rng2]), rng2);
    if (sig(next) !== sig(sel)) setSel(next);
  }
  // 한 번 누르기: 고르는 중이면 그 낱말을 더하거나 뺀다. 아직 아무것도 안 골랐으면 그 낱말을 고른다.
  function tapSelect(x, y) {
    const h = hitWord(x, y);
    if (!h) return;
    const items = sel ? sel.items.slice() : [];
    const ex = findIn(items, h);
    if (ex) {
      const rest = items.filter((i) => i !== ex);
      if (h.s - 1 > ex.s) rest.push({ bookId: ex.bookId, k: ex.k, s: ex.s, e: h.s - 1 });
      if (ex.e > h.e + 1) rest.push({ bookId: ex.bookId, k: ex.k, s: h.e + 1, e: ex.e });
      setSel(normalize(rest, null));
      return;
    }
    if (!sel) barTop = y > window.innerHeight * 0.5;
    items.push({ bookId: h.bookId, k: h.k, s: h.s, e: h.e });
    setSel(normalize(items, h));
  }

  // ---- 도구 상자 ----
  const previewOf = (kind) => '<span class="a ' + ruleFor({ id: 'pv' + kind, kind, pen: tool.pen, c: tool.c }) + '">' + KINDS[kind] + '</span>';
  function buildBar() {
    barKinds.innerHTML = Object.keys(KINDS).map((kd) => '<button type="button" data-kind="' + kd + '"></button>').join('');
    barPens.innerHTML = Object.keys(PENS).map((pn) => '<button type="button" data-pen="' + pn + '">' + PENS[pn] + '</button>').join('');
    barColors.innerHTML = COLORS.map((c, i) => '<button type="button" class="dot" data-c="' + i + '" aria-label="' + c.n + '" style="background:' + c.f + '"></button>').join('');
    paintBarTools();
  }
  function paintBarTools() {
    barKinds.querySelectorAll('button').forEach((b) => { b.innerHTML = previewOf(b.dataset.kind); });
    barPens.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.pen === tool.pen));
    barColors.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.c === tool.c));
  }
  function updateBar() {
    if (!sel) { bar.hidden = true; return; }
    const it = sel.items[sel.act] || sel.items[0];
    const bi = bookIdx(it.bookId);
    const snip = itemText(it).slice(it.s, it.e);
    $('#ab-ref').textContent = bible.books[bi].name + ' ' + (Math.floor(it.k / 1000) + 1) + ':' + (it.k % 1000) +
      '  「' + (snip.length > 14 ? snip.slice(0, 14) + '…' : snip) + '」' + (sel.items.length > 1 ? '  외 ' + (sel.items.length - 1) + '곳' : '');
    bar.classList.toggle('top', barTop);
    bar.hidden = false;
  }
  function applyKind(kind) {
    if (!sel) return;
    const lists = {};
    sel.items.forEach((it) => {
      const key = markKey(it.bookId, it.k);
      let list = lists[key] || (anns[key] || []).slice();
      const same = list.find((a) => a.kind === kind && a.s === it.s && a.e === it.e);
      list = list.filter((a) => a !== same);
      if (!(same && same.pen === tool.pen && same.c === tool.c)) {   // 똑같은 표시를 다시 누르면 지워진다
        if (kind === 'fill') list = cutRange(list, it.s, it.e, (a) => a.kind === 'fill');   // 형광은 겹치지 않게 덮어쓴다
        list.push({ id: newId(), s: it.s, e: it.e, kind, pen: tool.pen, c: tool.c });
      }
      lists[key] = list;
    });
    Object.assign(anns, lists);
    saveAnns();
    clearSelection();
  }
  function eraseSel() {
    if (!sel) return;
    sel.items.forEach((it) => {
      const key = markKey(it.bookId, it.k);
      anns[key] = cutRange(anns[key] || [], it.s, it.e, () => true);
    });
    saveAnns();
    clearSelection();
  }
  function replaceAct(mut) {   // 마지막으로 만진 범위만 바꾼다
    if (!sel) return;
    const items = sel.items.map((i) => Object.assign({}, i));
    const cur = items[sel.act] || items[0];
    mut(cur);
    if (cur.e > cur.s) setSel(normalize(items, cur));
  }
  // 범위의 경계를 낱말 하나씩 옮긴다. which: 's' 시작 / 'e' 끝, dir: -1 앞으로 / +1 뒤로
  function moveEdge(which, dir) {
    replaceAct((it) => {
      const t = itemText(it);
      if (which === 's') {
        if (dir < 0) {
          let i = it.s - 1;
          while (i > 0 && t[i] === ' ') i--;
          while (i > 0 && t[i - 1] !== ' ') i--;
          it.s = Math.max(i, 0);
        } else {
          let i = it.s;
          while (i < it.e && t[i] !== ' ') i++;
          while (i < it.e && t[i] === ' ') i++;
          if (i < it.e) it.s = i;
        }
      } else if (dir > 0) {
        let i = it.e;
        while (i < t.length && t[i] === ' ') i++;
        while (i < t.length && t[i] !== ' ') i++;
        it.e = i;
      } else {
        let i = it.e - 1;
        while (i > it.s && t[i] !== ' ') i--;
        while (i > it.s && t[i - 1] === ' ') i--;
        if (i > it.s) it.e = i;
      }
    });
  }
  // 도구 상자 단추 연결 (v71). 길게 눌러 낱말을 고른 직후의 첫 터치가 먹지 않고 연달아 눌러야 적용된다는 제보에 따라,
  // 머리줄 메뉴(onMenu)처럼 ① 누른 손가락을 떼는 순간(pointerup)에 바로 처리하고 ② 아이폰이 click 을 만들어 주면 그것도 받되
  // 같은 터치의 click 은 한 번만 처리한다. (손가락이 12px 넘게 움직였으면 누른 것이 아니다)
  // 단추를 처리하면 도구 상자가 곧바로 사라지므로, 아이폰이 손 뗀 뒤 그 자리를 다시 찾아 보내는 click 이
  // 아래에 있던 요소(머리줄의 책 이름·설정 등)를 누르지 않게 그 자리의 click 을 잠깐(450ms) 막는다.
  let barGhost = null;
  window.addEventListener('click', (e) => {
    if (!barGhost) return;
    if (performance.now() > barGhost.until) { barGhost = null; return; }
    if (Math.hypot(e.clientX - barGhost.x, e.clientY - barGhost.y) <= 48) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  function barTap(root, fn) {
    let downAt = null, doneAt = 0, doneBtn = null;
    const hit = (e) => { const b = e.target.closest && e.target.closest('button'); return b && root.contains(b) ? b : null; };
    root.addEventListener('pointerdown', (e) => { downAt = hit(e) ? { x: e.clientX, y: e.clientY } : null; });
    root.addEventListener('pointerup', (e) => {
      const b = hit(e), d = downAt;
      downAt = null;
      if (!b || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 12) return;
      doneAt = performance.now(); doneBtn = b;
      barGhost = { x: e.clientX, y: e.clientY, until: doneAt + 450 };
      fn(b);
    });
    root.addEventListener('pointercancel', () => { downAt = null; });
    root.addEventListener('click', (e) => {
      const b = hit(e);
      if (!b) return;
      if (b === doneBtn && performance.now() - doneAt < 600) { doneBtn = null; return; }   // 방금 손가락 뗄 때 처리한 같은 터치의 click
      fn(b);
    });
  }
  barTap(barKinds, (b) => guard(() => applyKind(b.dataset.kind)));
  barTap(barPens, (b) => { tool.pen = b.dataset.pen; store.set('bf.tool', tool); paintBarTools(); });
  barTap(barColors, (b) => { tool.c = +b.dataset.c; store.set('bf.tool', tool); paintBarTools(); });
  barTap($('#ab-close'), () => clearSelection());
  barTap($('#ab-all'), () => guard(() => replaceAct((it) => { it.s = 0; it.e = itemText(it).length; })));
  barTap($('#ab-erase'), () => guard(eraseSel));
  barTap($('#ab-s-prev'), () => guard(() => moveEdge('s', -1)));
  barTap($('#ab-s-next'), () => guard(() => moveEdge('s', 1)));
  barTap($('#ab-e-prev'), () => guard(() => moveEdge('e', -1)));
  barTap($('#ab-e-next'), () => guard(() => moveEdge('e', 1)));
  buildBar();

  // ---------- 책장 넘기기: 탭·끌기·길게 누르기·키보드 ----------
  // 가장자리 탭 = 넘김, 가운데 탭 = 낱말 고르기, 어디서든 길게 누르기 = 낱말 고르기(누른 채 끌면 범위 넓힘),
  // 좌우로 끌면 끄는 방향대로(왼쪽으로 = 다음, 오른쪽으로 = 이전) 책장이 따라온다.
  const FWD = 0, BACK = 1;
  let down = null, pressTimer = null, drag = null, selPt = null, selRaf = 0;
  // 책을 다시 만들 때(회전·접기 등) 진행 중이던 끌기·넘김 상태를 모두 버린다.
  // 안 버리면 새 책에 낡은 끌기 값이 전달되어 책장이 모서리에서 접힌 채 멈추기도 한다.
  function resetGestures() {
    clearTimeout(pressTimer);
    down = null; drag = null; turning = false;
  }

  // 탭·키보드로 넘길 때도 '끌기'와 똑같은 모양이 되도록, 가상 손가락을 움직여 책장을 넘긴다.
  // (라이브러리 기본 넘김 애니메이션은 한 쪽 화면에서 앞쪽으로 넘길 때 효과가 거의 보이지 않는다)
  const TURN_MS = 720;
  let turning = false;
  function turn(dir) {   // dir > 0: 다음, < 0: 이전
    if (scroller) {
      goChapter(dir > 0 ? 1 : -1);
      return;
    }
    if (!flip || turning || building || settleStart || flip.getState() !== 'read') return;
    const r = stage.getBoundingClientRect();
    const portrait = flip.getOrientation() === 'portrait';
    const D = dir > 0 ? FWD : BACK;
    const edge = r.height - 2;
    const x0 = D === FWD ? r.width - 2 : 2;
    const x1 = D === FWD ? (portrait ? -r.width * 0.05 : 1) : r.width - 1;
    const ms = window.TURN_MS || TURN_MS;
    const lift = liftMax(r.height);
    turning = true;
    const f = flip;   // 애니메이션 도중 책이 다시 만들어지면(회전 등) 새 책에는 손대지 않는다
    try {
      f.startUserTouch({ x: -9999, y: -9999 });
      f.userMove({ x: x0, y: edge }, true);      // 방향·모서리 결정
    } catch (err) { turning = false; return; }
    const t0 = performance.now();
    const pt = (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // 천천히 시작해 빨라졌다 느려지게
      return { x: x0 + (x1 - x0) * e, y: edge - lift * Math.sin(Math.PI * k) };
    };
    const step = (now) => {
      if (f !== flip) { turning = false; return; }
      const k = Math.min(1, (now - t0) / ms);
      try { f.userMove(pt(k), true); } catch (err) { /* 무시 */ }
      if (k < 1) { requestAnimationFrame(step); return; }
      try { f.userStop(pt(1), false); } catch (err) { /* 무시 */ }
      setTimeout(() => { turning = false; }, 300);
    };
    requestAnimationFrame(step);
  }

  // 들린 모서리를 올리는(접힘선을 비스듬하게 하는) 높이의 상한(px). 모서리를 L px 올리면 들린 쪽 윗부분이 책 위로 약 0.55L~0.6L px 올라가는데(PC 모의 측정),
  // 그만큼이 책 위쪽에 보여 주는 여유(flipUp)를 넘으면 책 위쪽 경계에서 한 줄로 잘려 보인다. 그래서 여유보다 작게 묶는다. (v56)
  const FLIP_RISE = 0.6;
  function liftMax(h) { return flipUp > 0 ? Math.min(h * 0.1, Math.max(0, flipUp - 1) / FLIP_RISE) : h * 0.1; }   // flipUp 0(웹 등)이면 예전 그대로 쪽 높이의 10%

  // 손가락의 위아래 움직임은 15%만 반영하되 liftMax 를 넘지 않게 한다. 그대로 쓰면 접힘선이 크게 비스듬해져 어색하고, 들린 쪽이 책 밖으로 나가 잘린다.
  function stagePt(e, r, corner) {
    const edge = corner === 'bottom' ? r.height - 2 : 2;
    const y = e.clientY - r.top;
    const m = liftMax(r.height);
    return { x: e.clientX - r.left, y: edge + Math.max(-m, Math.min(m, (y - edge) * 0.15)) };
  }

  function startDrag(dir, e) {
    const r = stage.getBoundingClientRect();
    const corner = (down.y - r.top) >= r.height / 2 ? 'bottom' : 'top';
    drag = { dir, r, corner, started: false };
    try {
      flip.startUserTouch({ x: -9999, y: -9999 });
      // 첫 점을 가장자리로 줘서 끄는 방향대로 넘김 방향이 정해지게 한다
      const sy = corner === 'bottom' ? r.height - 2 : 2;
      flip.userMove({ x: dir === FWD ? r.width - 2 : 2, y: sy }, true);
      flip.userMove(stagePt(e, r, corner), true);
      drag.started = true;
    } catch (err) { drag.started = false; }
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (turning || building || settleStart || (flip && flip.getState() !== 'read')) return;   // 책을 다시 만드는 중에는 손가락을 받지 않는다
    if (!scroller) { try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } }
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    drag = null;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (!down || drag) return;
      if (e.target.closest && e.target.closest('.nt-chip')) { down = null; return; }
      closeSpot();
      const d = down;
      down = null;
      guard(() => beginSelect(d.x, d.y));
    }, 480);
  });
  stage.addEventListener('pointermove', (e) => {
    if (building || settleStart) return;
    if (selecting) {   // 화면 한 번 그릴 때마다 한 번만 계산한다 (손가락이 빨라도 버벅이지 않게)
      selPt = { x: e.clientX, y: e.clientY };
      if (!selRaf) selRaf = requestAnimationFrame(() => { selRaf = 0; if (selecting && selPt) guard(() => extendSelect(selPt.x, selPt.y)); });
      return;
    }
    if (scroller) {   // 스크롤은 브라우저가 처리한다. 손가락이 움직이면 탭·길게 누르기가 아니다.
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { clearTimeout(pressTimer); down = null; }
      return;
    }
    if (!down || !flip) return;
    if (drag) {
      if (drag.started) {
        try { flip.userMove(stagePt(e, drag.r, drag.corner), true); } catch (err) { /* 무시 */ }
      }
      return;
    }
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) <= 10) return;
    clearTimeout(pressTimer);
    if (Math.abs(dx) > Math.abs(dy) * 1.2) { clearSelection(); startDrag(dx < 0 ? FWD : BACK, e); }
  });
  // 책을 끌거나 길게 눌러 고르던 손가락의 포인터 캡처를 손가락이 떨어질 때 반드시 푼다 (v71).
  // 캡처가 남으면 그 뒤 첫 터치가 도구 상자가 아니라 책(stage)으로 가 버릴 수 있다.
  function releaseStage(e) {
    try { if (e && e.pointerId != null && stage.hasPointerCapture && stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  }
  function endPointer(e, cancelled) {
    releaseStage(e);
    clearTimeout(pressTimer);
    if (selecting) { selecting = false; down = null; drag = null; return; }   // 끌어서 고르기 끝 — 도구 상자는 그대로 둔다
    const d = down, dg = drag;
    down = null; drag = null;
    if (scroller) {
      if (!d || cancelled || performance.now() - d.t > 450 || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) return;
      if (e.target.closest && e.target.closest('.nt-chip')) return;   // 설교노트 칩은 자기 click으로 처리
      const rr = stage.getBoundingClientRect();
      const fx = (e.clientX - rr.left) / rr.width;
      if (sel) guard(() => tapSelect(e.clientX, e.clientY));   // 고르는 중에는 어디를 눌러도 낱말을 더하거나 뺀다
      else if (fx < 0.28) turn(-1);
      else if (fx > 0.72) turn(1);
      else guard(() => tapSelect(e.clientX, e.clientY));
      return;
    }
    if (!d || !flip) return;
    if (spot.id && !dg) { closeSpot(); return; }   // 스포트라이트가 켜진 동안의 탭은 닫기만 한다 (책장은 넘기지 않는다)
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    const took = performance.now() - d.t;
    if (dg) {
      if (!dg.started) { turn(dg.dir === FWD ? 1 : -1); return; }
      const r = dg.r;
      const commit = !cancelled && (Math.abs(dx) > r.width * 0.22 || (took < 350 && Math.abs(dx) > 30));
      try {
        // 충분히 끌었거나 빠르게 쓸었으면 끝까지 넘기고, 아니면 제자리로 돌린다
        const portrait = flip.getOrientation() === 'portrait';
        const ey = dg.corner === 'bottom' ? r.height - 2 : 2;
        const far = portrait ? -r.width : 1;   // 한 쪽 화면은 손가락이 화면 왼쪽 끝을 지나야 '넘김'으로 계산된다
        const end = commit
          ? { x: dg.dir === FWD ? far : r.width - 1, y: ey }
          : { x: dg.dir === FWD ? r.width - 1 : (portrait ? -r.width : 1), y: ey };   // 제자리로
        flip.userMove(end, true);
        flip.userStop(end, false);
      } catch (err) { /* 무시 */ }
      return;
    }
    if (cancelled || Math.hypot(dx, dy) > 10 || took > 450) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (sel) guard(() => tapSelect(e.clientX, e.clientY));
    else if (x < 0.28) turn(-1);
    else if (x > 0.72) turn(1);
    else guard(() => tapSelect(e.clientX, e.clientY));
  }
  // 낱말을 끌어 고르는 동안에는 화면이 같이 스크롤되지 않게 막는다
  stage.addEventListener('touchmove', (e) => { if (selecting && e.cancelable) e.preventDefault(); }, { passive: false });
  // 어떤 이유로든 손가락이 떨어지면 '고르는 중'을 반드시 끝낸다 (스크롤이 막힌 채로 남지 않게)
  ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach((ev) => window.addEventListener(ev, (e) => { selecting = false; releaseStage(e); }));
  stage.addEventListener('pointerup', (e) => endPointer(e, false));
  stage.addEventListener('pointercancel', (e) => endPointer(e, true));
  window.addEventListener('keydown', (e) => {
    if (pcIsOpen()) { if (e.key === 'Escape') closePc(); return; }   // 바이블 포토 카드 화면이 열려 있으면 책장은 넘기지 않는다
    if (mpIsOpen()) { if (e.key === 'Escape') mpTryClose(); return; }   // 모임 장소 화면도 마찬가지
    if (e.key === 'Escape' && spot.id) { closeSpot(); return; }
    if (!flip && !scroller) return;
    // 창이 열려 있거나 글을 입력하는 중(검색·노트)에는 띄어쓰기·방향키로 책장이 넘어가지 않게 한다
    if (!sheet.hidden) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === ' ') turn(1);
    else if (e.key === 'ArrowLeft') turn(-1);
  });

  // ---------- 크기 변화(접기/펼치기, 회전) ----------
  // 회전·접기 직후에는 화면 크기와 안전영역(env) 값이 한동안 어긋나게 읽히거나 여러 번 바뀐다.
  // 그래서 ① 첫 변화를 느끼면 바로 덮개(로딩 화면)로 가리고 ② 값이 연달아 같게 읽힐 때까지 기다린 뒤(최대 3초)
  // ③ 그 값으로 책을 다시 만들고 ④ 다 만든 뒤에도 실제로 그려진 위치가 계산과 맞는지 몇 번 확인해 어긋나면 한 번 더 만든다.
  // 회전하는 동안 스크롤 위치가 흔들려 읽던 곳이 바뀌지 않도록, 변화 직전의 읽던 위치를 기억해 두었다가 그 위치로 만든다.
  const geoKey = (g) => [g.W, g.H, g.si.top, g.si.bottom, g.si.left, g.si.right].join('x');
  let settleTimer = 0, settleStart = 0, settleKey = '', settleSame = 0;
  let rotPos = null;            // 회전 직전의 읽던 위치
  let posFreezeUntil = 0;       // 이 시각까지는 스크롤로 읽던 위치를 바꾸지 않는다
  let verifyTimers = [], verifyTries = 0;
  let scaleKicks = 0;
  const posFrozen = () => Date.now() < posFreezeUntil;

  function onResize() {
    if (!bible) return;
    if (!settleStart) {   // 새 변화의 처음
      settleStart = Date.now();
      rotPos = Object.assign({}, pos);
      verifyTries = 0;
      let g0 = null;
      try { g0 = geometry(); } catch (e) { /* 무시 */ }
      if (g0 && geoKey(g0) !== lastGeo) showLoading(true);   // 어긋난 화면이 잠깐이라도 보이지 않게 가린다
    }
    posFreezeUntil = Date.now() + 3500;
    verifyTimers.forEach(clearTimeout); verifyTimers = [];
    clearTimeout(settleTimer); settleKey = ''; settleSame = 0;
    settleTimer = setTimeout(settleTick, 80);
  }
  function settleTick() {
    const g = geometry(), key = geoKey(g);
    if (key === settleKey) settleSame++; else { settleKey = key; settleSame = 0; }
    const waited = Date.now() - settleStart;
    let orientOk = true;
    try { orientOk = !window.matchMedia || window.matchMedia('(orientation: portrait)').matches === (g.H >= g.W); } catch (e) { /* 무시 */ }
    if (settleSame >= 2 && orientOk && waited < 6000 && scaleOff() && scaleKicks < 3) {
      // 값은 안정됐는데 화면 배율이 1이 아니다 → 배율을 바로잡고 처음부터 다시 기다린다
      scaleKicks++;
      kickViewport(true);
      settleKey = ''; settleSame = 0;
      settleTimer = setTimeout(settleTick, 500);
      return;
    }
    if ((settleSame >= 2 && orientOk) || waited > (recTries ? 9000 : 3000)) {   // 같은 값이 연달아 읽히면(약 0.2초) 안정된 것으로 본다
      if (!scaleOff()) scaleKicks = 0;
      // 안정된 값이 '어긋난 상태'(가로인데 세로 때의 안전영역)이면 되돌려 본다: 1단계 → 2단계 → 앱 다시 시작(2분에 한 번)
      const bad = suspectGeo(g);
      if (!bad) {
        recTries = 0; recGiveUp = {};
      } else if (key !== lastGeo && !recGiveUp[key]) {
        if (recTries < 2 && waited < 9000) {
          recTries++;
          doRecover(recTries);
          settleKey = ''; settleSame = 0;
          settleTimer = setTimeout(settleTick, 800);
          return;
        }
        if (canAutoRestart()) { restartApp(bad, true); return; }
        recGiveUp[key] = true;
      }
      if (!bad && key !== lastGeo && softSuspect(g)) softNudge(g);
      const target = rotPos || pos;
      settleStart = 0; rotPos = null;
      if (key !== lastGeo) {
        rebuild(target);   // 다 만든 뒤 확인은 rebuild 끝에서 예약한다
      } else {
        if (!building) { posFreezeUntil = 0; showLoading(false); scheduleVerify(); }
      }
      return;
    }
    settleTimer = setTimeout(settleTick, 80);
  }
  // 실제로 그려진 모습이 계산과 같은지 본다. 다르면 어긋난 이유를 문자열로 돌려준다.
  function layoutProblem() {
    if (!bible || !pg || !pg.g) return '';
    const g = pg.g, out = [];
    const near = (a, b, t) => Math.abs(a - b) <= (t === undefined ? 1.5 : t);
    const { w: W, h: H } = viewSize();
    if (W !== g.W || H !== g.H) out.push('창크기 ' + W + '×' + H + '≠' + g.W + '×' + g.H);
    else if (geoKey(geometry()) !== lastGeo) out.push('안전영역 바뀜');   // 안전영역(env) 값은 바뀌어도 알려 주는 이벤트가 없다
    const st = stage.getBoundingClientRect();
    if (!near(st.top, g.stageTop) || !near(st.height, g.pageH) || !near(st.width, g.bookW) || !near(st.left, g.shiftX)) {
      out.push('무대 ' + Math.round(st.left) + ',' + Math.round(st.top) + ' ' + Math.round(st.width) + '×' + Math.round(st.height));
    }
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (!near(r.top, g.padTop) || !near(r.bottom, g.H)) out.push('본문칸 ' + Math.round(r.top) + '~' + Math.round(r.bottom));
    } else if (flip) {
      try {
        const rc = flip.getRender().getRect();
        if (!near(rc.top, 0) || !near(rc.height, g.pageH) || !near(rc.pageWidth, g.pageW)) out.push('책 ' + Math.round(rc.left) + ',' + Math.round(rc.top) + ' ' + Math.round(rc.pageWidth) + '×' + Math.round(rc.height));
      } catch (e) { /* 무시 */ }
    }
    if (scaleOff()) out.push('화면 배율 ' + window.visualViewport.scale.toFixed(2));
    const hr = document.querySelector('.head-row');
    if (hr) {
      const r = hr.getBoundingClientRect();
      const lim = g.spread ? g.stageTop : g.padTop;
      if (r.bottom > lim + 0.5) out.push('머리줄이 본문 위로 ' + Math.round(r.bottom - lim) + 'px 겹침');
    }
    return out.join(' · ');
  }
  function scheduleVerify() {
    verifyTimers.forEach(clearTimeout);
    verifyTimers = [500, 1400, 3000].map((ms) => setTimeout(() => {
      if (settleStart || building || !pg) return;
      const why = layoutProblem();
      if (!why) return;
      if (scaleOff()) kickViewport(true);
      if (verifyTries++ < 3) { verifying = true; rebuild(pos); }
    }, ms));
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('pageshow', onResize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onResize(); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(vp);

  // ---------- 화면이 밀려 올라갔을 때 바로잡기 ----------
  // 아이폰에서 드물게 화면 전체나 본문 쪽이 위로 밀려 올라가 위·아래가 비어 보이는 일이 있다.
  // 밀린 것을 발견하면 제자리로 돌리고, 그래도 안 되면 책을 다시 만든다.
  let healRebuilt = 0;
  function pageShift() {
    const out = [];
    const vv = window.visualViewport;
    const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (window.scrollY || window.scrollX) out.push('창스크롤 ' + Math.round(window.scrollX) + ',' + Math.round(window.scrollY));
    if (document.documentElement.scrollTop || document.body.scrollTop) out.push('문서스크롤');
    if (vv && !typing && (Math.abs(vv.offsetTop) > 1 || Math.abs(vv.offsetLeft) > 1)) out.push('보이는영역 ' + Math.round(vv.offsetLeft) + ',' + Math.round(vv.offsetTop));
    if (vv && !typing && Math.abs(vv.scale - 1) > 0.02) out.push('배율 ' + vv.scale.toFixed(2));   // 회전 뒤 화면이 확대·축소된 채 남는 경우
    const st = stage.getBoundingClientRect();
    const expTop = pg && pg.g ? pg.g.stageTop : 0;   // 펼친 화면의 책은 머리줄 아래에서 시작한다
    if (Math.abs(st.top - expTop) > 1) out.push('무대 위 ' + Math.round(st.top) + (expTop ? '(기준 ' + expTop + ')' : ''));
    if (stage.scrollTop || stage.scrollLeft) out.push('무대스크롤');
    if (!scroller) {
      let n = 0;
      document.querySelectorAll('#stage .page .txt, #stage .page, #book').forEach((e) => { if (e.scrollTop || e.scrollLeft) n++; });
      if (n) out.push('쪽스크롤 ' + n + '곳');
    }
    return out;
  }
  function heal() {
    if (!bible || !pg) return;
    const found = pageShift();
    if (!found.length) {
      if (sel && bar.hidden) updateBar();   // 고른 낱말이 있는데 도구 상자가 안 보이는 경우
      return;
    }
    if (found.some((f) => f.indexOf('배율') === 0)) kickViewport();
    try { window.scrollTo(0, 0); } catch (e) { /* 무시 */ }
    document.documentElement.scrollTop = 0; document.body.scrollTop = 0;
    stage.scrollTop = 0; stage.scrollLeft = 0; stage.style.transform = '';
    if (!scroller) document.querySelectorAll('#stage .page .txt, #stage .page, #book').forEach((e) => { e.scrollTop = 0; e.scrollLeft = 0; });
    if (sel && bar.hidden) updateBar();
    if (Math.abs(stage.getBoundingClientRect().top - (pg && pg.g ? pg.g.stageTop : 0)) > 1 && Date.now() - healRebuilt > 8000) {   // 그래도 어긋나 있으면 다시 만든다
      healRebuilt = Date.now();
      rebuild(pos);
    }
  }
  // 아이폰은 회전한 뒤 화면 배율이 1이 아닌 채(축소된 채) 남기도 한다. 폭이 넓은 내용(펼친 화면의 책)이 세로 화면에 남아 있는 순간
  // '화면에 맞춰 축소'가 일어나고, 가로로 돌아와도 그 배율이 풀리지 않는 경우다. 배율을 1로 못 박은 viewport 태그로 갈아 끼워 바로잡는다.
  const VIEWPORT_LOCK = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover';
  let kickAt = 0, kickTotal = 0;
  const scaleOff = () => { const v = window.visualViewport; return !!v && Math.abs(v.scale - 1) > 0.02; };
  function kickViewport(force) {
    if (Date.now() - kickAt < (force ? 300 : 1500) || kickTotal >= 40) return false;
    kickAt = Date.now(); kickTotal++;
    return swapViewport(VIEWPORT_LOCK);
  }
  function swapViewport(content) {
    const old = document.querySelector('meta[name="viewport"]');
    if (!old || !old.parentNode) return false;
    const m = document.createElement('meta');
    m.setAttribute('name', 'viewport');
    m.setAttribute('content', content);
    old.parentNode.replaceChild(m, old);
    return true;
  }

  // ---------- 어긋남 복구 (v28) ----------
  // 아이폰 듀오는 가로 → 세로 → 가로로 돌린 뒤, 앱이 받는 화면 정보(안전영역 등)가 실제 화면과 맞지 않는 채 남는 일이 있다.
  // (예: 가로인데 안전영역이 세로 때의 '아래 34'로 읽히고 화면이 위로 올라가 있음) 이 값은 앱이 직접 고칠 수 없으므로
  // 그런 상태를 알아채면 viewport 태그 갈아 끼우기 → 문서 다시 계산시키기 → (마지막으로) 앱 다시 시작 순서로 되돌려 본다.
  // (v68: 설정의 '화면 정보·화면 진단'과 그 기록은 없앴다. 예전 버전이 남긴 화면 기록은 아래에서 지운다.)
  try { localStorage.removeItem('bf.snaps'); } catch (e) { /* 무시 */ }
  let recTries = 0, recGiveUp = {}, launchSnapped = false;
  // CSS 단위(vw·lvw·svw·dvw)로 잰 화면 크기. 어느 값이 실제 화면과 어긋나는지 보려는 용도다.
  function unitSizes() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;';
    document.body.appendChild(el);
    const out = {};
    [['vw', 'vh'], ['lvw', 'lvh'], ['svw', 'svh'], ['dvw', 'dvh']].forEach((u) => {
      out[u[0]] = null;
      try {
        if (window.CSS && CSS.supports && CSS.supports('width', '100' + u[0])) {
          el.style.width = '100' + u[0]; el.style.height = '100' + u[1];
          const r = el.getBoundingClientRect();
          out[u[0]] = [Math.round(r.width), Math.round(r.height)];
        }
      } catch (e) { /* 무시 */ }
    });
    el.remove();
    return out;
  }
  // 바깥 창·큰 화면(lvh) 높이와 앱이 아는 높이(H)의 차. 가로 화면에서 이 차가 크면 앱이 아는 화면이 실제보다 낮다는 뜻이다.
  function heightGap(H) {
    const o = unitSizes();
    return Math.max(window.outerHeight || 0, o.lvw ? o.lvw[1] : 0, o.vw ? o.vw[1] : 0) - H;
  }
  // 가로인데 앱이 아는 화면 높이가 바깥 창보다 확실히 낮으면 '어긋난 상태'로 본다. (세로 화면에서는 상태 표시줄 때문에 차이가 정상이다)
  // 이 기준에 걸릴 때만 1·2단계와 앱 다시 시작을 한다. (듀오는 정상 가로 화면에서도 안전영역이 0/0/34/0으로 읽히므로 그 값만으로는 판단하지 않는다)
  // (사파리 창에서는 주소창 때문에 차이가 정상이므로, 홈 화면에 설치해 연 앱(standalone)에서만 본다)
  function isStandalone() {
    try { return navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; }
  }
  function suspectGeo(g) {
    if (!(g.W > g.H) || g.si.top >= 8 || !isStandalone()) return '';
    const gap = heightGap(g.H);
    return gap >= 40 ? '가로인데 앱이 아는 높이가 바깥 창보다 ' + Math.round(gap) + 'px 낮음' : '';
  }
  // 정상일 수도 있는 값(가로인데 안전영역이 아래 34뿐): 기다리지 않고 한 번만 viewport를 갈아 끼워 값을 새로 읽게 한다.
  function softSuspect(g) {
    const si = g.si;
    return g.W > g.H && si.bottom >= 30 && si.top < 8 && si.left < 8 && si.right < 8;
  }
  function softNudge(g) {
    siLast = Object.assign({}, g.si);
    nudgeUntil = Date.now() + 450;
    swapViewport(VIEWPORT_LOCK.replace('viewport-fit=cover', 'viewport-fit=contain'));
    setTimeout(() => swapViewport(VIEWPORT_LOCK), 250);
  }
  // 되돌리기 1·2단계 (앱을 껐다 켜지 않는 것들)
  function doRecover(level) {
    try { window.scrollTo(0, 0); } catch (e) { /* 무시 */ }
    if (level === 1) {   // 안전영역 계산 방식을 잠깐 바꿨다가 되돌려 값을 새로 읽게 한다
      swapViewport(VIEWPORT_LOCK.replace('viewport-fit=cover', 'viewport-fit=contain'));
      setTimeout(() => swapViewport(VIEWPORT_LOCK), 250);
    } else {             // 문서를 잠깐 숨겼다 보여 다시 계산시키고, 가로 폭 기준도 잠깐 바꿨다 되돌린다
      const de = document.documentElement;
      de.style.display = 'none'; void de.offsetHeight; de.style.display = '';
      swapViewport(VIEWPORT_LOCK.replace('width=device-width', 'width=980'));
      setTimeout(() => swapViewport(VIEWPORT_LOCK), 250);
    }
  }
  const REC_WAIT = 120000;   // 자동으로 앱을 다시 시작하는 건 2분에 한 번까지
  function canAutoRestart() {
    const rec = store.get('bf.rec', { t: 0, n: 0, noauto: false });
    return !rec.noauto && Date.now() - (rec.t || 0) > REC_WAIT;
  }
  // 앱 다시 시작: 읽던 위치를 저장하고 페이지를 새로 읽는다 (새로 켠 것과 같은 화면 계산을 다시 받는다)
  function restartApp(why, auto) {
    try {
      store.set('bf.pos', rotPos || pos);
      const rec = store.get('bf.rec', { t: 0, n: 0, noauto: false });
      store.set('bf.rec', { t: Date.now(), n: (rec.n || 0) + 1, noauto: !!rec.noauto, auto: !!auto, why: String(why || '') });
    } catch (e) { /* 무시 */ }
    location.reload();
  }
  // 고급설정의 '다시 맞추기': 1·2단계를 차례로 하고 화면을 처음부터 다시 계산해 책을 새로 만든다
  function refitScreen() {
    doRecover(1);
    setTimeout(() => doRecover(2), 450);
    setTimeout(() => { lastGeo = ''; onResize(); }, 900);   // lastGeo를 비워 값이 같아도 책을 새로 만들게 한다
  }
  // 앱을 다시 켠 직후에도 어긋난 값이면, 다시 시작해도 소용없다는 뜻이므로 자동 다시 시작은 더 하지 않는다
  function afterRestartCheck(g) {
    try {
      const rec = store.get('bf.rec', { t: 0, n: 0, noauto: false });
      if (rec.t && Date.now() - rec.t < 30000 && suspectGeo(g)) {
        store.set('bf.rec', Object.assign({}, rec, { noauto: true }));
      }
    } catch (e) { /* 무시 */ }
  }

  let healRaf = 0;
  const healSoon = () => { if (!healRaf) healRaf = requestAnimationFrame(() => { healRaf = 0; heal(); }); };
  window.addEventListener('scroll', healSoon, true);   // 쪽 안쪽이 스크롤되는 것도 잡는다
  if (window.visualViewport) { window.visualViewport.addEventListener('scroll', healSoon); window.visualViewport.addEventListener('resize', healSoon); }
  ['pointerup', 'pointercancel', 'touchend'].forEach((ev) => window.addEventListener(ev, () => { setTimeout(heal, 80); setTimeout(heal, 600); }));
  document.addEventListener('focusout', () => { setTimeout(heal, 100); setTimeout(heal, 500); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(heal, 200); });
  // 안전영역 값만 늦게 바뀌는 경우(알림 이벤트가 없다)를 위해, 가끔 측정값이 만들 때와 같은지 본다
  function lateGeoCheck() {
    if (!bible || !pg || building || settleStart) return;
    if (geoKey(geometry()) !== lastGeo) onResize();
  }
  // 손가락 없이 책장이 접히거나 넘어가는 도중(read가 아닌 상태)에 3초 넘게 멈춰 있으면 책을 다시 만든다
  let stuckTicks = 0;
  function flipStuckCheck() {
    if (!flip || building || settleStart || drag || turning || down) { stuckTicks = 0; return; }
    let st = 'read';
    try { st = flip.getState(); } catch (e) { /* 무시 */ }
    if (st === 'read') { stuckTicks = 0; return; }
    if (++stuckTicks >= 2) {
      stuckTicks = 0;
      rebuild(pos);
    }
  }
  setInterval(() => { if (!document.hidden) { heal(); lateGeoCheck(); flipStuckCheck(); } }, 1500);
  // 위쪽 메뉴줄·도구 상자를 끌어도 문서 전체가 끌려 움직이지 않게 막는다
  ['#topbar', '#ann-bar'].forEach((q) => $(q).addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false }));

  // ---------- 시트: 책 고르기 / 설정 ----------
  const sheet = $('#sheet'), sheetBody = $('#sheet-body'), sheetTitle = $('#sheet-title');
  const backBtn = $('#sheet-back');
  let sheetBack = null;
  // 머리줄 오른쪽의 동작 단추(연필): 설교노트 목록에서만 보인다
  const actBtn = $('#sheet-act');
  let sheetAct = null;
  function setSheetAct(fn, label) {
    sheetAct = fn || null;
    actBtn.hidden = !sheetAct;
    if (label) { actBtn.setAttribute('aria-label', label); actBtn.title = label; }
  }
  actBtn.addEventListener('click', () => { if (sheetAct) sheetAct(); });

  // 창은 화면 한가운데에 띄운다. 키보드가 올라오면 보이는 영역(visualViewport)의 가운데로 맞춘다.
  // tall=true: 검색처럼 결과 길이가 바뀌는 창은 높이를 고정해 흔들리지 않게 한다.
  function clearSheetFit() {
    ['top', 'left', 'width', 'height', 'right', 'bottom'].forEach((q) => { sheet.style[q] = ''; });
  }
  function fitSheet() {
    if (sheet.hidden) return;
    const v = window.visualViewport;
    // 평소에는 화면 전체(CSS inset:0)를 쓴다. 키보드가 올라와 보이는 영역이 줄었을 때만 그 영역에 맞춘다.
    // (보이는 영역 값이 이상하게 읽히는 기기에서 창이 화면 밖으로 밀려나는 일을 막는다)
    const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    const kb = v && typing && v.height < window.innerHeight - 80 && v.offsetTop >= 0 && v.offsetTop < window.innerHeight;
    if (kb) {
      sheet.style.top = v.offsetTop + 'px';
      sheet.style.left = v.offsetLeft + 'px';
      sheet.style.width = v.width + 'px';
      sheet.style.height = v.height + 'px';
      sheet.style.right = 'auto';
      sheet.style.bottom = 'auto';
    } else {
      clearSheetFit();
    }
    // 그래도 창이 화면을 제대로 덮지 못하면 원래대로 되돌린다
    const r = sheet.getBoundingClientRect();
    if (r.height < window.innerHeight * 0.6 || r.top < -2 || r.top > window.innerHeight * 0.5) clearSheetFit();
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitSheet);
    window.visualViewport.addEventListener('scroll', fitSheet);
  }
  // 키보드: 아이폰 앱의 웹뷰는 키보드가 올라와도 보이는 영역이 줄지 않아(위의 visualViewport 방식이 통하지 않음), 앱이 키보드 높이를 직접 알려 준다.
  // → --kb(px)와 html.kb 클래스로 창(#sheet)·바이블 포토 카드 화면(#pc)을 키보드 위쪽 영역에 맞추고, 입력 중인 칸이 보이도록 스크롤한다.
  let kbH = 0;
  function revealFocused() {
    const a = document.activeElement;
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    [60, 340].forEach((ms) => setTimeout(() => {
      if (document.activeElement !== a) return;
      try { a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* 무시 */ }
    }, ms));
  }
  window.bfKeyboard = (h) => {
    const next = Math.max(0, Math.min(Math.round(+h || 0), Math.round(window.innerHeight * 0.7)));
    if (next === kbH) return;
    kbH = next;
    document.documentElement.style.setProperty('--kb', kbH + 'px');
    document.documentElement.classList.toggle('kb', kbH > 0);
    fitSheet();
    if (pcIsOpen()) { layoutPc(); pcRender(); }
    if (mpIsOpen()) { layoutMp(); mpCardFit(); }
    if (kbH > 0) revealFocused();
  };
  document.addEventListener('focusin', () => { setTimeout(fitSheet, 50); if (kbH > 0) revealFocused(); if (mpIsOpen()) setTimeout(mpCardFit, 80); });
  document.addEventListener('focusout', () => { setTimeout(fitSheet, 50); if (mpIsOpen()) setTimeout(mpCardFit, 80); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (mpIsOpen()) mpCardFit(); });   // 웹(브라우저)에서는 보이는 영역이 줄어드는 것으로 안다
  let openedAt = 0;
  function openSheet(tall) {
    closeSpot();
    openedAt = performance.now();
    sheet.classList.toggle('tall', !!tall);
    sheet.hidden = false;
    fitSheet();
    setTimeout(fitSheet, 120);
    setTimeout(fitSheet, 500);
  }
  function closeSheet() {
    sheet.hidden = true;
    ['top', 'left', 'width', 'height', 'right', 'bottom'].forEach((p) => { sheet.style[p] = ''; });
    sheetBack = null;
    setSheetAct(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  $('#sheet-close').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => { if (e.target === sheet && performance.now() - openedAt > 450) closeSheet(); });
  backBtn.addEventListener('click', () => { if (sheetBack) sheetBack(); });

  function showBooks(testament) {
    sheetTitle.textContent = '성경';
    setSheetAct(null);
    backBtn.hidden = true;
    sheetBack = null;
    const ot = testament !== 'nt';
    const from = ot ? 0 : 39, to = ot ? 39 : bible.books.length;
    let html = '<div class="tabs"><button class="tab' + (ot ? ' on' : '') + '" data-t="ot">구약</button>' +
      '<button class="tab' + (!ot ? ' on' : '') + '" data-t="nt">신약</button></div><div class="grid">';
    for (let i = from; i < to; i++) {
      html += '<button class="cell' + (i === pos.book ? ' on' : '') + '" data-b="' + i + '">' + esc(bible.books[i].name) + '</button>';
    }
    sheetBody.innerHTML = html + '</div>';
    sheetBody.querySelectorAll('.tab').forEach((b) =>
      b.addEventListener('click', () => showBooks(b.dataset.t)));
    sheetBody.querySelectorAll('[data-b]').forEach((b) =>
      b.addEventListener('click', () => showChapters(+b.dataset.b, ot ? 'ot' : 'nt')));
  }

  function showChapters(bookIndex, testament) {
    const book = bible.books[bookIndex];
    const unit = book.id === 'psa' ? '편' : '장';
    sheetTitle.textContent = book.name + ' (' + book.chapters.length + unit + ')';
    backBtn.hidden = false;
    sheetBack = () => showBooks(testament);
    let html = '<div class="grid ch">';
    for (let c = 0; c < book.chapters.length; c++) {
      const on = bookIndex === pos.book && c === pos.chapter;
      html += '<button class="cell' + (on ? ' on' : '') + '" data-c="' + c + '">' + (c + 1) + '</button>';
    }
    sheetBody.innerHTML = html + '</div>';
    sheetBody.querySelectorAll('[data-c]').forEach((b) =>
      b.addEventListener('click', () => {
        closeSheet();
        jumpTo({ book: bookIndex, chapter: +b.dataset.c, verse: 1 });
      }));
  }

  let settingsTimer = null;
  // view: 값을 바꾼 뒤 다시 그릴 화면(기본은 읽기 설정). 다시 그려도 보던 위치가 그대로 유지된다.
  function changeSettings(patch, view) {
    settings = Object.assign({}, settings, patch);
    store.set('bf.settings', settings);
    const keep = sheetBody.scrollTop;
    (view || showSettings)();
    sheetBody.scrollTop = keep;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => rebuild(pos), 250);
  }

  // ---------- 번역 선택: 본문 아래에 다른 번역·풀이를 함께 보여 준다 ----------
  // 지금은 'AI 표준어 번역'(settings.std)만 고를 수 있다. 나머지 번역은 자리만 두었고 체크할 수 없다(추후 업데이트 예정).
  const TRANSLATIONS = [
    { key: 'std', name: 'AI 표준어 번역', sub: '개역한글 아래에 표준어 풀이를 작은 글씨로 보여 줍니다', ready: true },
    { key: 'krv2', name: '개역개정', ready: false },
    { key: 'hdr', name: '현대인의성경', ready: false },
    { key: 'easy', name: '쉬운성경', ready: false },
  ];
  // 'AI 표준어 번역'을 골랐을 때 그 아래에 나오는 보기와 안내문
  const STD_INFO =
    '<div class="easy-eg typo"><div class="eg-h">보기 (창세기 1장 1절)</div>' +
    '<p><sup class="vn">1</sup>태초에 하나님이 천지를 창조하시니라</p>' +
    '<p class="std">태초에 하나님이 하늘과 땅을 창조하셨다.</p></div>' +
    '<p class="note">※ 이 풀이는 개역한글의 뜻을 현대 표준어로 옮겨 쓴 <b>참고용 글</b>입니다. 공식 번역본이 아니며, 본문과 조금 다르게 읽힐 수 있으니 정확한 뜻은 개역한글 본문과 함께 확인해 주세요. 설교나 가르침에 쓰기 전에는 목회자·전문가의 검토를 권합니다.</p>';
  function showTranslations() {
    sheetTitle.textContent = '번역 선택';
    setSheetAct(null);
    backBtn.hidden = false;   // v48: 번역 선택은 설정 안으로 옮겨져, 뒤로 가면 설정으로 돌아간다
    sheetBack = () => { showSettings(); sheetBody.scrollTop = 0; };
    const pending = TRANSLATIONS.filter((t) => !t.ready).map((t) => esc(t.name));
    sheetBody.innerHTML =
      TRANSLATIONS.map((t) => {
        const on = t.ready && !!settings[t.key];
        return '<div class="tr-item"><label class="row chk tr' + (t.ready ? '' : ' off') + '">' +
          '<input type="checkbox" id="tr-' + t.key + '"' + (on ? ' checked' : '') + (t.ready ? '' : ' disabled') + '><i class="cb" aria-hidden="true"></i>' +
          '<span>' + esc(t.name) + (t.sub ? '<small class="sub">' + esc(t.sub) + '</small>' : '') + '</span></label>' +
          (t.key === 'std' ? '<div class="tr-info" id="tr-info-std"' + (on ? '' : ' hidden') + '>' + STD_INFO + '</div>' : '') +
          '</div>';
      }).join('') +
      '<p class="note">※ 참고: ' + pending.join(', ') + '은 추후 업데이트될 예정입니다.</p>';
    $('#tr-std').addEventListener('change', (e) => {
      settings = Object.assign({}, settings, { std: !!e.target.checked });
      store.set('bf.settings', settings);
      $('#tr-info-std').hidden = !settings.std;   // 고르면 안내문이 나오고, 끄면 사라진다
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(() => rebuild(pos), 250);   // 창은 그대로 두고 뒤의 본문만 다시 만든다 (읽던 위치 유지)
    });
  }

  function showSettings() {
    sheetTitle.textContent = '설정';
    setSheetAct(null);
    backBtn.hidden = true;
    sheetBack = null;
    const seg = (map, cur, key) => '<div class="seg">' + Object.keys(map).map((k) =>
      '<button class="' + (k === cur ? 'on' : '') + '" data-k="' + key + '" data-v="' + k + '">' + map[k] + '</button>').join('') + '</div>';
    sheetBody.innerHTML =
      '<div class="row"><span>글자 크기</span><div class="stepper">' +
      '<button data-f="-1" aria-label="작게">A−</button><b>' + settings.fontSize + '</b>' +
      '<button data-f="1" aria-label="크게">A+</button></div></div>' +
      '<div class="row"><span>테마</span>' + seg(THEMES, settings.theme, 'theme') + '</div>' +
      '<div class="row col"><span>글씨체</span><div class="fontgrid">' + Object.keys(FONTS).map((k) =>
        '<button class="fbtn' + (k === settings.font ? ' on' : '') + '" data-k="font" data-v="' + k +
        '" style="font-family:' + FONTS[k].stack.replace(/"/g, "'") + '">' + FONTS[k].label + '<small>가나다 창조 Aa</small></button>').join('') +
      '</div></div>' +
      '<div class="row"><span>화면 구성</span>' + seg(LAYOUTS, settings.layout, 'layout') + '</div>' +
      '<button class="row rowlink" id="go-tr" type="button"><span>번역 선택 <small class="sub">' + (settings.std ? 'AI 표준어 번역 켜짐' : '개역한글만 보기') + '</small></span><span class="chev">›</span></button>' +
      '<button class="row rowlink" id="go-adv" type="button"><span>고급설정 <small class="sub">여백 · 위치 · 백업 · 화면 맞추기</small></span><span class="chev">›</span></button>' +
      '<p class="credit" aria-label="앱 제작자 SEONHAN">© SEONHAN</p>';   // v62: 설정 화면 맨 아래 제작자 표시
    $('#go-tr').addEventListener('click', () => { showTranslations(); sheetBody.scrollTop = 0; });
    $('#go-adv').addEventListener('click', () => { advHelpOpen = {}; showAdvanced(); sheetBody.scrollTop = 0; });
    sheetBody.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, settings.fontSize + (+b.dataset.f)));
      if (next !== settings.fontSize) changeSettings({ fontSize: next });
    }));
    sheetBody.querySelectorAll('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        changeSettings({ [b.dataset.k]: b.dataset.v });
      }));
  }

  // ---------- 문의하기 (v69. v70에서 설정 안이 아니라 머리줄의 별도 아이콘으로 옮김. 후원하기는 v70에서 삭제) ----------
  // 받는 메일 주소: 이 한 줄만 고치면 됩니다. 비워 두면 '아직 설정되지 않음'으로 보이고 보내기가 꺼집니다.
  const INQUIRY_EMAIL = 'choice.seon@gmail.com';
  const ASK_MAX_PHOTOS = 3, ASK_MAX_TITLE = 80, ASK_MAX_BODY = 2000;
  const ASK_PHOTO_EDGE = 1600, ASK_PHOTO_BYTES = 1200000;   // 사진은 긴 변 1600px·약 1.2MB 안쪽으로 줄여서 붙인다
  let askDraft = { title: '', body: '', photos: [] };       // 화면을 닫았다 열어도 쓰던 글이 남도록 메모리에 둔다(앱을 끄면 사라짐)
  let askBusy = false, askPhotoBusy = false;

  // 앱(껍데기)에 요청을 보내고 답을 기다린다. 앱이 답을 window.bfMail 로 돌려준다.
  const nativeBridge = () => (NATIVE && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bf) || null;
  let nativeSeq = 0;
  const nativeWait = {};
  const nativeCall = (msg, timeoutMs) => new Promise((resolve) => {
    const br = nativeBridge();
    if (!br) { resolve({ result: 'nobridge' }); return; }
    const id = ++nativeSeq;
    let timer = null;
    nativeWait[id] = (r) => { clearTimeout(timer); resolve(r || { result: 'fail' }); };
    if (timeoutMs) timer = setTimeout(() => { delete nativeWait[id]; resolve({ result: 'timeout' }); }, timeoutMs);
    try { br.postMessage(Object.assign({ id }, msg)); } catch (e) { delete nativeWait[id]; clearTimeout(timer); resolve({ result: 'fail' }); }
  });
  const nativeReply = (r) => { const f = r && nativeWait[r.id]; if (f) { delete nativeWait[r.id]; f(r); } };
  window.bfMail = nativeReply;

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 아래 방법으로 */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  // 휴대폰 사진은 크므로 메일에 붙일 만큼만 줄인다(긴 변 1600px, JPEG)
  async function askShrink(file) {
    let src = null;
    if (window.createImageBitmap) { try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { src = null; } }
    if (!src) {
      const url = URL.createObjectURL(file);
      src = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('이미지를 읽지 못했습니다'));
        im.src = url;
      });
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    const iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
    if (!iw || !ih) throw new Error('빈 이미지');
    const k = Math.min(1, ASK_PHOTO_EDGE / Math.max(iw, ih));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(iw * k)); cv.height = Math.max(1, Math.round(ih * k));
    const cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);   // 투명한 그림이 검게 나오지 않도록 흰 바탕
    cx.drawImage(src, 0, 0, cv.width, cv.height);
    if (src.close) src.close();
    let q = 0.82, url = cv.toDataURL('image/jpeg', q);
    while (url.length * 0.75 > ASK_PHOTO_BYTES && q > 0.45) { q -= 0.12; url = cv.toDataURL('image/jpeg', q); }
    const b64 = url.slice(url.indexOf(',') + 1);
    return { b64, url, bytes: Math.round(b64.length * 0.75) };
  }

  function showInquiry() {
    sheetTitle.textContent = '문의하기';
    setSheetAct(null);
    backBtn.hidden = true;   // v70: 머리줄의 문의하기 아이콘으로 바로 열리므로 돌아갈 화면 없이 닫기만 둔다
    sheetBack = null;
    sheetBody.innerHTML =
      '<p class="note tight">불편한 점·오류·바라는 점을 보내 주세요. 사진은 ' + ASK_MAX_PHOTOS + '장까지 붙일 수 있습니다. ' +
      '「메일로 보내기」를 누르면 아이폰의 <b>메일 작성 창</b>이 열리고, 내용을 확인한 뒤 거기서 한 번 더 보내기를 누르면 전달됩니다. ' +
      '앱 버전과 화면 크기가 메일 끝에 함께 적힙니다.</p>' +
      (INQUIRY_EMAIL ? '' : '<p class="ask-warn">받는 메일 주소가 아직 설정되지 않아 보낼 수 없습니다.</p>') +
      '<label class="ask-lab" for="ask-title">제목</label>' +
      '<input id="ask-title" class="ask-in" type="text" maxlength="' + ASK_MAX_TITLE + '" placeholder="예) 모임 장소 화면에서 글자가 겹칩니다" autocomplete="off">' +
      '<label class="ask-lab" for="ask-body">내용 <small class="sub" id="ask-count"></small></label>' +
      '<textarea id="ask-body" class="ask-in" rows="7" maxlength="' + ASK_MAX_BODY + '" placeholder="어떤 화면에서 무엇을 했을 때 어떤 일이 생겼는지 적어 주세요."></textarea>' +
      '<div class="ask-lab">사진 <small class="sub" id="ask-pcount"></small></div>' +
      '<div class="ask-photos" id="ask-photos"></div>' +
      '<div class="row ask-send"><span id="ask-msg" class="sub" role="status" aria-live="polite">&nbsp;</span><button class="seg-btn on" id="ask-send" type="button">메일로 보내기</button></div>' +
      '<div id="ask-fb" class="ask-fb" hidden></div>';
    const ti = $('#ask-title'), bo = $('#ask-body'), msg = $('#ask-msg'), send = $('#ask-send'), box = $('#ask-photos'), fb = $('#ask-fb');
    ti.value = askDraft.title; bo.value = askDraft.body;
    const say = (t) => { msg.textContent = t || ' '; };
    const counts = () => { $('#ask-count').textContent = '(' + bo.value.length + '/' + ASK_MAX_BODY + ')'; $('#ask-pcount').textContent = '(' + askDraft.photos.length + '/' + ASK_MAX_PHOTOS + ')'; };
    const photos = () => {
      box.innerHTML = askDraft.photos.map((p, i) =>
        '<div class="ask-ph"><img src="' + p.url + '" alt="첨부 사진 ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="사진 ' + (i + 1) + ' 빼기">×</button></div>').join('') +
        (askDraft.photos.length < ASK_MAX_PHOTOS ? '<label class="ask-add">＋<small>사진 추가</small><input id="ask-file" type="file" accept="image/*" multiple></label>' : '');
      box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { askDraft.photos.splice(+b.dataset.rm, 1); say(''); photos(); counts(); }));
      const fi = $('#ask-file');
      if (fi) fi.addEventListener('change', async (e) => {
        const files = [...(e.target.files || [])]; e.target.value = '';
        const room = ASK_MAX_PHOTOS - askDraft.photos.length;
        if (!files.length || room <= 0) return;
        if (files.length > room) say('사진은 ' + ASK_MAX_PHOTOS + '장까지 붙일 수 있어 ' + room + '장만 담았습니다.');
        askPhotoBusy = true; send.disabled = true;
        let bad = 0;
        for (const f of files.slice(0, room)) {
          if (files.length <= room) say('사진을 줄이는 중…');
          try { askDraft.photos.push(await askShrink(f)); } catch (err) { bad++; }
        }
        askPhotoBusy = false; send.disabled = false;
        if (!document.body.contains(box)) return;
        if (bad) say('읽지 못한 사진이 ' + bad + '장 있습니다. 다른 사진으로 다시 시도해 주세요.');
        else if (files.length <= room) say('');
        photos(); counts();
      });
    };
    ti.addEventListener('input', () => { askDraft.title = ti.value; say(''); fb.hidden = true; });
    bo.addEventListener('input', () => { askDraft.body = bo.value; say(''); fb.hidden = true; counts(); });
    photos(); counts();

    // 메일 작성 창을 열 수 없을 때(메일 계정이 없거나 PC 화면): 주소·내용을 복사하거나 기본 메일 앱으로 넘긴다
    const fallback = (subject, text, why) => {
      const mailto = 'mailto:' + INQUIRY_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text.slice(0, 1500));
      fb.hidden = false;
      fb.innerHTML =
        '<p class="adv-desc">' + esc(why) + '</p>' +
        '<p class="adv-desc">받는 주소: <b class="ask-addr">' + esc(INQUIRY_EMAIL) + '</b></p>' +
        '<div class="adv-btns"><button class="seg-btn" id="ask-c-addr" type="button">주소 복사</button><button class="seg-btn" id="ask-c-text" type="button">제목·내용 복사</button></div>' +
        '<a class="seg-btn ask-mailto" href="' + esc(mailto).replace(/"/g, '&quot;') + '">기본 메일 앱으로 열기 (사진은 붙지 않음)</a>';
      $('#ask-c-addr').addEventListener('click', async () => { say((await copyToClipboard(INQUIRY_EMAIL)) ? '주소를 복사했습니다.' : '복사가 안 됐습니다. 주소를 길게 눌러 복사하세요.'); });
      $('#ask-c-text').addEventListener('click', async () => { say((await copyToClipboard(subject + '\n\n' + text)) ? '제목과 내용을 복사했습니다.' : '복사가 안 됐습니다. 내용 칸을 길게 눌러 복사하세요.'); });
    };

    send.addEventListener('click', async () => {
      if (askBusy) return;
      const title = askDraft.title.trim(), text = askDraft.body.trim();
      if (!INQUIRY_EMAIL) { say('받는 메일 주소가 설정되지 않아 보낼 수 없습니다.'); return; }
      if (!title) { say('제목을 입력해 주세요.'); ti.focus(); return; }
      if (!text) { say('내용을 입력해 주세요.'); bo.focus(); return; }
      if (askPhotoBusy) { say('사진을 줄이는 중입니다. 잠시 뒤 다시 눌러 주세요.'); return; }
      const subject = '[앱 문의] ' + title;
      const full = text + '\n\n— — —\n앱 ' + APP_VER + ' · 화면 ' + window.innerWidth + '×' + window.innerHeight;
      if (!nativeBridge()) { fallback(subject, full, '이 화면(아이폰 앱이 아닌 곳)에서는 메일 작성 창을 열 수 없습니다.'); return; }
      askBusy = true; send.disabled = true; fb.hidden = true; say('메일 작성 창을 여는 중…');
      const r = await nativeCall({ mail: { to: INQUIRY_EMAIL, subject, body: full, photos: askDraft.photos.map((p) => ({ data: p.b64 })) } });
      askBusy = false;
      if (r.result === 'sent') askDraft = { title: '', body: '', photos: [] };
      if (!document.body.contains(send)) { if (r.result === 'sent') showToastLine('문의를 보냈습니다. 감사합니다.'); return; }
      send.disabled = false;
      if (r.result === 'sent') { ti.value = ''; bo.value = ''; photos(); counts(); say('문의를 보냈습니다. 감사합니다.'); }
      else if (r.result === 'saved') say('임시 보관함에 저장했습니다. 메일 앱에서 보내 주세요.');
      else if (r.result === 'cancelled') say('보내기를 취소했습니다. 작성한 내용은 그대로 있습니다.');
      else if (r.result === 'unavailable') { say(''); fallback(subject, full, '이 아이폰에는 메일 계정이 없어 메일 작성 창을 열 수 없습니다. 설정 › 메일에서 계정을 추가하면 사진까지 바로 보낼 수 있습니다. 아래 방법으로도 보낼 수 있습니다.'); }
      else if (r.result === 'busy') say('다른 창이 열려 있습니다. 닫은 뒤 다시 눌러 주세요.');
      else say('메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    });
  }

  // ---------- 고급설정: 여백 · 위치 · 백업 · 화면 맞추기 ----------
  // 각 항목의 설명은 이름 옆 ⓘ(동그라미 물음표)를 눌러야 보인다. 열어 둔 설명은 값을 바꿔 화면이 다시 그려져도 그대로 열려 있다.
  let advHelpOpen = {};
  function showAdvanced() {
    sheetTitle.textContent = '고급설정';
    backBtn.hidden = false;
    sheetBack = () => { showSettings(); sheetBody.scrollTop = 0; };
    const g = geometry();
    const topSp = g.eff.topSpread, topSi = g.eff.topSingle, shift = g.eff.shiftX, bot = g.eff.bottomSpread;
    // ⓘ 단추와 접히는 설명. key 는 항목마다 다르게 준다.
    const qm = (key) => '<button class="qm" type="button" data-q="' + key + '" aria-expanded="' + (advHelpOpen[key] ? 'true' : 'false') + '" aria-controls="adv-d-' + key + '" aria-label="설명 보기">?</button>';
    const help = (key, text) => '<p class="adv-desc" id="adv-d-' + key + '"' + (advHelpOpen[key] ? '' : ' hidden') + '>' + text + '</p>';
    // 한 항목 = 이름 + ⓘ + 값 조절(− 값 +) + (눌러야 보이는) 설명. extra 는 늘 보여야 하는 알림.
    const item = (name, sub, key, step, val, minus, plus, desc, extra) =>
      '<div class="adv"><div class="row"><span>' + name + ' <small class="sub">' + sub + '</small>' + qm(key) + '</span><div class="stepper">' +
      '<button data-adv="' + key + '" data-step="-' + step + '" aria-label="' + minus + '">' + (key === 'shiftX' ? '◂' : '−') + '</button><b>' + val + '</b>' +
      '<button data-adv="' + key + '" data-step="' + step + '" aria-label="' + plus + '">' + (key === 'shiftX' ? '▸' : '+') + '</button></div></div>' +
      help(key, desc) + (extra || '') + '</div>';
    // 안전영역 때문에 실제 적용된 윗 여백이 설정값과 다른 경우만 알려 준다 (이 알림은 늘 보인다)
    const topNote = g.spread && g.padTop !== topSp
      ? '<p class="adv-desc"><b>※ 지금 화면의 안전영역(위 ' + g.si.top + ') 때문에 실제로는 ' + g.padTop + 'px로 적용됩니다.</b></p>' : '';
    sheetBody.innerHTML =
      '<div class="adv-head">펼친 화면 (두 쪽)</div>' +
      item('윗 여백', '(펼침)', 'topSpread', 4, topSp, '줄이기', '늘리기',
        '화면 맨 위에서 본문이 시작되는 곳까지의 높이입니다. 이 안에 책 이름·메뉴 아이콘과 오른쪽 위 상태 아이콘이 들어갑니다. 줄이면 본문이 더 위로 올라와 한 쪽에 들어가는 줄 수가 늘어납니다.', topNote) +
      (NATIVE ? '' : item('가로 위치', '(오른쪽으로)', 'shiftX', 4, shift, '왼쪽으로', '오른쪽으로',
        '두 쪽 전체를 오른쪽으로 옮기는 양입니다. 아이폰 듀오를 펼치면 앱이 실제 화면보다 좁은 영역만 알려 받아 두 쪽이 왼쪽으로 쏠려 보입니다. 값을 키우면 가운데로 오지만, 옮긴 만큼 한 쪽의 폭이 좁아져 한 줄에 들어가는 글자가 줄어듭니다.')) +
      item('아래 여백', '(펼침)', 'bottomSpread', 4, bot, '줄이기', '늘리기',
        '본문 맨 아래에 비워 두는 높이입니다. 화면 맨 아래 일부는 앱이 그릴 수 없는 영역이라, 0으로 해도 그만큼은 비어 보입니다.') +
      '<div class="adv-head">접은 화면 (한 쪽)</div>' +
      item('윗 여백', '(한 쪽)', 'topSingle', 4, topSi, '줄이기', '늘리기',
        '접은 상태에서 본문이 시작되는 높이입니다. 접은 화면은 책 이름 아래에 메뉴 아이콘이 한 줄 더 있어서, 너무 줄이면 본문과 겹칩니다.') +
      '<div class="row"><span>여백 기본값으로 되돌리기' + qm('defaults') + '</span><button class="seg-btn" id="adv-reset" type="button">되돌리기</button></div>' +
      help('defaults', '기본값은 기기와 화면에 맞춰 자동으로 정해집니다(듀오 펼침: 윗 ' + TOP_DEFAULT.topSpread + ' · 가로 위치 ' + SHIFT_DEFAULT + ' · 아래 ' + BOTTOM_SPREAD_DEFAULT + ', 한 쪽 윗 ' + TOP_DEFAULT.topSingle + '). 가로로 돌린 아이폰은 머리줄이 작아지고 노치 쪽이 비워집니다.' +
        '<br>값을 바꾸면 본문이 잠시 뒤에 새로 정렬됩니다. 읽던 위치는 그대로 유지됩니다.') +
      '<button class="row rowlink" id="go-bk" type="button"><span>데이터 백업 <small class="sub">하이라이트 · 설교노트 · 모임 장소 · 리뷰 내보내기/불러오기</small></span><span class="chev">›</span></button>' +
      '<button class="row rowlink" id="go-rv" type="button"><span>리뷰 모아 보기 <small class="sub">관리자용 · 내 리뷰 내보내기 · 다른 기기 리뷰 모으기</small></span><span class="chev">›</span></button>' +
      '<div class="adv-head">화면이 위로 올라가거나 작게 보일 때' + qm('recover') + '</div>' +
      help('recover', '<b>다시 맞추기</b>는 화면 값을 새로 읽고 책을 다시 만듭니다. <b>앱 다시 시작</b>은 앱을 처음부터 다시 켭니다. 두 경우 모두 읽던 위치는 그대로입니다. 먼저 다시 맞추기를 눌러 보고, 그래도 고쳐지지 않으면 앱 다시 시작을 눌러 주세요.') +
      '<div class="adv-btns"><button class="seg-btn" id="adv-refit" type="button">다시 맞추기</button><button class="seg-btn" id="adv-restart" type="button">앱 다시 시작</button></div>';
    const LIMITS = { topSpread: [TOP_MIN_SPREAD, TOP_MAX], topSingle: [TOP_MIN_SINGLE, TOP_MAX], shiftX: [0, 160], bottomSpread: [0, 80] };
    sheetBody.querySelectorAll('[data-adv]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.adv, cur = geometry().eff[key];
      const next = Math.min(LIMITS[key][1], Math.max(LIMITS[key][0], cur + (+b.dataset.step)));
      if (next !== cur) changeSettings({ [key]: next }, showAdvanced);
    }));
    $('#go-bk').addEventListener('click', () => { showBackup(); sheetBody.scrollTop = 0; });
    $('#go-rv').addEventListener('click', () => { showReviews(); sheetBody.scrollTop = 0; });
    // ⓘ: 누르면 그 항목의 설명을 펼치고, 다시 누르면 접는다
    sheetBody.querySelectorAll('.qm').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.q, d = $('#adv-d-' + k);
      if (!d) return;
      const open = d.hidden;
      d.hidden = !open; advHelpOpen[k] = open; b.setAttribute('aria-expanded', String(open));
    }));
    $('#adv-refit').addEventListener('click', () => { closeSheet(); refitScreen(); });
    $('#adv-restart').addEventListener('click', () => restartApp('직접', false));
    // 되돌리기 = 저장한 값을 지워 기기에 맞는 자동값으로 돌아간다. (듀오는 예전 기본값 그대로)
    $('#adv-reset').addEventListener('click', () => changeSettings(
      geometry().duo
        && !NATIVE ? { topSpread: TOP_DEFAULT.topSpread, topSingle: TOP_DEFAULT.topSingle, shiftX: SHIFT_DEFAULT, bottomSpread: BOTTOM_SPREAD_DEFAULT }
        : { topSpread: undefined, topSingle: undefined, shiftX: undefined, bottomSpread: undefined }, showAdvanced));
  }

  // ---------- 데이터 백업: 하이라이트·읽던 위치·글꼴 설정을 글자로 내보내고 다시 불러온다 ----------
  // 이 앱의 기록은 기기 안(주소별)에만 저장되므로, 앱 주소를 옮기거나 앱을 지우기 전에 한 번 백업해 둔다.
  function backupText() {
    return JSON.stringify({
      app: 'bibleflip', ver: 1, savedAt: new Date().toISOString(),
      pos, tool, anns, notes: notesDB.items, places: mpDB.items, reviews: rvDB.items, reviewsIn: rvDB.inc,
      settings: { fontSize: settings.fontSize, theme: settings.theme, font: settings.font, layout: settings.layout, std: !!settings.std },
    });
  }
  // 붙여 넣은 글을 검사해서 쓸 수 있는 것만 골라 적용한다. 잘못된 내용이면 오류를 던진다.
  function applyBackup(text) {
    let d;
    try { d = JSON.parse(String(text).trim()); } catch (e) { d = null; }
    if (!d || d.app !== 'bibleflip' || !d.anns || typeof d.anns !== 'object' || Array.isArray(d.anns)) {
      throw new Error('백업 내용이 아닙니다. 복사해 둔 글을 처음부터 끝까지 붙여 넣었는지 확인해 주세요.');
    }
    const clean = {};
    let verses = 0, marks = 0;
    Object.keys(d.anns).forEach((key) => {
      if (!/^[a-z0-9]+\.\d+\.\d+$/.test(key) || !Array.isArray(d.anns[key])) return;
      const list = d.anns[key].filter((a) => a && Number.isFinite(a.s) && Number.isFinite(a.e) && a.e > a.s && a.s >= 0 && KINDS[a.kind])
        .map((a) => ({
          id: typeof a.id === 'string' ? a.id.slice(0, 24) : newId(),
          s: Math.floor(a.s), e: Math.floor(a.e), kind: a.kind,
          pen: PENS[a.pen] ? a.pen : 'marker',
          c: Number.isInteger(a.c) && a.c >= 0 && a.c < COLORS.length ? a.c : 0,
        }));
      if (list.length) { clean[key] = list; verses++; marks += list.length; }
    });
    anns = clean;
    saveAnns();
    let notes = null;
    if (Array.isArray(d.notes)) {   // 설교노트가 들어 있는 백업이면 노트도 바꾼다 (예전 백업에는 없으므로 그때는 그대로 둔다)
      notes = cleanNotes(d.notes);
      notesDB = { items: notes };
      saveNotes();
      noteIdx = null;
    }
    let places = null;
    if (Array.isArray(d.places)) {   // 모임 장소(카페)가 들어 있는 백업이면 장소도 바꾼다 (예전 백업에는 없으므로 그때는 그대로 둔다)
      places = mpClean(d.places);
      mpDB.items = places;
      mpSave();
      mpSel = null;
    }
    let reviews = null;
    if (Array.isArray(d.reviews)) {   // 리뷰가 들어 있는 백업이면 리뷰도 바꾼다 (예전 백업에는 없으므로 그때는 그대로 둔다)
      rvDB.items = rvClean(d.reviews, false);
      if (Array.isArray(d.reviewsIn)) rvDB.inc = rvClean(d.reviewsIn, true);
      rvSave();
      reviews = rvDB.items.length;
    }
    const p = d.pos;
    if (p && Number.isInteger(p.book) && p.book >= 0 && p.book < bible.books.length &&
        Number.isInteger(p.chapter) && p.chapter >= 0 && p.chapter < bible.books[p.book].chapters.length) {
      pos = { book: p.book, chapter: p.chapter, verse: Number.isInteger(p.verse) && p.verse > 0 ? p.verse : 1 };
      store.set('bf.pos', pos);
    }
    if (d.tool && PENS[d.tool.pen] && Number.isInteger(d.tool.c) && d.tool.c >= 0 && d.tool.c < COLORS.length) {
      tool = { pen: d.tool.pen, c: d.tool.c };
      store.set('bf.tool', tool);
    }
    const s = d.settings || {}, patch = {};
    if (Number.isFinite(s.fontSize) && s.fontSize >= FONT_MIN && s.fontSize <= FONT_MAX) patch.fontSize = Math.round(s.fontSize);
    if (THEMES[s.theme]) patch.theme = s.theme;
    if (FONTS[s.font]) patch.font = s.font;
    if (LAYOUTS[s.layout]) patch.layout = s.layout;
    if (typeof s.std === 'boolean') patch.std = s.std;
    settings = Object.assign({}, settings, patch);
    store.set('bf.settings', settings);
    return { verses, marks, notes: notes ? notes.length : null, places: places ? places.length : null, reviews };
  }
  // 백업에서 읽은 노트를 검사해 쓸 수 있는 것만 남긴다
  function cleanNotes(list) {
    const out = [], seen = new Set();
    list.slice(0, 2000).forEach((n) => {
      if (!n || typeof n !== 'object') return;
      const bi = bible.books.findIndex((b) => b.id === n.bk);
      if (bi < 0) return;
      const nc = bible.books[bi].chapters.length;
      const int = (x, lo, hi, d) => (Number.isInteger(x) && x >= lo && x <= hi ? x : d);
      const c1 = int(n.c1, 1, nc, 1), c2 = int(n.c2, c1, nc, c1);
      const v1 = int(n.v1, 1, 200, 1), v2 = int(n.v2, 1, 200, v1);
      let id = typeof n.id === 'string' && /^[A-Za-z0-9]{1,24}$/.test(n.id) ? n.id : newId();
      while (seen.has(id)) id = newId();
      seen.add(id);
      out.push({
        id, bk: n.bk, c1, v1, c2, v2: c2 === c1 && v2 < v1 ? v1 : v2,
        title: (typeof n.title === 'string' && n.title.trim() ? n.title : '(제목 없음)').slice(0, 120),
        body: typeof n.body === 'string' ? n.body.slice(0, 50000) : '',
        date: typeof n.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.date) ? n.date : '',
        ci: int(n.ci, 0, NOTE_COLORS.length - 1, out.length % NOTE_COLORS.length),
        ts: Number.isFinite(n.ts) ? n.ts : Date.now(),
      });
    });
    return out;
  }

  function showBackup() {
    sheetTitle.textContent = '데이터 백업';
    backBtn.hidden = false;
    sheetBack = () => { showAdvanced(); sheetBody.scrollTop = 0; };
    const n = Object.keys(anns).length;
    sheetBody.innerHTML =
      '<p class="note tight">하이라이트·설교노트·모임 장소·리뷰·읽던 위치·글꼴 설정은 <b>이 기기의 이 앱 안</b>에만 저장됩니다. ' +
      '앱 주소를 옮기거나 앱을 지우면 사라지므로, 그 전에 아래에서 백업해 두세요.</p>' +
      '<div class="adv-head">내보내기 <small class="sub">(표시한 구절 ' + n + '개 · 설교노트 ' + notesDB.items.length + '개 · 모임 장소 ' + mpDB.items.length + '곳 · 리뷰 ' + rvDB.items.length + '개)</small></div>' +
      '<p class="adv-desc">버튼을 눌러 복사한 뒤 메모 앱이나 카카오톡 「나에게」 같은 곳에 붙여 두세요.</p>' +
      '<textarea id="bk-out" class="bk-text" rows="4" readonly aria-label="백업 내용"></textarea>' +
      '<div class="row"><span id="bk-out-msg" class="sub">&nbsp;</span><button class="seg-btn" id="bk-copy" type="button">백업 내용 복사</button></div>' +
      '<div class="adv-head">불러오기</div>' +
      '<p class="adv-desc">복사해 둔 백업 내용을 아래 상자에 붙여 넣으세요. <b>지금 있는 표시·설교노트·모임 장소·리뷰는 모두 백업 내용으로 바뀝니다.</b></p>' +
      '<textarea id="bk-in" class="bk-text" rows="4" placeholder="여기에 붙여 넣기" aria-label="불러올 백업 내용"></textarea>' +
      '<div class="row"><span id="bk-in-msg" class="sub">&nbsp;</span><button class="seg-btn" id="bk-apply" type="button">불러오기</button></div>';
    const out = $('#bk-out'), inp = $('#bk-in'), outMsg = $('#bk-out-msg'), inMsg = $('#bk-in-msg');
    out.value = backupText();
    $('#bk-copy').addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(out.value); ok = true; } catch (e) {
        try { out.focus(); out.select(); out.setSelectionRange(0, out.value.length); ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      }
      outMsg.textContent = ok ? '복사했습니다. 붙여 둘 곳에 붙여 넣으세요.' : '복사가 안 됐습니다. 위 상자를 길게 눌러 전체 선택 → 복사하세요.';
    });
    let armed = 0, armTimer = null;
    const apply = $('#bk-apply');
    apply.addEventListener('click', () => {
      if (!inp.value.trim()) { inMsg.textContent = '붙여 넣은 내용이 없습니다.'; return; }
      if (!armed) {
        armed = 1; apply.textContent = '한 번 더 누르면 적용';
        clearTimeout(armTimer);
        armTimer = setTimeout(() => { armed = 0; apply.textContent = '불러오기'; }, 5000);
        return;
      }
      clearTimeout(armTimer); armed = 0; apply.textContent = '불러오기';
      try {
        const r = applyBackup(inp.value);
        closeSheet();
        rebuild(pos);
        showToastLine('불러왔습니다 · ' + r.verses + '구절, 표시 ' + r.marks + '개' + (r.notes === null ? '' : ', 설교노트 ' + r.notes + '개') + (r.places === null ? '' : ', 모임 장소 ' + r.places + '곳') + (r.reviews ? ', 리뷰 ' + r.reviews + '개' : ''));
      } catch (err) {
        inMsg.textContent = err.message || '불러오지 못했습니다.';
      }
    });
  }

  // ---------- 하이라이트·표시 모아 보기 ----------
  function showHighlights() {
    clearSelection();
    sheetTitle.textContent = '하이라이트·표시';
    setSheetAct(null);
    backBtn.hidden = true;
    sheetBack = null;
    const idx = {};
    bible.books.forEach((b, i) => { idx[b.id] = i; });
    const items = Object.keys(anns).map((key) => {
      const [id, c, n] = key.split('.');
      return { key, id, b: idx[id], c: +c - 1, n: +n };
    }).filter((x) => x.b !== undefined && bible.books[x.b].chapters[x.c] && verseText(x.b, x.c, x.n))
      .sort((a, b) => a.b - b.b || a.c - b.c || a.n - b.n);
    if (!items.length) {
      sheetBody.innerHTML = '<p class="note">아직 표시한 본문이 없습니다.<br>' +
        '본문의 낱말을 <b>길게 누르고</b>(누른 채 끌면 범위가 넓어집니다) 또는 화면 <b>가운데를 눌러</b> 고른 뒤, ' +
        '아래에 뜨는 도구 상자에서 형광·동그라미·네모·물결·밑줄과 색을 고르세요.</p>';
      return;
    }
    const CHUNK = 30;   // 많으면 한꺼번에 그리지 않고 나누어 보여 준다
    let shown = 0;
    sheetBody.innerHTML = '<div class="res-head">' + items.length + '개 구절</div><div id="hl-list"></div>' +
      '<div id="hl-more"></div><p class="note">✕는 그 구절의 표시를 모두 지웁니다. 낱말 하나만 지우려면 본문에서 그 낱말을 골라 <b>지우기</b>를 누르세요.</p>';
    const list = $('#hl-list'), more = $('#hl-more');
    function addRows() {
      const part = items.slice(shown, shown + CHUNK);
      shown += part.length;
      list.insertAdjacentHTML('beforeend', part.map((x) =>
        '<div class="hrow"><button class="res" data-b="' + x.b + '" data-c="' + x.c + '" data-n="' + x.n + '">' +
        '<span class="ref">' + esc(refLabel(x.b, x.c, x.n)) + '</span>' +
        '<span class="snip">' + annotate(x.id, x.c * 1000 + x.n, 0, verseText(x.b, x.c, x.n)) + '</span></button>' +
        '<button class="hdel" data-key="' + x.key + '" aria-label="이 구절의 표시 모두 지우기">✕</button></div>').join(''));
      more.innerHTML = shown < items.length ? '<button class="res more" type="button">더 보기 (' + (items.length - shown) + '개 남음)</button>' : '';
    }
    addRows();
    sheetBody.querySelector('#hl-more').addEventListener('click', (e) => { if (e.target.closest('.more')) addRows(); });
    list.addEventListener('click', (e) => {
      const del = e.target.closest('.hdel');
      if (del) {
        const [id, c, n] = del.dataset.key.split('.');
        delete anns[del.dataset.key];
        saveAnns();
        paintVerse(id, (+c - 1) * 1000 + (+n));
        const keep = sheetBody.scrollTop;
        showHighlights();
        sheetBody.scrollTop = keep;
        return;
      }
      const b = e.target.closest('.res');
      if (b) { closeSheet(); jumpTo({ book: +b.dataset.b, chapter: +b.dataset.c, verse: +b.dataset.n }); }
    });
  }

  // ---------- 설교노트 ----------
  // 노트마다 제목 · 설교 본문(한 책 안의 시작~끝 구절) · 내용 · 날짜를 적는다.
  // 본문 옆 여백에는 노트 색 띠(바깥쪽 여백)가 그려지고, 펼친 화면에서는 왼쪽 바깥 여백에 누르면 열리는 노트 표가 놓인다.
  const saveNotes = () => store.set('bf.notes', notesDB);
  const noteById = (id) => notesDB.items.find((n) => n.id === id);
  const noteColor = (id) => { const n = noteById(id); return NOTE_COLORS[(n && Number.isInteger(n.ci) ? n.ci : 0) % NOTE_COLORS.length]; };
  function pickColor() {   // 아직 가장 적게 쓴 색을 고른다
    const used = NOTE_COLORS.map(() => 0);
    notesDB.items.forEach((n) => { if (Number.isInteger(n.ci)) used[n.ci % NOTE_COLORS.length]++; });
    return used.indexOf(Math.min.apply(null, used));
  }
  const pad2 = (x) => (x < 10 ? '0' : '') + x;
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  const dateLabel = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s.replace(/-/g, '.') : '');
  function passageLabel(n) {
    const bi = bookIdx(n.bk);
    if (bi < 0) return '';
    const name = bible.books[bi].name;
    if (n.c1 === n.c2) return name + ' ' + n.c1 + ':' + (n.v1 === n.v2 ? n.v1 : n.v1 + '–' + n.v2);
    return name + ' ' + n.c1 + ':' + n.v1 + '–' + n.c2 + ':' + n.v2;
  }

  // 책 → (절 표식 → 그 절을 덮는 노트 id들). 노트가 바뀔 때마다 다시 만든다.
  let noteIdx = null;
  function buildNoteIdx() {
    noteIdx = {};
    notesDB.items.forEach((n) => {
      const bi = bookIdx(n.bk);
      if (bi < 0) return;
      const book = bible.books[bi];
      for (let c = n.c1; c <= n.c2; c++) {
        const vs = book.chapters[c - 1];
        if (!vs) continue;
        vs.forEach((v) => {
          if ((c > n.c1 || v.n >= n.v1) && (c < n.c2 || v.n <= n.v2)) {
            const m = noteIdx[n.bk] || (noteIdx[n.bk] = {});
            const k = (c - 1) * 1000 + v.n;
            (m[k] || (m[k] = [])).push(n.id);
          }
        });
      }
    });
  }
  function noteIdsAt(bookId, k) {
    if (!noteIdx) buildNoteIdx();
    const m = noteIdx[bookId];
    return (m && m[k]) || null;
  }
  const noteStyle = (ids) => '--n1:' + noteColor(ids[0]) + (ids[1] ? ';--n2:' + noteColor(ids[1]) : '');
  function noteAttrs(bookId, k) {   // 문단(<p>)에 붙일 속성 문자열
    const ids = noteIdsAt(bookId, k);
    return ids ? ' class="nt" data-n="' + ids.join(' ') + '" style="' + noteStyle(ids) + '"' : '';
  }
  function noteChipsHTML(bookId, c0) {   // 접힌 화면: 이 장을 덮는 노트들의 칩
    return notesDB.items.filter((n) => n.bk === bookId && n.c1 <= c0 + 1 && n.c2 >= c0 + 1)
      .sort((a, b) => a.ts - b.ts)
      .map((n) => '<button type="button" class="nt-chip" data-note="' + n.id + '" style="--n1:' + noteColor(n.id) + '"><i></i><span>' + esc(n.title) + '</span></button>').join('');
  }

  // 화면에 이미 그려진 문단·칩에 노트 표시를 다시 입힌다 (저장·삭제·불러오기 뒤). 쪽 나누기는 건드리지 않는다.
  function applyNoteMarks() {
    noteIdx = null;
    if (!pg || !bible || !bible.books[pg.bookIndex]) return;
    const bid = bible.books[pg.bookIndex].id;
    stage.querySelectorAll('p[data-k], p[data-s]').forEach((p) => {
      const ids = noteIdsAt(bid, +(p.dataset.k || p.dataset.s));
      if (ids) {
        p.classList.add('nt');
        p.dataset.n = ids.join(' ');
        p.style.setProperty('--n1', noteColor(ids[0]));
        if (ids[1]) p.style.setProperty('--n2', noteColor(ids[1])); else p.style.removeProperty('--n2');
      } else if (p.classList.contains('nt')) {
        p.classList.remove('nt');
        delete p.dataset.n;
        p.style.removeProperty('--n1');
        p.style.removeProperty('--n2');
      }
    });
    if (scroller) {
      [...scroller.children].forEach((pane, c) => {
        const box = pane.querySelector('.nt-chips');
        if (box) box.innerHTML = noteChipsHTML(bid, c);
      });
    }
    refreshTabs();
  }

  // 펼친 화면의 왼쪽 바깥 여백: 지금 보이는 두 쪽에 있는 노트마다 표 하나. 그 노트 본문이 가장 위에 나오는 줄 높이에 놓는다.
  const tabsEl = $('#note-tabs');
  function hideTabs() { clearTimeout(tabsTimer); closeSpot(); tabsEl.classList.add('moving'); }
  let tabsTimer = 0;
  function refreshTabs(tries) {
    clearTimeout(tabsTimer);
    closeSpot();
    tabsEl.innerHTML = '';
    tabsEl.classList.remove('moving');
    if (!bible || !pg || scroller || !flip || !pg.g || !pg.g.spread) return;
    // 노트 탭은 그 노트 본문이 처음 나오는 쪽 가장자리에 붙는다: 왼쪽 쪽의 노트는 화면 왼쪽, 오른쪽 쪽의 노트는 화면 오른쪽 (v67)
    // 왼쪽: 탭의 오른쪽 끝이 책 왼쪽 가장자리(앱 펼침은 본문 왼쪽 끝 10px 앞)에 닿는다. 오른쪽: 탭의 왼쪽 끝이 책 오른쪽 가장자리(본문 오른쪽 끝 10px 뒤)에 닿는다.
    const full = !!pg.g.full;
    const edgeL = pg.g.tabEdge != null ? pg.g.tabEdge : pg.g.shiftX;
    const edgeR = full ? edgeL : Math.max(0, window.innerWidth - (pg.g.shiftX + pg.g.bookW));
    const twL = Math.min(23, full ? edgeL - 10 : edgeL - 2);   // 앱 펼침은 탭이 화면 끝에서 10px 떨어진다(v66: 끝에 붙이면 답답해 보임)
    const twR = Math.min(23, full ? edgeR - 10 : edgeR - 2);
    const okL = twL >= 16, okR = twR >= 16;   // 여백이 너무 좁은 쪽은 탭을 생략한다(그 쪽 노트는 반대쪽에 붙이고, 양쪽 다 좁으면 본문의 절 번호 배지만 보인다)
    if (!okL && !okR) return;
    // 지금 펼쳐진 두 쪽(왼쪽 L, 오른쪽 L+1)만 읽는 순서대로 본다. 그 노트 본문이 처음 나오는 줄의 높이와 쪽을 잡는다.
    const W = window.innerWidth, top = {}, where = {};
    const L = flip.getCurrentPageIndex(), all = stage.querySelectorAll('.page');
    const want = [all[L], all[L + 1]].filter(Boolean);
    const shown = want.map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width >= 10 && x.r.right > 1 && x.r.left < W - 1);
    // 쪽이 아직 자리를 잡기 전이면 잠시 뒤 다시 시도한다 (책을 막 만든 직후·책장이 막 넘어간 직후·느린 기기)
    if (shown.length < want.length && (tries || 0) < 8) { tabsTimer = setTimeout(() => refreshTabs((tries || 0) + 1), 150); return; }
    shown.forEach((x) => {
      const side = x.r.left + x.r.width / 2 < W / 2 ? 'L' : 'R';
      x.el.querySelectorAll('p.nt').forEach((p) => {
        const y = p.getBoundingClientRect().top;
        (p.dataset.n || '').split(' ').forEach((id) => { if (id && !(id in top)) { top[id] = y; where[id] = side; } });
      });
    });
    const items = Object.keys(top).filter((id) => noteById(id)).map((id) => {
      const n = noteById(id);
      const label = Array.from(n.title.replace(/\s+/g, '')).slice(0, 6).join('');   // 제목 앞 6글자 (v64: 5 → 6)
      const side = where[id] === 'R' ? (okR ? 'R' : 'L') : (okL ? 'L' : 'R');
      return { id, y0: top[id], label, title: n.title, side, h: Math.round(Array.from(label).length * 12.5 + 24) };   // 글자 위아래 여유 12px(v65, 전 9px)
    }).sort((p, q) => p.y0 - q.y0);
    // 겹치지 않게 위에서부터 쌓고, 아래로 넘치면 위로 당긴다. 그래도 안 들어가면 나머지는 "+N" 하나로 줄인다. (왼쪽·오른쪽을 따로 쌓는다)
    // 오른쪽 탭은 듀오 오른쪽 위의 상태 알약(시계·배터리) 아래에서만 놓는다.
    const botLim = window.innerHeight - 10, gap = 5;
    const stack = (list, topLim) => {
      let y = -1e9;
      list.forEach((it) => { it.y = Math.max(it.y0, y, topLim); y = it.y + it.h + gap; });
      let lim = botLim;
      for (let i = list.length - 1; i >= 0; i--) { list[i].y = Math.min(list[i].y, lim - list[i].h); lim = list[i].y - gap; }
      return !list.length || list[0].y >= topLim;
    };
    const layout = (all2, side) => {
      const topLim = side === 'R' && pg.g.intoPill ? Math.max(60, NATIVE_PILL_BOTTOM + 4) : 60;
      let list = all2;
      for (let keep = all2.length; keep >= 0; keep--) {
        list = all2.slice(0, keep).map((it) => Object.assign({}, it, { side }));
        if (keep < all2.length) list.push({ more: all2.length - keep, label: '+' + (all2.length - keep), title: '설교노트 목록', y0: botLim, h: 34, side });
        if (stack(list, topLim)) break;
      }
      return list;
    };
    const list = layout(items.filter((it) => it.side === 'L'), 'L').concat(layout(items.filter((it) => it.side === 'R'), 'R'));
    tabsEl.innerHTML = list.map((it) => {
      const right = it.side === 'R', tw = right ? twR : twL, left = right ? W - edgeR : edgeL - tw;   // 왼쪽 탭은 오른쪽 끝이, 오른쪽 탭은 왼쪽 끝이 책 가장자리에 닿는다
      return '<button type="button" class="nt-tab' + (right ? ' nt-r' : '') + '" ' + (it.more ? 'data-more="1"' : 'data-note="' + it.id + '"') +
        ' aria-label="' + (it.more ? '설교노트 더 보기: ' : '설교노트: ') + esc(it.title).replace(/"/g, '&quot;') + '" ' +
        'style="--n1:' + (it.more ? '#7A7A7A' : noteColor(it.id)) + ';left:' + left + 'px;top:' + Math.round(it.y) + 'px;width:' + tw + 'px;height:' + it.h + 'px">' +
        '<b>' + esc(it.label) + '</b></button>';
    }).join('');
  }
  tabsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.nt-tab');
    if (!b) return;
    if (b.dataset.more) { closeSpot(); showNotes(); openSheet(true); return; }   // "+N" 탭은 노트 목록
    if (spot.id === b.dataset.note) { closeSpot(); return; }                       // 같은 탭을 한 번 더 누르면 닫기
    openSpot(b.dataset.note);
  });

  // ---------- 탭을 누르면: 그 노트의 본문만 밝게 남기고(스포트라이트), 아래에 노트 미리보기 카드가 뜬다 ----------
  // 흐리게 하는 것은 글자의 투명도뿐이라 쪽 나누기·글자 위치에는 영향이 없다.
  const spot = { id: null };
  let spotStyleEl = null, peekEl = null;
  function closeSpot() {
    if (!spot.id) return;
    spot.id = null;
    stage.classList.remove('spot');
    tabsEl.classList.remove('spot');
    tabsEl.querySelectorAll('.nt-tab.sel').forEach((t) => t.classList.remove('sel'));
    if (spotStyleEl) spotStyleEl.textContent = '';
    if (peekEl) peekEl.hidden = true;
  }
  function buildPeek() {
    peekEl = document.createElement('div');
    peekEl.id = 'note-peek';
    peekEl.hidden = true;
    peekEl.setAttribute('role', 'dialog');
    peekEl.setAttribute('aria-label', '설교노트 미리보기');
    peekEl.innerHTML = '<div class="pk-head"><b class="pk-title"></b><span class="pk-ref"></span></div>' +
      '<div class="pk-body"></div>' +
      '<div class="pk-act"><button type="button" class="pk-open">노트 열기 ›</button><button type="button" class="pk-fold">본문만 보기</button><span class="pk-hint">바깥을 누르면 닫힘</span></div>';
    document.body.appendChild(peekEl);
    peekEl.querySelector('.pk-open').addEventListener('click', () => {
      const id = spot.id;
      closeSpot();
      if (id && noteById(id)) { showNoteView(id); openSheet(true); }
    });
    peekEl.querySelector('.pk-fold').addEventListener('click', () => { peekEl.hidden = true; });   // 스포트라이트는 그대로, 카드만 접는다
  }
  function openSpot(id) {
    const n = noteById(id);
    if (!n || scroller || !flip) return;
    if (!spotStyleEl) { spotStyleEl = document.createElement('style'); document.head.appendChild(spotStyleEl); }
    if (!peekEl) buildPeek();
    spot.id = id;
    const sid = id.replace(/[^\w-]/g, '');
    spotStyleEl.textContent = '#stage.spot p[data-n~="' + sid + '"][data-k], #stage.spot p[data-n~="' + sid + '"][data-s] { opacity: 1; }';
    stage.classList.add('spot');
    tabsEl.classList.add('spot');
    tabsEl.querySelectorAll('.nt-tab').forEach((t) => t.classList.toggle('sel', t.dataset.note === id));
    peekEl.style.setProperty('--n1', noteColor(id));
    peekEl.querySelector('.pk-title').textContent = n.title;
    peekEl.querySelector('.pk-ref').textContent = [passageLabel(n), dateLabel(n.date)].filter(Boolean).join(' · ');
    const body = peekEl.querySelector('.pk-body'), txt = (n.body || '').trim();
    body.textContent = txt || '아직 적은 내용이 없습니다.';
    body.classList.toggle('empty', !txt);
    placePeek(id);
  }
  // 카드는 밝게 남은 본문을 가리지 않는 쪽(오른쪽 쪽 아래 → 왼쪽 쪽 아래 → 가운데 아래)에 놓는다.
  function placePeek(id) {
    const W = window.innerWidth, H = window.innerHeight;
    const L = flip.getCurrentPageIndex(), all = stage.querySelectorAll('.page');
    const els = [all[L], all[L + 1]].filter(Boolean);
    const rects = [], pages = [];
    els.forEach((el) => {
      const pr = el.getBoundingClientRect();
      if (pr.width < 10 || pr.right <= 1 || pr.left >= W - 1) return;
      pages.push(pr);
      el.querySelectorAll('p.nt').forEach((p) => {
        if ((p.dataset.n || '').split(' ').indexOf(id) < 0) return;
        rects.push(p.getBoundingClientRect());
      });
    });
    const cw = Math.min(400, W - 24);
    peekEl.style.width = cw + 'px';
    peekEl.hidden = false;
    const pr0 = peekEl.getBoundingClientRect(), h = pr0.height, top = pr0.top;
    const clampX = (x) => Math.round(Math.min(Math.max(x, 8), W - cw - 8));
    const cands = pages.slice().reverse().map((pr) => clampX(pr.left + (pr.width - cw) / 2));
    cands.push(clampX((W - cw) / 2));
    let best = cands[0], bestScore = Infinity;
    cands.forEach((x) => {
      let s = 0;
      rects.forEach((r) => {
        const ox = Math.min(x + cw, r.right) - Math.max(x, r.left), oy = Math.min(top + h, r.bottom) - Math.max(top, r.top);
        if (ox > 0 && oy > 0) s += ox * oy;
      });
      if (s < bestScore) { bestScore = s; best = x; }
    });
    peekEl.style.left = best + 'px';
  }

  // --- 작성 중인 내용은 입력할 때마다 기기에 임시 저장한다 (설교를 들으며 쓰다가 앱이 닫혀도 남도록) ---
  function loadDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem('bf.notedraft')); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return null;
    if (d.id && !noteById(d.id)) d.id = null;   // 원래 노트가 지워졌으면 새 노트 초안으로 본다
    return d;
  }
  const saveDraft = (d) => { try { localStorage.setItem('bf.notedraft', JSON.stringify(d)); } catch (e) { /* 무시 */ } };
  const clearDraft = () => { try { localStorage.removeItem('bf.notedraft'); } catch (e) { /* 무시 */ } };

  // --- 본문 입력 도우미 ---
  function bookByName(name) {
    if (Object.prototype.hasOwnProperty.call(ABBR, name)) return ABBR[name];
    let i = bible.books.findIndex((b) => b.name === name);
    if (i < 0 && name.length >= 2) i = bible.books.findIndex((b) => b.name.startsWith(name));
    return i;
  }
  // "요 3:16-21", "요한복음 3장 16-21절", "창 1:1-2:3", "시 23", "롬 8-9" 같은 글을 본문 범위로 읽는다. 읽을 수 없으면 null.
  function parseRange(q) {
    const m = String(q).trim().match(/^([가-힣]+)\s*(\d+)\s*(?:장|편|[:：.])?\s*(?:(\d+)\s*절?)?\s*(?:[-~–—]\s*(?:(\d+)\s*(?:장|편|[:：.])\s*)?(\d+)\s*절?)?$/);
    if (!m) return null;
    const bi = bookByName(m[1]);
    if (bi < 0) return null;
    const book = bible.books[bi], last = (c) => book.chapters[c - 1][book.chapters[c - 1].length - 1].n;
    const has = (c, v) => !!book.chapters[c - 1] && book.chapters[c - 1].some((x) => x.n === v);
    const c1 = +m[2];
    if (c1 < 1 || c1 > book.chapters.length) return null;
    let v1, c2, v2;
    if (m[3] === undefined) {   // 장 전체(또는 장 범위)
      c2 = m[5] !== undefined ? +m[5] : c1;
      if (c2 < c1 || c2 > book.chapters.length) return null;
      v1 = 1; v2 = last(c2);
    } else {
      v1 = +m[3];
      if (m[5] === undefined) { c2 = c1; v2 = v1; } else if (m[4] !== undefined) { c2 = +m[4]; v2 = +m[5]; } else { c2 = c1; v2 = +m[5]; }
    }
    if (c2 < c1 || (c2 === c1 && v2 < v1) || !has(c1, v1) || !has(c2, v2)) return null;
    return { bi, c1, v1, c2, v2 };
  }
  const verseNums = (bi, c) => (bible.books[bi].chapters[c - 1] || []).map((v) => v.n);
  function nearVerse(list, v) {
    if (!list.length) return 1;
    if (list.indexOf(v) >= 0) return v;
    return list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  }
  // 현재 읽는 곳을 본문 범위(한 절)로
  function hereRange() {
    const bi = Math.min(Math.max(pos.book, 0), bible.books.length - 1), c = Math.min(Math.max(pos.chapter + 1, 1), bible.books[bi].chapters.length);
    const v = nearVerse(verseNums(bi, c), pos.verse > 0 ? pos.verse : 1);
    return { bi, c1: c, v1: v, c2: c, v2: v };
  }

  // --- 노트 목록 (메뉴의 노트 아이콘) ---
  function showNotes() {
    clearSelection();
    sheetTitle.textContent = '설교노트';
    backBtn.hidden = true;
    sheetBack = null;
    setSheetAct(() => showNoteEditor(null), '설교노트 쓰기');
    const items = notesDB.items.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.ts - a.ts);
    const draft = loadDraft();
    let html = '';
    if (draft && (draft.title || draft.body || draft.id)) {
      html += '<div class="nt-draft"><span>작성 중: <b>' + esc(draft.title || '(제목 없음)') + '</b></span>' +
        '<button type="button" id="nt-resume">이어 쓰기</button><button type="button" id="nt-drop" class="warn">버리기</button></div>';
    }
    if (!items.length) {
      html += '<p class="note">아직 작성한 설교노트가 없습니다.<br>오른쪽 위 <b>연필 ✎</b>을 눌러 <b>제목 → 설교 본문 → 노트 내용</b> 순서로 쓰세요. ' +
        '작성을 마치면 그 본문 옆 여백에 노트 표시가 생깁니다.</p>';
    } else {
      html += '<div class="res-head">' + items.length + '개 노트</div>' + items.map((n) => {
        const snip = (n.body || '').split('\n').map((s) => s.trim()).find((s) => s) || '';
        return '<button type="button" class="nt-row" data-id="' + n.id + '" style="--n1:' + noteColor(n.id) + '"><b>' + esc(n.title) + '</b>' +
          '<span class="nt-meta"><em>' + esc(passageLabel(n)) + '</em>' + (n.date ? ' · ' + dateLabel(n.date) : '') + '</span>' +
          (snip ? '<span class="nt-snip">' + esc(snip) + '</span>' : '') + '</button>';
      }).join('');
    }
    sheetBody.innerHTML = html;
    sheetBody.querySelectorAll('.nt-row').forEach((b) => b.addEventListener('click', () => { showNoteView(b.dataset.id); sheetBody.scrollTop = 0; }));
    const rs = $('#nt-resume'), dr = $('#nt-drop');
    if (rs) rs.addEventListener('click', () => showNoteEditor(draft.id || null));
    if (dr) dr.addEventListener('click', () => { clearDraft(); showNotes(); });
  }

  // --- 노트 보기 ---
  function showNoteView(id) {
    const n = noteById(id);
    if (!n) { showNotes(); return; }
    clearSelection();
    sheetTitle.textContent = '설교노트';
    backBtn.hidden = false;
    sheetBack = () => { showNotes(); sheetBody.scrollTop = 0; };
    setSheetAct(() => showNoteEditor(id), '노트 수정');
    const bi = bookIdx(n.bk);
    let verses = '';
    if (bi >= 0) {
      for (let c = n.c1; c <= n.c2; c++) {
        (bible.books[bi].chapters[c - 1] || []).forEach((v) => {
          if ((c > n.c1 || v.n >= n.v1) && (c < n.c2 || v.n <= n.v2)) {
            verses += '<sup>' + (n.c1 !== n.c2 && (v.n === 1 || (c === n.c1 && v.n === n.v1)) ? c + ':' : '') + v.n + '</sup>' + esc(v.t) + ' ';
          }
        });
      }
    }
    sheetBody.innerHTML =
      '<div class="nv-title" style="border-left:4px solid ' + noteColor(id) + ';padding-left:10px">' + esc(n.title) + '</div>' +
      '<div class="nv-meta"><b>' + esc(passageLabel(n)) + '</b>' + (n.date ? ' · ' + dateLabel(n.date) : '') + '</div>' +
      '<div class="nt-actions"><button type="button" class="nt-btn primary" id="nv-go">이 본문으로 이동</button></div>' +
      (verses ? '<details class="nv-pass"><summary>본문 보기</summary><div class="nv-verses">' + verses + '</div></details>' : '') +
      (n.body ? '<div class="nv-body">' + esc(n.body) + '</div>' : '<div class="nv-body empty">적어 둔 내용이 없습니다. 오른쪽 위 연필로 내용을 더할 수 있습니다.</div>') +
      '<div class="nt-actions"><button type="button" class="nt-btn" id="nv-edit">수정</button><button type="button" class="nt-btn warn" id="nv-del">삭제</button></div>';
    $('#nv-go').addEventListener('click', () => { closeSheet(); jumpTo({ book: bi, chapter: n.c1 - 1, verse: n.v1 }); });
    $('#nv-edit').addEventListener('click', () => showNoteEditor(id));
    const del = $('#nv-del');
    let armed = 0, armTimer = null;
    del.addEventListener('click', () => {
      if (!armed) {
        armed = 1; del.textContent = '한 번 더 누르면 삭제'; del.classList.add('armed');
        clearTimeout(armTimer);
        armTimer = setTimeout(() => { armed = 0; del.textContent = '삭제'; del.classList.remove('armed'); }, 4000);
        return;
      }
      clearTimeout(armTimer);
      notesDB.items = notesDB.items.filter((x) => x.id !== id);
      saveNotes();
      const d = loadDraft();
      if (d && d.id === id) clearDraft();
      applyNoteMarks();
      showNotes();
      showToastLine('설교노트를 삭제했습니다.');
    });
  }

  // --- 노트 쓰기·고치기: 제목 → 설교 본문(책·시작·끝을 고르는 선택칸) → 노트 내용 ---
  function showNoteEditor(id) {
    clearSelection();
    const note = id ? noteById(id) : null;
    const draft = loadDraft();
    const useDraft = !!draft && (draft.id || null) === (note ? note.id : null) && (draft.title || draft.body || draft.id || Number.isInteger(draft.bi));
    let f = note ? { bi: bookIdx(note.bk), c1: note.c1, v1: note.v1, c2: note.c2, v2: note.v2 } : hereRange();
    let title = note ? note.title : '', body = note ? note.body || '' : '', date = note ? note.date || todayStr() : todayStr();
    if (useDraft) {
      title = String(draft.title || ''); body = String(draft.body || ''); date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date || '') ? draft.date : date;
      if (Number.isInteger(draft.bi) && draft.bi >= 0 && draft.bi < bible.books.length) {
        const nc = bible.books[draft.bi].chapters.length;
        if (draft.c1 >= 1 && draft.c2 <= nc && draft.c1 <= draft.c2) f = { bi: draft.bi, c1: draft.c1, v1: draft.v1, c2: draft.c2, v2: draft.v2 };
      }
    }
    if (f.bi < 0) f = hereRange();
    f.v1 = nearVerse(verseNums(f.bi, f.c1), f.v1);
    f.v2 = nearVerse(verseNums(f.bi, f.c2), f.v2);

    sheetTitle.textContent = note ? '노트 수정' : '노트 쓰기';
    backBtn.hidden = false;
    sheetBack = () => { if (note) showNoteView(note.id); else showNotes(); sheetBody.scrollTop = 0; };   // 쓰던 내용은 임시 저장되어 남는다
    setSheetAct(null);
    const bkOpts = '<optgroup label="구약">' + bible.books.slice(0, 39).map((b, i) => '<option value="' + i + '">' + esc(b.name) + '</option>').join('') + '</optgroup>' +
      '<optgroup label="신약">' + bible.books.slice(39).map((b, i) => '<option value="' + (i + 39) + '">' + esc(b.name) + '</option>').join('') + '</optgroup>';
    sheetBody.innerHTML =
      '<div class="nt-lab">제목</div>' +
      '<input id="nt-title" class="nt-in" type="text" maxlength="120" placeholder="설교 제목" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '<div class="nt-lab">설교 본문 <small>책 · 시작 · 끝을 고르세요</small></div>' +
      '<input id="nt-quick" class="nt-in quick" type="text" enterkeyhint="done" placeholder="바로 입력 (예: 요 3:16-21)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
      '<div class="nt-sel-row"><span class="nt-k">책</span><select id="nt-bk" class="nt-sel wide" aria-label="책">' + bkOpts + '</select>' +
      '<button type="button" class="seg-btn" id="nt-here">지금 읽는 곳</button></div>' +
      '<div class="nt-sel-row"><span class="nt-k">시작</span><select id="nt-c1" class="nt-sel" aria-label="시작 장"></select><span class="u u1">장</span>' +
      '<select id="nt-v1" class="nt-sel" aria-label="시작 절"></select><span class="u">절</span></div>' +
      '<div class="nt-sel-row"><span class="nt-k">끝</span><select id="nt-c2" class="nt-sel" aria-label="끝 장"></select><span class="u u1">장</span>' +
      '<select id="nt-v2" class="nt-sel" aria-label="끝 절"></select><span class="u">절</span></div>' +
      '<div id="nt-ref" class="nt-ref"></div>' +
      '<div class="nt-lab">노트 내용</div>' +
      '<textarea id="nt-body" class="nt-text" rows="8" placeholder="설교 내용, 묵상, 적용 …" spellcheck="false"></textarea>' +
      '<div class="nt-lab">설교 날짜</div>' +
      '<input id="nt-date" class="nt-in" type="date">' +
      '<div class="nt-actions"><button type="button" class="nt-btn primary" id="nt-save">작성 완료</button></div>';

    const el = { title: $('#nt-title'), quick: $('#nt-quick'), bk: $('#nt-bk'), c1: $('#nt-c1'), v1: $('#nt-v1'), c2: $('#nt-c2'), v2: $('#nt-v2'), ref: $('#nt-ref'), body: $('#nt-body'), date: $('#nt-date') };
    el.title.value = title; el.body.value = body; el.date.value = date;
    const opts = (list) => list.map((x) => '<option value="' + x + '">' + x + '</option>').join('');
    const grow = () => { el.body.style.height = 'auto'; el.body.style.height = Math.max(190, el.body.scrollHeight + 2) + 'px'; };
    const bad = () => f.c2 < f.c1 || (f.c2 === f.c1 && f.v2 < f.v1);
    function persist() {
      saveDraft({ id: note ? note.id : null, title: el.title.value, body: el.body.value, date: el.date.value, bi: f.bi, c1: f.c1, v1: f.v1, c2: f.c2, v2: f.v2 });
    }
    function sync() {
      const book = bible.books[f.bi];
      if (el.c1.dataset.bi !== String(f.bi)) {
        const ch = opts(book.chapters.map((_, i) => i + 1));
        el.c1.innerHTML = ch; el.c2.innerHTML = ch; el.c1.dataset.bi = String(f.bi);
      }
      el.bk.value = String(f.bi);
      el.c1.value = String(f.c1); el.c2.value = String(f.c2);
      el.v1.innerHTML = opts(verseNums(f.bi, f.c1)); el.v1.value = String(f.v1);
      el.v2.innerHTML = opts(verseNums(f.bi, f.c2)); el.v2.value = String(f.v2);
      sheetBody.querySelectorAll('.u1').forEach((u) => { u.textContent = book.id === 'psa' ? '편' : '장'; });
      el.ref.classList.remove('bad');
      el.ref.textContent = passageLabel({ bk: book.id, c1: f.c1, v1: f.v1, c2: f.c2, v2: f.v2 });
    }
    el.bk.addEventListener('change', () => { f = { bi: +el.bk.value, c1: 1, v1: 1, c2: 1, v2: 1 }; f.v1 = f.v2 = verseNums(f.bi, 1)[0] || 1; sync(); persist(); });
    el.c1.addEventListener('change', () => {
      f.c1 = +el.c1.value; f.v1 = verseNums(f.bi, f.c1)[0] || 1;
      if (bad()) { f.c2 = f.c1; f.v2 = f.v1; } else f.v2 = nearVerse(verseNums(f.bi, f.c2), f.v2);
      sync(); persist();
    });
    el.v1.addEventListener('change', () => { f.v1 = +el.v1.value; if (bad()) { f.c2 = f.c1; f.v2 = f.v1; } sync(); persist(); });
    el.c2.addEventListener('change', () => {
      f.c2 = +el.c2.value; f.v2 = nearVerse(verseNums(f.bi, f.c2), f.v2);
      if (f.c2 < f.c1) { f.c1 = f.c2; f.v1 = verseNums(f.bi, f.c1)[0] || 1; } else if (f.c2 === f.c1 && f.v2 < f.v1) f.v2 = f.v1;
      sync(); persist();
    });
    el.v2.addEventListener('change', () => { f.v2 = +el.v2.value; if (bad()) f.v1 = f.v2; sync(); persist(); });
    $('#nt-here').addEventListener('click', () => { f = hereRange(); sync(); persist(); });
    const quick = () => {
      const q = el.quick.value.trim();
      if (!q) return;
      const r = parseRange(q);
      if (!r) { el.ref.classList.add('bad'); el.ref.textContent = '읽을 수 없는 본문입니다 (예: 요 3:16-21, 시 23, 창 1:1-2:3)'; return; }
      f = r; el.quick.value = ''; sync(); persist();
    };
    el.quick.addEventListener('change', quick);
    el.quick.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quick(); el.quick.blur(); } });
    el.title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.title.blur(); } });
    el.title.addEventListener('input', persist);
    el.date.addEventListener('change', persist);
    el.body.addEventListener('input', () => { grow(); persist(); });
    sync();
    grow();
    if (useDraft) showToastLine('작성 중이던 내용을 불러왔습니다.');

    $('#nt-save').addEventListener('click', () => {
      const t = el.title.value.trim();
      if (!t) { showToastLine('제목을 입력해 주세요.'); el.title.focus(); return; }
      const rec = {
        title: t.slice(0, 120), body: el.body.value.slice(0, 50000), date: /^\d{4}-\d{2}-\d{2}$/.test(el.date.value) ? el.date.value : todayStr(),
        bk: bible.books[f.bi].id, c1: f.c1, v1: f.v1, c2: f.c2, v2: f.v2,
      };
      if (note) Object.assign(note, rec, { ts: Date.now() });
      else notesDB.items.push(Object.assign({ id: newId(), ci: pickColor(), ts: Date.now() }, rec));
      saveNotes();
      clearDraft();
      applyNoteMarks();
      showNotes();
      sheetBody.scrollTop = 0;
      showToastLine('저장했습니다 · ' + passageLabel(rec) + ' 옆 여백에 표시됩니다');
    });
  }

  // ---------- 검색: 구절 바로가기 + 본문 검색 ----------
  // 약칭(요, 시, 고전 …) → 책 번호
  const ABBR = {
    창: 0, 출: 1, 레: 2, 민: 3, 신: 4, 수: 5, 삿: 6, 룻: 7, 삼상: 8, 삼하: 9, 왕상: 10, 왕하: 11,
    대상: 12, 대하: 13, 스: 14, 느: 15, 에: 16, 욥: 17, 시: 18, 잠: 19, 전: 20, 아: 21, 사: 22,
    렘: 23, 애: 24, 겔: 25, 단: 26, 호: 27, 욜: 28, 암: 29, 옵: 30, 욘: 31, 미: 32, 나: 33,
    합: 34, 습: 35, 학: 36, 슥: 37, 말: 38, 마: 39, 막: 40, 눅: 41, 요: 42, 행: 43, 롬: 44,
    고전: 45, 고후: 46, 갈: 47, 엡: 48, 빌: 49, 골: 50, 살전: 51, 살후: 52, 딤전: 53, 딤후: 54,
    딛: 55, 몬: 56, 히: 57, 약: 58, 벧전: 59, 벧후: 60, 요일: 61, 요이: 62, 요삼: 63, 유: 64, 계: 65,
  };
  const MAX_RESULTS = 80;
  let flat = null;   // 모든 절을 한 줄로 편 목록 (처음 검색할 때 한 번 만든다)

  function allVerses() {
    if (flat) return flat;
    flat = [];
    bible.books.forEach((b, bi) => b.chapters.forEach((vs, ci) =>
      vs.forEach((v) => flat.push({ b: bi, c: ci, n: v.n, t: v.t }))));
    return flat;
  }

  function verseText(b, c, n) {
    const hit = bible.books[b].chapters[c].find((v) => v.n === n);
    return hit ? hit.t : '';
  }

  // "요 3:16", "요한복음 3장 16절", "시편 23", "창세기" 같은 입력을 읽어 이동할 위치 후보를 돌려준다.
  function parseRef(q) {
    // 책 이름은 한글을 최대한 길게 읽는다(그래야 '시편'의 '편'이 단위로 잘못 읽히지 않는다).
    const m = q.trim().match(/^([가-힣]+)\s*(\d+)?\s*(?:장|편)?\s*(?:[:：.]|\s)?\s*(\d+)?\s*절?$/);
    if (!m) return [];
    const name = m[1];
    const chapterNo = m[2] ? parseInt(m[2], 10) : 1;
    const verseNo = m[3] ? parseInt(m[3], 10) : 1;

    const books = [];
    if (Object.prototype.hasOwnProperty.call(ABBR, name)) books.push(ABBR[name]);
    bible.books.forEach((b, i) => {
      if (b.name === name || (name.length >= 2 && b.name.startsWith(name))) books.push(i);
    });

    const out = [], seen = new Set();
    books.forEach((bi) => {
      if (seen.has(bi)) return;
      seen.add(bi);
      const book = bible.books[bi];
      const c = chapterNo - 1;
      if (c < 0 || c >= book.chapters.length) return;
      const hasVerse = book.chapters[c].some((v) => v.n === verseNo);
      out.push({ b: bi, c, n: hasVerse ? verseNo : 1, exact: hasVerse && !!m[3] });
    });
    return out;
  }

  function refLabel(b, c, n) {
    const book = bible.books[b];
    return book.name + ' ' + (c + 1) + ':' + n;
  }

  function highlightTerms(text, tokens) {
    const re = new RegExp(tokens.map((t) => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    return esc(text).replace(re, '<mark>$&</mark>');
  }

  function renderResults(q, box) {
    q = q.trim();
    if (!q) {
      box.innerHTML = '<p class="note">구절로 바로 이동하거나, 낱말로 찾아보세요.<br>' +
        '예) <b>요 3:16</b> · <b>시편 23</b> · <b>고전 13</b> · <b>사랑</b> · <b>여호와 목자</b></p>';
      return;
    }
    let html = '';

    const refs = parseRef(q);
    if (refs.length) {
      html += '<div class="res-head">이동</div>';
      refs.forEach((r) => {
        const snippet = r.exact ? esc(verseText(r.b, r.c, r.n)) : '';
        html += '<button class="res" data-b="' + r.b + '" data-c="' + r.c + '" data-n="' + r.n + '">' +
          '<span class="ref">' + esc(refLabel(r.b, r.c, r.n)) + ' 로 이동</span>' +
          (snippet ? '<span class="snip">' + snippet + '</span>' : '') + '</button>';
      });
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const hits = [];
    let total = 0;
    for (const v of allVerses()) {
      if (tokens.every((t) => v.t.includes(t))) {
        total++;
        if (hits.length < MAX_RESULTS) hits.push(v);
      }
    }
    // 구절 이동 후보가 있고 낱말 검색 결과가 없으면, 빈 검색 결과 안내는 생략한다.
    if (total || !refs.length) {
      html += '<div class="res-head">본문 검색 · ' + total + '건' +
        (total > MAX_RESULTS ? ' (앞 ' + MAX_RESULTS + '건만 표시 — 낱말을 더 넣어 좁혀 보세요)' : '') + '</div>';
    }
    if (!total && !refs.length) html += '<p class="note">일치하는 구절이 없습니다.</p>';
    hits.forEach((v) => {
      html += '<button class="res" data-b="' + v.b + '" data-c="' + v.c + '" data-n="' + v.n + '">' +
        '<span class="ref">' + esc(refLabel(v.b, v.c, v.n)) + '</span>' +
        '<span class="snip">' + highlightTerms(v.t, tokens) + '</span></button>';
    });
    box.innerHTML = html;
  }

  function showSearch() {
    sheetTitle.textContent = '검색';
    setSheetAct(null);
    backBtn.hidden = true;
    sheetBack = null;
    sheetBody.innerHTML =
      '<input id="q" class="search-input" type="search" inputmode="search" enterkeyhint="search" ' +
      'placeholder="구절(요 3:16) 또는 낱말" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
      '<div id="results"></div>';
    const input = $('#q'), box = $('#results');
    renderResults('', box);
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => renderResults(input.value, box), 160);
    });
    // 결과를 누르면 그 절로 이동
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('.res');
      if (!btn) return;
      closeSheet();
      jumpTo({ book: +btn.dataset.b, chapter: +btn.dataset.c, verse: +btn.dataset.n });
    });
    // 키보드의 '검색/이동' 키: 첫 결과로 이동
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      renderResults(input.value, box);
      const first = box.querySelector('.res');
      if (first) first.click();
    });
    return input;
  }

  // 상단 메뉴: 누른 손가락을 떼는 순간(pointerup)에 열고, 같은 터치의 click은 한 번만 처리한다.
  // (일부 기기에서 click이 빠져도 열리도록 이중으로 연결, 오류가 나면 화면에 알려 준다)
  function showError(err) {
    let t = document.getElementById('errtoast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'errtoast';
      t.style.cssText = 'position:fixed;left:12px;right:12px;bottom:60px;z-index:99;background:#7a1f1f;color:#fff;' +
        'padding:10px 12px;border-radius:10px;font-size:12px;line-height:1.4;word-break:break-all';
      t.addEventListener('click', () => t.remove());
      document.body.appendChild(t);
    }
    t.textContent = '오류: ' + (err && err.message ? err.message : err) + ' (눌러서 닫기)';
  }
  // 잠깐 떴다 사라지는 안내 (눌러서 바로 닫을 수 있다)
  // top: true → 화면 위쪽에 띄운다 (모임 장소 화면처럼 아래쪽에 단추가 있는 화면에서 알림이 단추를 가리지 않게)
  function showToastLine(msg, top) {
    let t = document.getElementById('infotoast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'infotoast';
      t.addEventListener('click', () => t.remove());
      document.body.appendChild(t);
    }
    t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' + (top ? 'top:calc(env(safe-area-inset-top) + 60px);' : 'bottom:60px;') +
      'z-index:99;width:max-content;max-width:90%;background:#222;color:#fff;padding:11px 16px;border-radius:12px;font-size:14px;line-height:1.4;text-align:center';
    t.textContent = msg;
    clearTimeout(showToastLine.timer);
    showToastLine.timer = setTimeout(() => t.remove(), 3500);
  }
  function onMenu(btn, fn) {
    let last = 0, downAt = null;
    const run = () => {
      const now = performance.now();
      if (now - last < 500) return;
      last = now;
      try { fn(); } catch (err) { showError(err); }
    };
    btn.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
    btn.addEventListener('pointerup', (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved < 12) run();
    });
    btn.addEventListener('pointercancel', () => { downAt = null; });
    btn.addEventListener('click', run);
  }
  // ---------- 바이블 포토 카드 ----------
  // 왼쪽: 구절·사진/배경·문구 입력, 오른쪽: 폴라로이드 카드 미리보기(캔버스 1080×1320).
  // 저장은 JPEG 사진 파일로 만들어 앱에서는 아이폰 공유 창(이미지 저장·메시지·카카오톡 …)으로, 웹에서는 공유/내려받기로 보낸다.
  const PC_W = 1080, PC_H = 1320;                       // 카드 크기(픽셀)
  const PC_PX = 60, PC_PY = 60, PC_PS = 960;            // 사진(배경) 영역: 정사각형의 위치와 한 변 — 아래 300px가 문구·날짜 띠
  const PC_BG = [
    { name: '새벽', c: ['#1d2b53', '#7e4c8f', '#f2a07b'], ink: 'light' },
    { name: '노을', c: ['#4a2147', '#c4455a', '#f6a85f'], ink: 'light' },
    { name: '바다', c: ['#0b3c4d', '#238a8d', '#9fd9d0'], ink: 'light' },
    { name: '숲', c: ['#14301f', '#3b6b49', '#a9c08f'], ink: 'light' },
    { name: '밤', c: ['#090d1c', '#1d2b53', '#42618f'], ink: 'light' },
    { name: '포도', c: ['#241743', '#5b3d92', '#b9a2e3'], ink: 'light' },
    { name: '모래', c: ['#d9c3a0', '#ecdcc0', '#f8efdc'], ink: 'dark' },
    { name: '벚꽃', c: ['#f4c3d2', '#f8dce5', '#fdf0f4'], ink: 'dark' },
  ];
  const PC_FRAMES = {
    white: { label: '흰색', bg: '#FBFAF7', ink: '#2B2A28' },
    cream: { label: '크림', bg: '#F3E9D3', ink: '#3A3022' },
    black: { label: '검정', bg: '#17181B', ink: '#EEEAE2' },
  };
  const PC_FONT_KEYS = ['nanumM', 'gowunB', 'gowunD', 'nanumG'];
  // 글씨 두 덩어리: v = 성경 구절(본문 + 출처), c = 추가 문구(+ 날짜). 크기는 pt(1pt = 카드 2픽셀, 카드 가로 = 540pt), pt 0 = 자동(상자에 맞춰 줄임)
  const PT = 2;
  const PC_TXT = {
    v: { label: '구절 글씨', min: 12, max: 60, def: { pt: 0, al: 'c', w: 83 } },
    c: { label: '추가 문구 · 날짜', min: 10, max: 48, def: { pt: 0, al: 'c', w: 90 } },
  };
  const PC_AL = [['l', '왼쪽'], ['c', '가운데'], ['r', '오른쪽']];
  let pcEl = null;
  function pcIsOpen() { return !!pcEl && !pcEl.hidden; }

  // 꾸밈 값(글씨체·색·틀·배경·어둡기·날짜 표시, 글씨 크기·정렬·상자 너비)만 기억한다. 구절·문구·사진·글씨 위치는 카드를 만들 때마다 새로 정한다.
  const pcPref = store.get('bf.pc', { font: 'nanumM', ink: 'light', frame: 'white', bg: 0, dim: 25, showDate: true });
  if (PC_FONT_KEYS.indexOf(pcPref.font) < 0) pcPref.font = 'nanumM';
  if (!PC_FRAMES[pcPref.frame]) pcPref.frame = 'white';
  if (!(pcPref.bg >= 0 && pcPref.bg < PC_BG.length)) pcPref.bg = 0;
  pcPref.dim = Math.min(Math.max(+pcPref.dim || 0, 0), 70);
  delete pcPref.size;   // v44의 '작게·보통·크게'는 pt 지정으로 바뀌었다
  Object.keys(PC_TXT).forEach((k) => {
    const o = (pcPref[k] && typeof pcPref[k] === 'object') ? pcPref[k] : {}, m = PC_TXT[k];
    pcPref[k] = {
      pt: (+o.pt >= m.min && +o.pt <= m.max) ? Math.round(+o.pt) : 0,
      al: ['l', 'c', 'r'].indexOf(o.al) >= 0 ? o.al : m.def.al,
      w: Math.min(Math.max(Math.round(+o.w || m.def.w), 30), 100),
    };
  });
  pcPref.ink = pcPref.ink === 'dark' ? 'dark' : 'light';
  pcPref.showDate = pcPref.showDate !== false;
  const pcSavePref = () => store.set('bf.pc', pcPref);

  const pcv = { bi: 0, c: 1, v1: 1, v2: 1 };   // 고른 구절 (장은 1부터)
  let pcVerseText = '', pcCaption = '', pcDateStr = '';   // 구절 본문은 고른 구절에서 자동으로 채운다(직접 고쳐 쓰는 칸은 없음)
  let pcPhoto = null;                           // { img(줄여 둔 사진), w, h }
  let pcZoom = 1, pcPanX = 0, pcPanY = 0;       // 확대 배율 · 끌어서 옮긴 양(카드 픽셀)
  let pcRaf = 0;
  let pcMode = 'text', pcTarget = 'v';          // 카드 위에서 끌 대상: 'photo'(사진) | 'text'(글씨) · 글씨 중 고른 덩어리
  const pcPos = { v: { dx: 0, dy: 0 }, c: { dx: 0, dy: 0 } };   // 글씨를 끌어 옮긴 양(기본 위치에서, 카드 픽셀)
  const pcEff = { v: { dx: 0, dy: 0 }, c: { dx: 0, dy: 0 } };   // 카드 안에 맞춰 실제로 그려진 옮김 양 (글씨가 커져 한도를 넘으면 pcPos와 달라진다)
  const pcBox = { v: null, c: null };           // 마지막으로 그린 글상자 {x, y, w, h}
  const pcDef = { v: null, c: null };           // 글상자의 기본 중심 {cx, cy}
  const pcFs = { v: 0, c: 0 };                  // 마지막으로 그린 글자 크기(px) — 자동일 때 pt 표시에 쓴다
  const pcGuide = { x: false, y: false };       // 끄는 동안 가운데 맞춤선 표시
  const pcFontState = {};
  const pcToday = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const pcFmtDate = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? m[1] + '. ' + (+m[2]) + '. ' + (+m[3]) + '.' : '';
  };
  const pcQ = (s) => pcEl.querySelector(s);

  function pcGather() {
    const vs = bible.books[pcv.bi].chapters[pcv.c - 1] || [];
    // 시편 머리말('[다윗의 시] …')은 카드에 어색하므로 앞의 [ ] 부분을 뺀다. (절 전체가 [ ]이면 그대로 둔다)
    const plain = (t) => { const r = t.replace(/^\[[^\]]*\]\s*/, ''); return r || t; };
    return vs.filter((v) => v.n >= pcv.v1 && v.n <= pcv.v2).map((v) => plain(v.t)).join(' ');
  }
  function pcRef() {
    return bible.books[pcv.bi].name + ' ' + pcv.c + ':' + pcv.v1 + (pcv.v2 > pcv.v1 ? '-' + pcv.v2 : '');
  }

  // ----- 글꼴: 캔버스는 글꼴을 미리 불러 둬야 하므로, 쓰는 글꼴을 한 번 불러오고 다 되면 다시 그린다 -----
  function pcFaces() { return [FONTS[pcPref.font].face]; }
  function pcEnsureFonts() {
    pcFaces().forEach((face) => {
      if (pcFontState[face]) return;
      pcFontState[face] = document.fonts && document.fonts.load
        ? document.fonts.load('400 40px "' + face + '"', '가나다라 0123 ABC').then(() => 'ok', () => 'fail') : Promise.resolve('fail');
      pcFontState[face].then(() => pcRender());
    });
  }
  function pcFontsReady() { pcEnsureFonts(); return Promise.all(pcFaces().map((f) => pcFontState[f])); }

  // ----- 글자 줄바꿈: 띄어쓰기 단위로 나누고, 한 낱말이 한 줄보다 길면 글자 단위로 자른다 -----
  function pcWrap(ctx, text, maxW) {
    const out = [];
    String(text).split(/\n/).forEach((par) => {
      const words = par.split(/\s+/).filter(Boolean);
      let line = '';
      words.forEach((w) => {
        const t = line ? line + ' ' + w : w;
        if (ctx.measureText(t).width <= maxW) { line = t; return; }
        if (line) { out.push(line); line = ''; }
        if (ctx.measureText(w).width <= maxW) { line = w; return; }
        let cur = '';
        Array.from(w).forEach((ch) => {
          if (cur && ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ''; }
          cur += ch;
        });
        line = cur;
      });
      out.push(line);
    });
    while (out.length > 1 && out[out.length - 1] === '') out.pop();
    return out;
  }
  // 글자 크기를 (시작 크기 → 최소 크기) 줄여 가며 maxH 안에 들어가는 첫 크기를 찾는다. 최소 크기에도 넘치면 마지막 줄을 …으로 줄인다.
  function pcFit2(ctx, text, stack, maxW, maxH, start, min, lh, maxLines) {
    let fs = start, lines = [];
    for (; fs >= min; fs -= 2) {
      ctx.font = fs + 'px ' + stack;
      lines = pcWrap(ctx, text, maxW);
      if (lines.length * fs * lh <= maxH && (!maxLines || lines.length <= maxLines)) return { fs, lines, over: false };
    }
    fs = min;
    ctx.font = fs + 'px ' + stack;
    lines = pcWrap(ctx, text, maxW);
    const cap = Math.max(1, Math.min(maxLines || 99, Math.floor(maxH / (fs * lh))));
    if (lines.length <= cap) return { fs, lines, over: false };
    lines = lines.slice(0, cap);
    let last = lines[cap - 1];
    while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    lines[cap - 1] = last.replace(/\s+$/, '') + '…';
    return { fs, lines, over: true };
  }

  function pcPhotoRect() {   // 사진이 그려질 위치·크기(카드 픽셀). 사진은 영역을 항상 가득 덮고, 끌어 옮긴 양은 그 안으로 제한한다.
    const A = PC_PS, s = Math.max(A / pcPhoto.w, A / pcPhoto.h) * pcZoom;
    const w = pcPhoto.w * s, h = pcPhoto.h * s;
    const mx = Math.max(0, (w - A) / 2), my = Math.max(0, (h - A) / 2);
    pcPanX = Math.min(Math.max(pcPanX, -mx), mx);
    pcPanY = Math.min(Math.max(pcPanY, -my), my);
    return { x: PC_PX + (A - w) / 2 + pcPanX, y: PC_PY + (A - h) / 2 + pcPanY, w, h };
  }

  // 글상자를 카드 안에 두는 한도: 기본 중심에서 얼마나(dx, dy) 옮길 수 있는지
  const PC_EDGE = 24;
  function pcLimits(k) {
    const b = pcBox[k], d = pcDef[k];
    if (!b || !d) return { loX: 0, hiX: 0, loY: 0, hiY: 0 };
    const f = (lo, hi) => (lo <= hi ? [lo, hi] : [0, 0]);
    const x = f(PC_EDGE + b.w / 2 - d.cx, PC_W - PC_EDGE - b.w / 2 - d.cx);
    const y = f(PC_EDGE + b.h / 2 - d.cy, PC_H - PC_EDGE - b.h / 2 - d.cy);
    return { loX: x[0], hiX: x[1], loY: y[0], hiY: y[1] };
  }
  // 사진 안에 놓인 글씨는 사진 위 글자색(흰색+그림자 / 진한 색), 흰 종이 띠에 놓이면 카드 틀 글자색을 쓴다
  const pcOnPhoto = (cx, cy) => cx >= PC_PX && cx <= PC_PX + PC_PS && cy >= PC_PY && cy <= PC_PY + PC_PS;
  const pcRefFs = (fs) => Math.round(Math.min(40, Math.max(26, fs * 0.6)));
  const pcRefBlock = (rf) => 44 + 3 + 30 + Math.round(rf * 1.2);   // 본문과 출처 사이 간격 + 짧은 줄 + 출처 글자

  function pcDraw(guides) {
    const cv = pcQ('#pc-canvas'), ctx = cv.getContext('2d');
    const fr = PC_FRAMES[pcPref.frame], font = FONTS[pcPref.font];
    const light = pcPref.ink === 'light';
    // 카드 틀(종이)
    ctx.clearRect(0, 0, PC_W, PC_H);
    ctx.fillStyle = fr.bg;
    ctx.fillRect(0, 0, PC_W, PC_H);
    // 사진 또는 배경
    ctx.save();
    ctx.beginPath(); ctx.rect(PC_PX, PC_PY, PC_PS, PC_PS); ctx.clip();
    if (pcPhoto) {
      const r = pcPhotoRect();
      ctx.drawImage(pcPhoto.img, r.x, r.y, r.w, r.h);
    } else {
      const bg = PC_BG[pcPref.bg];
      const g = ctx.createLinearGradient(PC_PX, PC_PY, PC_PX + PC_PS * 0.72, PC_PY + PC_PS);
      bg.c.forEach((c, i) => g.addColorStop(i / (bg.c.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(PC_PX, PC_PY, PC_PS, PC_PS);
      const gl = ctx.createRadialGradient(PC_PX + PC_PS * 0.3, PC_PY + PC_PS * 0.22, 0, PC_PX + PC_PS * 0.3, PC_PY + PC_PS * 0.22, PC_PS * 0.75);
      gl.addColorStop(0, 'rgba(255,255,255,.24)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(PC_PX, PC_PY, PC_PS, PC_PS);
    }
    if (pcPref.dim > 0) {   // 글자가 잘 읽히도록 어둡게
      ctx.fillStyle = 'rgba(0,0,0,' + (pcPref.dim / 100) + ')';
      ctx.fillRect(PC_PX, PC_PY, PC_PS, PC_PS);
    }
    const vg = ctx.createRadialGradient(PC_PX + PC_PS / 2, PC_PY + PC_PS / 2, PC_PS * 0.42, PC_PX + PC_PS / 2, PC_PY + PC_PS / 2, PC_PS * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(PC_PX, PC_PY, PC_PS, PC_PS);
    ctx.restore();

    // 사진 테두리
    ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 2;
    ctx.strokeRect(PC_PX - 1, PC_PY - 1, PC_PS + 2, PC_PS + 2);

    const TA = { l: 'left', c: 'center', r: 'right' };
    const photoInk = light ? '#FFFFFF' : '#2B2A28';
    const setShadow = (on, blur, oy) => {
      if (on) { ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; }
      else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
    };
    let over = false;

    // ---- 성경 구절 덩어리(본문 + 짧은 줄 + 출처) ----
    {
      const o = pcPref.v, stack = font.stack, bw = Math.round(PC_PS * o.w / 100), lhR = 1.62;
      const text = (pcVerseText || '').trim();
      let body = { fs: 0, lines: [] };
      if (text) {
        if (o.pt) body = pcFit2(ctx, text, stack, bw, PC_H - 2 * PC_EDGE - pcRefBlock(pcRefFs(o.pt * PT)), o.pt * PT, o.pt * PT, lhR);
        else body = pcFit2(ctx, text, stack, bw, PC_PS - 168 - pcRefBlock(40), 72, 30, lhR);   // 자동: 상자(사진 안쪽)에 들어가도록 72px → 30px 사이에서 줄인다
        over = body.over;
      }
      const fsShown = body.fs || (o.pt ? o.pt * PT : 72);
      pcFs.v = fsShown;
      const refFs = pcRefFs(fsShown), refBlock = pcRefBlock(refFs);
      const bodyH = body.lines.length * body.fs * lhR;
      const total = bodyH + (text ? refBlock : refBlock - 44);
      pcDef.v = { cx: PC_W / 2, cy: PC_PY + PC_PS / 2 };
      pcBox.v = { x: 0, y: 0, w: bw, h: total };
      const lim = pcLimits('v');
      pcEff.v.dx = Math.min(Math.max(pcPos.v.dx, lim.loX), lim.hiX);   // 사용자가 정한 위치(pcPos)는 그대로 두고, 그릴 때만 카드 안으로 맞춘다
      pcEff.v.dy = Math.min(Math.max(pcPos.v.dy, lim.loY), lim.hiY);
      const cx = pcDef.v.cx + pcEff.v.dx, cy = pcDef.v.cy + pcEff.v.dy;
      const left = cx - bw / 2, top = cy - total / 2;
      pcBox.v = { x: left, y: top, w: bw, h: total };
      const onPhoto = pcOnPhoto(cx, cy), ink = onPhoto ? photoInk : fr.ink, sh = onPhoto && light;
      const ax = o.al === 'l' ? left : o.al === 'r' ? left + bw : cx;
      ctx.textAlign = TA[o.al]; ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
      setShadow(sh, 16, 3);
      ctx.font = body.fs + 'px ' + stack;
      body.lines.forEach((ln, i) => { ctx.fillText(ln, ax, top + (i + 0.5) * body.fs * lhR); });
      let y = top + bodyH + (text ? 44 : 0);
      setShadow(false);
      ctx.globalAlpha = 0.75; ctx.fillStyle = ink;
      ctx.fillRect(o.al === 'l' ? left : o.al === 'r' ? left + bw - 64 : cx - 32, y, 64, 3);
      ctx.globalAlpha = 0.95;
      ctx.font = refFs + 'px ' + stack;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
      setShadow(sh, 12, 2);
      ctx.fillText(pcRef(), ax, y + 3 + 30 + refFs * 0.6);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.globalAlpha = 1; setShadow(false);
    }

    // ---- 아래 문구·날짜 덩어리 ----
    {
      const o = pcPref.c, cst = font.stack, bw = Math.round(PC_PS * o.w / 100), LH = 1.35;   // 글씨체는 구절·문구·날짜 모두 같은 것을 쓴다
      const cap = pcCaption.trim(), date = pcPref.showDate ? pcFmtDate(pcDateStr) : '';
      if (cap || date) {
        let cf = { fs: 0, lines: [] };
        if (cap) {
          if (o.pt) cf = pcFit2(ctx, cap, cst, bw, 4 * o.pt * PT * LH + 2, o.pt * PT, o.pt * PT, LH, 4);
          else cf = pcFit2(ctx, cap, cst, bw, 140, 58, 34, LH, 2);
        }
        const capFs = cf.fs || (o.pt ? o.pt * PT : 58);
        pcFs.c = capFs;
        const dateFs = cap ? Math.round(Math.min(40, Math.max(26, capFs * 0.62))) : 36;
        const dateH = date ? Math.round(dateFs * 1.4) : 0, gap = cap && date ? 14 : 0;
        const capH = cf.lines.length * cf.fs * LH, tot = capH + gap + dateH;
        pcDef.c = { cx: PC_W / 2, cy: PC_PY + PC_PS + (PC_H - PC_PY - PC_PS) / 2 - 4 };
        pcBox.c = { x: 0, y: 0, w: bw, h: tot };
        const lim = pcLimits('c');
        pcEff.c.dx = Math.min(Math.max(pcPos.c.dx, lim.loX), lim.hiX);
        pcEff.c.dy = Math.min(Math.max(pcPos.c.dy, lim.loY), lim.hiY);
        const cx = pcDef.c.cx + pcEff.c.dx, cy = pcDef.c.cy + pcEff.c.dy;
        const left = cx - bw / 2, top = cy - tot / 2;
        pcBox.c = { x: left, y: top, w: bw, h: tot };
        const onPhoto = pcOnPhoto(cx, cy), ink = onPhoto ? photoInk : fr.ink, sh = onPhoto && light;
        const ax = o.al === 'l' ? left : o.al === 'r' ? left + bw : cx;
        ctx.textAlign = TA[o.al]; ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
        setShadow(sh, 12, 2);
        ctx.font = cf.fs + 'px ' + cst;
        cf.lines.forEach((ln, i) => ctx.fillText(ln, ax, top + (i + 0.5) * cf.fs * LH));
        if (date) {
          ctx.globalAlpha = onPhoto ? 0.85 : 0.58;
          ctx.font = dateFs + 'px ' + cst;
          if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
          ctx.fillText(date, ax, top + capH + gap + dateH / 2);
          if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          ctx.globalAlpha = 1;
        }
        setShadow(false);
      } else {
        pcBox.c = null; pcDef.c = null; pcFs.c = 0;
      }
    }

    // 종이 가장자리
    ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, PC_W - 2, PC_H - 2);

    // 글씨 배치 중에만 보이는 안내선(저장하는 사진에는 넣지 않는다)
    if (guides) {
      ctx.save();
      Object.keys(PC_TXT).forEach((k) => {
        const b = pcBox[k];
        if (!b) return;
        const on = k === pcTarget, pad = 14;
        ctx.setLineDash([]); ctx.lineWidth = on ? 6 : 4; ctx.strokeStyle = on ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.5)';
        ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
        ctx.setLineDash(on ? [16, 12] : [8, 12]); ctx.lineWidth = on ? 4 : 3; ctx.strokeStyle = on ? 'rgba(220,60,40,.95)' : 'rgba(220,60,40,.5)';
        ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      });
      ctx.setLineDash([]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,140,255,.95)';
      const d = pcDef[pcTarget];
      if (pcGuide.x) { ctx.beginPath(); ctx.moveTo(PC_W / 2, 0); ctx.lineTo(PC_W / 2, PC_H); ctx.stroke(); }
      if (pcGuide.y && d) { ctx.beginPath(); ctx.moveTo(0, d.cy); ctx.lineTo(PC_W, d.cy); ctx.stroke(); }
      ctx.restore();
    }
    return { over };
  }

  function pcRender() {
    if (pcRaf || !pcIsOpen()) return;
    pcRaf = requestAnimationFrame(() => {
      pcRaf = 0;
      if (!pcIsOpen()) return;
      pcEnsureFonts();
      let r = { over: false };
      try { r = pcDraw(pcMode === 'text'); } catch (err) { showError(err); }
      const w = pcQ('#pc-warn');
      w.hidden = !r.over;
      w.textContent = r.over ? "본문이 길어 카드에 다 들어가지 않아 끝이 줄어듭니다. 절 수를 줄이거나 글자 크기(pt)를 줄이고, '자동'을 눌러 보세요." : '';
      pcSyncPt();
    });
  }

  // ----- 화면 배치: 펼침(넓은 화면)은 왼쪽 입력 / 오른쪽 카드, 좁은 화면은 '입력 | 카드' 탭으로 한 화면씩 -----
  function layoutPc() {
    if (!pcEl) return;
    const g = geometry(), W = g.W, H = g.H, si = g.si;
    const two = W >= 680 && W >= H * 1.1;
    pcEl.classList.toggle('two', two);
    pcEl.classList.toggle('narrow', !two);
    // 듀오 펼침: 오른쪽 안전영역(약 84px)은 맨 위의 상태 알약 자리만 비우면 되므로, 카드를 알약 아래(118px)로 내린다.
    const rail = NATIVE && two && si.left < 8 && si.right >= 60;
    const top = Math.max(Math.round(si.top), 0) + 12;
    const set = (k, v) => pcEl.style.setProperty(k, v + 'px');
    set('--pc-top', top);
    set('--pc-topr', two ? (rail ? Math.max(top, NATIVE_PILL_BOTTOM + 6) : top) : 12);
    // 펼침(두 쪽)은 오른쪽 화면을 키보드와 상관없이 그대로 둔다. 좁은 화면은 키보드가 올라오면 홈 막대 자리를 키보드가 덮는다.
    set('--pc-bot', (kbH > 0 && !two ? 0 : Math.max(Math.round(si.bottom), 0)) + 14);
    set('--pc-l', Math.max(rail || si.left < 8 ? 22 : 0, Math.round(si.left) + 10));
    set('--pc-r', Math.max(rail || si.right < 8 ? 22 : 0, rail ? 22 : Math.round(si.right) + 10));
    pcFitCanvas();
  }
  function pcFitCanvas() {
    const st = pcQ('.pc-stage'), cv = pcQ('#pc-canvas');
    const w = st.clientWidth, h = st.clientHeight;
    if (w < 20 || h < 20) return;
    const k = Math.min(w / PC_W, h / PC_H);
    cv.style.width = Math.floor(PC_W * k) + 'px';
    cv.style.height = Math.floor(PC_H * k) + 'px';
  }
  function pcTab(t) {
    pcEl.dataset.tab = t;
    pcEl.querySelectorAll('.pc-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    pcFitCanvas();
    pcRender();
  }

  // ----- 입력 칸 ↔ 값 맞추기 -----
  function pcFillVerseSelects() {
    const book = bible.books[pcv.bi], unit = book.id === 'psa' ? '편' : '장';
    const bs = pcQ('#pc-book');
    if (!bs.options.length) bs.innerHTML = bible.books.map((b, i) => '<option value="' + i + '">' + esc(b.name) + '</option>').join('');
    bs.value = String(pcv.bi);
    const cs = pcQ('#pc-ch');
    cs.innerHTML = book.chapters.map((_, i) => '<option value="' + (i + 1) + '">' + (i + 1) + unit + '</option>').join('');
    cs.value = String(pcv.c);
    const nums = verseNums(pcv.bi, pcv.c);
    pcv.v1 = nearVerse(nums, pcv.v1);
    if (pcv.v2 < pcv.v1 || nums.indexOf(pcv.v2) < 0) pcv.v2 = pcv.v1;
    pcQ('#pc-v1').innerHTML = nums.map((n) => '<option value="' + n + '">' + n + '절</option>').join('');
    pcQ('#pc-v1').value = String(pcv.v1);
    pcQ('#pc-v2').innerHTML = nums.filter((n) => n >= pcv.v1).map((n) => '<option value="' + n + '">' + n + '절</option>').join('');
    pcQ('#pc-v2').value = String(pcv.v2);
  }
  function pcRefill() {   // 고른 구절의 본문을 카드에 넣는다
    pcVerseText = pcGather();
    pcQ('#pc-canvas').setAttribute('aria-label', '바이블 포토 카드 미리보기 · ' + pcRef() + ' · ' + pcVerseText);
    pcRender();
  }
  function pcSync() {
    pcEl.querySelectorAll('.pc-seg').forEach((sg) => {
      const k = sg.dataset.k;
      sg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(pcPref[k]) === b.dataset.v));
    });
    pcEl.querySelectorAll('.pc-sw button').forEach((b, i) => b.classList.toggle('on', i === pcPref.bg));
    pcQ('#pc-sw').classList.toggle('off', !!pcPhoto);
    pcQ('#pc-dim').value = pcPref.dim;
    pcQ('#pc-dim-o').textContent = pcPref.dim + '%';
    pcShowZoom();
    pcQ('#pc-zoom').disabled = !pcPhoto;
    pcQ('#pc-nophoto').disabled = !pcPhoto;
    pcQ('#pc-showdate').checked = pcPref.showDate;
    pcSyncMode();
    pcSyncTxt();
  }
  function pcSyncMode() {
    pcEl.querySelectorAll('#pc-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === pcMode));
    pcQ('#pc-hint').textContent = pcMode === 'text'
      ? '카드 위에서 글씨를 끌어 옮기고, 두 손가락으로 벌려 크기를 바꿀 수 있습니다.'
      : (pcPhoto ? '카드 위에서 사진을 끌어 위치를, 두 손가락으로 벌려 크기를 바꿀 수 있습니다.' : '사진을 고르면 여기서 위치와 크기를 맞출 수 있습니다.');
    pcQ('#pc-canvas').style.cursor = pcMode === 'text' ? 'move' : (pcPhoto ? 'grab' : 'default');
  }
  function pcSetMode(m) {
    if (pcMode === m) { pcSyncMode(); return; }
    pcMode = m;
    pcSyncMode();
    pcRender();
  }
  // 글씨 조절 칸(대상·크기·정렬·너비)을 고른 대상의 값에 맞춘다. 크기가 '자동'이면 지금 그려진 크기를 보여 준다.
  function pcShownPt(k) { return pcPref[k].pt || Math.round((pcFs[k] || 0) / PT); }
  function pcSyncTxt() {
    if (!pcEl) return;
    const k = pcTarget, o = pcPref[k], m = PC_TXT[k];
    pcEl.querySelectorAll('#pc-tg button').forEach((b) => b.classList.toggle('on', b.dataset.t === k));
    pcEl.querySelectorAll('#pc-al button').forEach((b) => b.classList.toggle('on', b.dataset.v === o.al));
    const r = pcQ('#pc-pt-r'), n = pcQ('#pc-pt');
    r.min = m.min; r.max = m.max; n.min = m.min; n.max = m.max;
    pcQ('#pc-pt-auto').classList.toggle('on', !o.pt);
    pcQ('#pc-w').value = o.w;
    pcQ('#pc-w-o').textContent = o.w + '%';
    pcSyncPt();
  }
  function pcSyncPt() {   // 자동 크기는 다시 그릴 때마다 달라지므로 크기 칸만 따로 갱신한다
    if (!pcEl) return;
    const k = pcTarget, v = pcShownPt(k);
    const r = pcQ('#pc-pt-r'), n = pcQ('#pc-pt');
    if (v) { r.value = v; if (document.activeElement !== n) n.value = v; }
    else if (document.activeElement !== n) n.value = '';
    pcQ('#pc-pt-auto').classList.toggle('on', !pcPref[k].pt);
    const none = k === 'c' && !pcBox.c;
    pcQ('#pc-none').hidden = !none;
  }
  function pcSetPt(v) {   // 0 = 자동
    const k = pcTarget, m = PC_TXT[k];
    pcPref[k].pt = v ? Math.min(Math.max(Math.round(v), m.min), m.max) : 0;
    pcSavePref(); pcSyncPt(); pcRender();
  }
  function pcSetTarget(k) {
    if (!PC_TXT[k] || pcTarget === k) return;
    pcTarget = k;
    pcSyncTxt();
    pcRender();
  }
  function pcShowZoom() {
    pcQ('#pc-zoom').value = Math.round(pcZoom * 100);
    pcQ('#pc-zoom-o').textContent = pcPhoto ? Math.round(pcZoom * 100) + '%' : '';
  }
  function pcApplyPreset(i) {
    pcPref.bg = i;
    pcPref.ink = PC_BG[i].ink;
    if (PC_BG[i].ink === 'dark') pcPref.dim = 0;
    else if (pcPref.dim === 0) pcPref.dim = 20;
  }

  // ----- 사진 -----
  async function pcLoadPhoto(file) {
    if (!file) return;
    try {
      let src = null;
      if (window.createImageBitmap) { try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { src = null; } }
      if (!src) {
        const url = URL.createObjectURL(file);
        src = await new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => rej(new Error('이미지를 읽지 못했습니다'));
          im.src = url;
        });
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
      const iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
      if (!iw || !ih) throw new Error('빈 이미지');
      const k = Math.min(1, 2400 / Math.max(iw, ih));   // 휴대폰 사진은 크므로 카드에 필요한 만큼만 줄여 둔다
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(iw * k)); cv.height = Math.max(1, Math.round(ih * k));
      cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
      if (src.close) src.close();
      pcPhoto = { img: cv, w: cv.width, h: cv.height };
      pcZoom = 1; pcPanX = 0; pcPanY = 0;
      pcPref.ink = 'light';                       // 사진 위에서는 흰 글자 + 조금 어둡게가 기본
      pcPref.dim = Math.max(pcPref.dim, 25);
      pcMode = 'photo';                           // 사진을 고른 직후에는 사진 위치부터 맞춘다
      pcSavePref();
    } catch (err) {
      showToastLine('사진을 불러오지 못했습니다. 다른 사진으로 다시 시도해 주세요.');
    }
    pcSync(); pcRender();
  }
  function pcClearPhoto() {
    pcPhoto = null; pcZoom = 1; pcPanX = 0; pcPanY = 0;
    pcMode = 'text';
    pcApplyPreset(pcPref.bg);
    pcSavePref(); pcSync(); pcRender();
  }

  // ----- 카드 위에서 끌기·두 손가락 벌리기 -----
  //   사진 모드: 사진 위치(끌기)·크기(벌리기) · 마우스 휠(크기)
  //   글씨 모드: 손가락이 닿은 글씨 덩어리를 끌어 옮기고(가운데·기본 위치 근처에서 달라붙음), 두 손가락 벌리기로 글자 크기(pt)를 바꾼다
  const PC_SNAP = 14;
  function pcHitText(p) {
    const pad = 36, hit = [];
    Object.keys(PC_TXT).forEach((k) => {
      const b = pcBox[k];
      if (b && p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) hit.push(k);
    });
    if (!hit.length) return null;
    return hit.indexOf(pcTarget) >= 0 ? pcTarget : hit[0];
  }
  function pcBindGesture(cv) {
    const ptrs = new Map();
    let lastDist = 0, lastMid = null;
    let drag = null;     // 글씨 끌기: { k, rx, ry }  (rx, ry = 달라붙기 전의 기본 위치에서 옮긴 양)
    let pinch = null;    // 글씨 크기: { k, base, d0, changed }
    const scale = () => PC_W / Math.max(1, cv.clientWidth);
    const mid = () => { const a = Array.from(ptrs.values()); return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; };
    const toCard = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * PC_W / Math.max(1, r.width), y: (e.clientY - r.top) * PC_H / Math.max(1, r.height) }; };
    cv.addEventListener('pointerdown', (e) => {
      if (pcMode === 'photo' && !pcPhoto) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const m = mid(); lastDist = m.d; lastMid = m; } else { lastDist = 0; lastMid = null; }
      if (pcMode === 'text') {
        if (ptrs.size === 1) {
          const k = pcHitText(toCard(e)) || pcTarget;
          if (k !== pcTarget) pcSetTarget(k);
          drag = pcBox[k] ? { k, rx: pcEff[k].dx, ry: pcEff[k].dy } : null;   // 보이는 위치에서 이어서 끈다
        } else if (ptrs.size === 2) {
          drag = null;
          const k = pcTarget;
          pinch = pcBox[k] ? { k, base: pcShownPt(k), d0: mid().d, changed: false } : null;
        }
      }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pcMode === 'text') {
        if (drag && ptrs.size === 1) {
          const k = drag.k, lim = pcLimits(k), sc = scale();
          drag.rx = Math.min(Math.max(drag.rx + dx * sc, lim.loX), lim.hiX);
          drag.ry = Math.min(Math.max(drag.ry + dy * sc, lim.loY), lim.hiY);
          pcGuide.x = Math.abs(drag.rx) < PC_SNAP;
          pcGuide.y = Math.abs(drag.ry) < PC_SNAP;
          pcPos[k].dx = pcGuide.x ? 0 : drag.rx;
          pcPos[k].dy = pcGuide.y ? 0 : drag.ry;
        } else if (pinch && ptrs.size === 2) {
          const m = mid(), mm = PC_TXT[pinch.k];
          if (pinch.d0 > 0 && pinch.base > 0) {
            const next = Math.min(Math.max(Math.round(pinch.base * (m.d / pinch.d0)), mm.min), mm.max);
            if (next !== pcPref[pinch.k].pt) { pcPref[pinch.k].pt = next; pinch.changed = true; pcSyncTxt(); }
          }
        }
        pcRender();
        e.preventDefault();
        return;
      }
      if (!pcPhoto) return;
      if (ptrs.size === 1) {
        pcPanX += dx * scale(); pcPanY += dy * scale();
      } else if (ptrs.size === 2) {
        const m = mid();
        if (lastDist > 0) pcZoom = Math.min(Math.max(pcZoom * (m.d / lastDist), 1), 3);
        if (lastMid) { pcPanX += (m.x - lastMid.x) * scale(); pcPanY += (m.y - lastMid.y) * scale(); }
        lastDist = m.d; lastMid = m;
        pcShowZoom();
      }
      pcRender();
      e.preventDefault();
    });
    const up = (e) => {
      ptrs.delete(e.pointerId); lastDist = 0; lastMid = null;
      if (ptrs.size === 2) { const m = mid(); lastDist = m.d; lastMid = m; }
      if (pcMode === 'text') {
        if (pinch && pinch.changed && ptrs.size < 2) pcSavePref();
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 0) { drag = null; pcGuide.x = false; pcGuide.y = false; pcRender(); }
        else drag = null;   // 두 손가락을 쓴 뒤 남은 한 손가락으로는 옮기지 않는다
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      if (pcMode !== 'photo' || !pcPhoto) return;
      e.preventDefault();
      pcZoom = Math.min(Math.max(pcZoom * Math.exp(-e.deltaY * 0.002), 1), 3);
      pcShowZoom();
      pcRender();
    }, { passive: false });
  }

  // ----- 저장·공유 -----
  async function pcSave() {
    const btn = pcQ('#pc-save');
    btn.disabled = true;
    try {
      await pcFontsReady();
      pcDraw(false);                              // 글꼴이 다 준비된 뒤 한 번 더(글씨 안내선 없이) 그려서 내보낸다
      const cv = pcQ('#pc-canvas');
      const name = 'photocard-' + (pcDateStr || pcToday()).replace(/-/g, '') + '.jpg';
      const bridge = NATIVE && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bf;
      if (bridge) {
        const url = cv.toDataURL('image/jpeg', 0.93);
        bridge.postMessage({ share: url.slice(url.indexOf(',') + 1), name });
        showToastLine("공유 창에서 '이미지 저장'을 누르면 사진 앱에 보관됩니다.");
        return;
      }
      const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.93));
      if (!blob) throw new Error('이미지를 만들지 못했습니다');
      const file = new File([blob], name, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch (e) { if (!e || e.name !== 'AbortError') throw e; }
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      showToastLine('사진 파일로 저장했습니다.');
    } catch (err) {
      showToastLine('저장하지 못했습니다: ' + (err && err.message ? err.message : err));
    } finally {
      btn.disabled = false;
      pcRender();                                 // 화면에는 다시 안내선을 그린다
    }
  }

  function buildPc() {
    const el = document.createElement('div');
    el.id = 'pc'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '바이블 포토 카드');
    const seg = (k, items) => '<div class="seg pc-seg" data-k="' + k + '">' +
      items.map((it) => '<button type="button" data-v="' + it[0] + '">' + it[1] + '</button>').join('') + '</div>';
    el.innerHTML =
      '<div class="pc-bar">' +
        '<button type="button" class="link-btn pc-x" id="pc-close">‹ 닫기</button>' +
        '<strong>바이블 포토 카드</strong>' +
        '<div class="pc-tabs"><button type="button" data-t="l">입력</button><button type="button" data-t="r">카드</button></div>' +
      '</div>' +
      '<div class="pc-l"><div class="pc-form" id="pc-form">' +
        '<div class="pc-sec"><h3>성경 구절</h3>' +
          '<input id="pc-ref" class="pc-in" type="text" placeholder="직접 입력 (예: 요 3:16-18)" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">' +
          '<p class="pc-msg" id="pc-refmsg" hidden></p>' +
          '<div class="pc-sel"><select id="pc-book" aria-label="책"></select><select id="pc-ch" aria-label="장"></select>' +
            '<select id="pc-v1" aria-label="시작 절"></select><span>~</span><select id="pc-v2" aria-label="끝 절"></select></div>' +
          '<p class="pc-msg warn" id="pc-warn" hidden></p>' +
        '</div>' +
        '<div class="pc-sec"><h3>사진 · 배경</h3>' +
          '<div class="pc-btns"><label class="pc-btn main">사진 고르기<input id="pc-file" type="file" accept="image/*"></label>' +
            '<button type="button" class="pc-btn" id="pc-nophoto">사진 빼기</button></div>' +
          '<div class="pc-lbl">사진이 없으면 이 배경을 씁니다</div>' +
          '<div class="pc-sw" id="pc-sw">' + PC_BG.map((b, i) => '<button type="button" data-i="' + i + '" title="' + b.name + '" aria-label="배경 ' + b.name +
            '" style="background:linear-gradient(135deg,' + b.c.join(',') + ')"></button>').join('') + '</div>' +
          '<label class="pc-rng"><span>확대</span><input id="pc-zoom" type="range" min="100" max="300" value="100"><output id="pc-zoom-o">100%</output></label>' +
          '<label class="pc-rng"><span>어둡게</span><input id="pc-dim" type="range" min="0" max="70" value="25"><output id="pc-dim-o">25%</output></label>' +
        '</div>' +
        '<div class="pc-sec"><h3>추가 문구 · 날짜</h3>' +
          '<input id="pc-cap" class="pc-in" type="text" maxlength="60" placeholder="카드 아래에 넣을 문구 (예: 오늘도 은혜로 걸어갑니다)" autocomplete="off" enterkeyhint="done">' +
          '<div class="pc-date"><input id="pc-date" class="pc-in" type="date" aria-label="날짜"><label class="chk"><input id="pc-showdate" type="checkbox">날짜 넣기</label></div>' +
        '</div>' +
        '<div class="pc-sec"><h3>글씨 · 크기 · 정렬 · 위치</h3>' +
          '<div class="seg pc-tg" id="pc-tg">' + Object.keys(PC_TXT).map((k) => '<button type="button" data-t="' + k + '">' + PC_TXT[k].label + '</button>').join('') + '</div>' +
          '<p class="pc-msg" id="pc-none" hidden>추가 문구나 날짜를 넣으면 여기서 크기와 위치를 정할 수 있습니다.</p>' +
          '<div class="pc-lbl">글자 크기 (pt)</div>' +
          '<div class="pc-pt"><button type="button" class="pc-step" id="pc-pt-m" aria-label="글자 크기 줄이기">−</button>' +
            '<input id="pc-pt" class="pc-in" type="number" inputmode="numeric" step="1" aria-label="글자 크기(pt)" placeholder="자동">' +
            '<span class="pc-unit">pt</span>' +
            '<button type="button" class="pc-step" id="pc-pt-p" aria-label="글자 크기 키우기">+</button>' +
            '<button type="button" class="pc-chip" id="pc-pt-auto">자동</button></div>' +
          '<input id="pc-pt-r" type="range" min="12" max="60" step="1" aria-label="글자 크기 조절">' +
          '<div class="pc-lbl">정렬</div>' +
          '<div class="seg pc-seg pc-al" id="pc-al">' + PC_AL.map((a) => '<button type="button" data-v="' + a[0] + '" aria-label="' + a[1] + ' 정렬"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
            (a[0] === 'l' ? 'M4 6h16M4 10h10M4 14h16M4 18h10' : a[0] === 'r' ? 'M4 6h16M10 10h10M4 14h16M10 18h10' : 'M4 6h16M7 10h10M4 14h16M7 18h10') + '"/></svg>' + a[1] + '</button>').join('') + '</div>' +
          '<label class="pc-rng"><span>너비</span><input id="pc-w" type="range" min="30" max="100" step="1"><output id="pc-w-o">83%</output></label>' +
          '<button type="button" class="pc-btn pc-mini" id="pc-pos-reset">위치 되돌리기</button>' +
        '</div>' +
        '<div class="pc-sec"><h3>꾸미기</h3>' +
          '<div class="pc-lbl">글씨체 (구절 · 추가 문구 · 날짜 모두)</div>' + seg('font', PC_FONT_KEYS.map((k) => [k, FONTS[k].label])) +
          '<div class="pc-lbl">글자색 (사진 위)</div>' + seg('ink', [['light', '흰색'], ['dark', '진한 색']]) +
          '<div class="pc-lbl">카드 틀</div>' + seg('frame', Object.keys(PC_FRAMES).map((k) => [k, PC_FRAMES[k].label])) +
        '</div>' +
      '</div></div>' +
      '<div class="pc-r">' +
        '<div class="pc-stage"><canvas id="pc-canvas" width="' + PC_W + '" height="' + PC_H + '" aria-label="바이블 포토 카드 미리보기"></canvas></div>' +
        '<div class="seg pc-mode" id="pc-mode"><button type="button" data-m="photo">사진 위치 · 크기</button><button type="button" data-m="text">글씨 배치</button></div>' +
        '<p class="pc-hint" id="pc-hint"></p>' +
        '<button type="button" class="pc-act" id="pc-save">사진으로 저장 · 공유</button>' +
      '</div>';
    document.body.appendChild(el);
    pcEl = el;

    // 닫기·탭
    pcQ('#pc-close').addEventListener('click', closePc);
    pcEl.querySelectorAll('.pc-tabs button').forEach((b) => b.addEventListener('click', () => pcTab(b.dataset.t)));
    // 구절 고르기
    const num = (s) => parseInt(pcQ(s).value, 10);
    pcQ('#pc-book').addEventListener('change', () => { pcv.bi = num('#pc-book'); pcv.c = 1; pcv.v1 = pcv.v2 = 1; pcFillVerseSelects(); pcRefill(); });
    pcQ('#pc-ch').addEventListener('change', () => { pcv.c = num('#pc-ch'); pcv.v1 = pcv.v2 = 1; pcFillVerseSelects(); pcRefill(); });
    pcQ('#pc-v1').addEventListener('change', () => { pcv.v1 = num('#pc-v1'); if (pcv.v2 < pcv.v1) pcv.v2 = pcv.v1; pcFillVerseSelects(); pcRefill(); });
    pcQ('#pc-v2').addEventListener('change', () => { pcv.v2 = num('#pc-v2'); pcRefill(); });
    const refIn = pcQ('#pc-ref'), refMsg = pcQ('#pc-refmsg');
    const readRef = (final) => {
      const q = refIn.value.trim();
      refMsg.hidden = true;
      if (!q) return;
      const r = parseRange(q);
      if (r && r.c1 === r.c2) {
        pcv.bi = r.bi; pcv.c = r.c1; pcv.v1 = r.v1; pcv.v2 = r.v2;
        pcFillVerseSelects(); pcRefill();
      } else if (final) {
        refMsg.textContent = r ? '한 장 안에서 고른 구절만 넣을 수 있습니다. (예: 요 3:16-18)' : '구절을 찾지 못했습니다. 예: 요 3:16, 시 23:1-3, 창세기 1:1-5';
        refMsg.hidden = false;
      }
    };
    refIn.addEventListener('input', () => readRef(false));
    refIn.addEventListener('change', () => readRef(true));
    refIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); readRef(true); refIn.blur(); } });
    // 사진·배경
    pcQ('#pc-file').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; pcLoadPhoto(f); });
    pcQ('#pc-nophoto').addEventListener('click', pcClearPhoto);
    pcQ('#pc-sw').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      pcApplyPreset(+b.dataset.i);
      pcSavePref(); pcSync(); pcRender();
    });
    pcQ('#pc-zoom').addEventListener('input', (e) => { pcZoom = Math.min(Math.max(+e.target.value / 100, 1), 3); pcShowZoom(); pcRender(); });
    pcQ('#pc-dim').addEventListener('input', (e) => { pcPref.dim = +e.target.value; pcQ('#pc-dim-o').textContent = pcPref.dim + '%'; pcSavePref(); pcRender(); });
    pcBindGesture(pcQ('#pc-canvas'));
    // 문구·날짜
    pcQ('#pc-cap').addEventListener('input', (e) => { pcCaption = e.target.value; pcRender(); });
    pcQ('#pc-cap').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
    pcQ('#pc-date').addEventListener('input', (e) => { pcDateStr = e.target.value; pcRender(); });
    pcQ('#pc-showdate').addEventListener('change', (e) => { pcPref.showDate = e.target.checked; pcSavePref(); pcRender(); });
    // 꾸미기(글씨체·글자색·틀)
    pcEl.querySelectorAll('.pc-seg[data-k]').forEach((sg) => sg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      pcPref[sg.dataset.k] = b.dataset.v;
      pcSavePref(); pcSync(); pcRender();
    }));
    // 글씨: 대상 · 크기(pt) · 정렬 · 너비 · 위치
    pcQ('#pc-tg').addEventListener('click', (e) => { const b = e.target.closest('button[data-t]'); if (b) pcSetTarget(b.dataset.t); });
    pcQ('#pc-pt-m').addEventListener('click', () => pcSetPt(pcShownPt(pcTarget) - 1));
    pcQ('#pc-pt-p').addEventListener('click', () => pcSetPt(pcShownPt(pcTarget) + 1));
    pcQ('#pc-pt-auto').addEventListener('click', () => pcSetPt(0));
    pcQ('#pc-pt-r').addEventListener('input', (e) => pcSetPt(+e.target.value));
    const ptIn = pcQ('#pc-pt');
    ptIn.addEventListener('input', () => {   // 숫자를 치는 도중(예: 2 → 28)에는 범위에 맞는 값일 때만 적용한다
      const v = parseFloat(ptIn.value), m = PC_TXT[pcTarget];
      if (v >= m.min && v <= m.max) pcSetPt(v);
    });
    ptIn.addEventListener('change', () => {
      const v = parseFloat(ptIn.value);
      if (isFinite(v)) pcSetPt(v); else pcSetPt(pcPref[pcTarget].pt);
      ptIn.value = pcShownPt(pcTarget) || '';
    });
    ptIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ptIn.blur(); } });
    pcQ('#pc-al').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      pcPref[pcTarget].al = b.dataset.v;
      pcSavePref(); pcSyncTxt(); pcRender();
    });
    pcQ('#pc-w').addEventListener('input', (e) => {
      pcPref[pcTarget].w = +e.target.value;
      pcQ('#pc-w-o').textContent = pcPref[pcTarget].w + '%';
      pcSavePref(); pcRender();
    });
    pcQ('#pc-pos-reset').addEventListener('click', () => { pcPos[pcTarget].dx = 0; pcPos[pcTarget].dy = 0; pcRender(); });
    pcQ('#pc-mode').addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) pcSetMode(b.dataset.m); });
    pcQ('#pc-save').addEventListener('click', pcSave);
    if (window.ResizeObserver) new ResizeObserver(() => { if (pcIsOpen()) { layoutPc(); pcRender(); } }).observe(el);
  }

  function openPc() {
    if (!bible) return;
    closeSpot();
    if (!pcEl) buildPc();
    // 지금 읽는 곳의 구절로 시작한다. 같은 구절이면 직접 고쳐 쓴 본문을 그대로 둔다.
    const r = hereRange();
    pcv.bi = r.bi; pcv.c = r.c1; pcv.v1 = r.v1; pcv.v2 = r.v1;
    if (!pcDateStr) pcDateStr = pcToday();
    pcQ('#pc-date').value = pcDateStr;
    pcQ('#pc-cap').value = pcCaption;
    pcQ('#pc-ref').value = '';
    pcQ('#pc-refmsg').hidden = true;
    pcFillVerseSelects();
    if (pcMode === 'photo' && !pcPhoto) pcMode = 'text';
    pcEl.hidden = false;
    pcEl.dataset.tab = 'l';
    pcEl.querySelectorAll('.pc-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === 'l'));
    pcRefill();
    pcSync();
    layoutPc();
    pcEnsureFonts();
    pcRender();
    setTimeout(() => { layoutPc(); pcRender(); }, 120);
  }
  function closePc() {
    if (!pcEl) return;
    pcEl.hidden = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  // ---------- 모임 장소(카페) 지도 ----------
  // 운영자(본인)가 아는 카페·모임 장소를 직접 등록하고, 내 위치 기준 가까운 순으로 보고, 지도에서 위치를 확인하고, 길찾기(네이버 지도)로 길을 찾는다.
  // 장소는 이 기기(bf.places)에만 저장하며 데이터 백업에 함께 들어간다. 지도 그림은 벡터 방식(MapLibre, lib/에 포함)이 공개 지도 자료(OpenFreeMap)를 인터넷에서 받아 그리므로 인터넷이 있어야 보이고,
  // 인터넷이 없어도 목록·등록·거리 계산은 된다. 내 위치·주소 찾기·다른 지도 앱 열기는 아이폰 앱(껍데기)이 맡는다(window.bfLocation / bfGeo).
  const MP_AMEN = [['out', '콘센트'], ['wifi', '와이파이'], ['group', '단체석'], ['quiet', '조용함'], ['park', '주차'], ['room', '별실']];
  const MP_AMEN_NAME = {}; MP_AMEN.forEach((a) => { MP_AMEN_NAME[a[0]] = a[1]; });
  const MP_MAX = 500;
  const MP_VIEW0 = { lat: 37.5665, lng: 126.978, z: 12 };   // 장소도 내 위치도 아직 없을 때의 첫 화면: 서울 중심
  // 지도 그림은 벡터 방식(B) 하나뿐이다: 도로·건물·글자를 MapLibre가 직접 그리고, 키 없는 공개 자료(OpenFreeMap)를 쓴다. 테마(종이·세피아·야간)마다 스타일(mapstyle.js)이 따로 있다.
  // v68: 그림 조각(타일)을 받아 보여 주는 래스터(A) 방식과 CARTO 열쇠 입력은 앱에서 없앴다. 문제가 생겨 필요해지면 docs/emergency-raster/README.md 의 순서대로 되살린다.
  const MP_NOTE_VEC = '지도 자료를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. 목록과 핀 위치는 그대로 쓸 수 있습니다.';
  const MP_VEC_ATTR = '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const MP_VEC_WAIT = 15000;   // 이 시간 안에 첫 그림이 안 나오면 실패로 본다(ms)
  const MP_VEC_WHY = {
    gl: '이 기기의 웹뷰에서 벡터 지도(WebGL)를 쓸 수 없어',
    lib: '벡터 지도 부품을 불러오지 못해',
    net: '벡터 지도 자료를 받지 못해',
    time: '벡터 지도가 제때 그려지지 않아',
  };
  let mpVecFail = '', mpVecInfo = '';   // 벡터가 안 된 이유(MP_VEC_WHY의 키)와 진단 한 줄. 값이 있으면 지도 바탕은 비어 있다(핀·목록은 그대로). 지도를 다시 열 때마다 비우고 한 번 더 시도한다.
  const MP_COLOR_NAME = ['기본', '빨강', '주황', '노랑', '초록', '청록', '파랑', '보라', '분홍'];   // 내 장소 핀 색(0 = 테마 강조색). 실제 색은 style.css 의 --pc1~8 (테마별)
  const MP_PIN = '<svg viewBox="0 0 36 44" aria-hidden="true"><path class="pn" d="M18 43C18 43 3 27.6 3 17.4 3 8.9 9.7 2.5 18 2.5s15 6.4 15 14.9C33 27.6 18 43 18 43z"/>' +
    '<g class="cup"><path d="M11 13.2h12v5.4a4.8 4.8 0 0 1-4.8 4.8h-2.4a4.8 4.8 0 0 1-4.8-4.8z"/><path d="M23 14.6h1a2.3 2.3 0 0 1 0 4.6h-1.2"/><path d="M14 9.6v1.6M17 9.6v1.6M20 9.6v1.6"/></g></svg>';

  // 저장된 장소를 검사해 쓸 수 있는 것만 남긴다 (저장소·백업 어디서 읽어도 같은 검사)
  function mpClean(list) {
    const out = [], seen = new Set();
    const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
    (Array.isArray(list) ? list : []).slice(0, MP_MAX).forEach((p) => {
      if (!p || typeof p !== 'object') return;
      const lat = typeof p.lat === 'number' ? p.lat : NaN, lng = typeof p.lng === 'number' ? p.lng : NaN;
      const name = str(p.name, 60);
      if (!name || !(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) return;
      let id = typeof p.id === 'string' && /^[\w-]{1,24}$/.test(p.id) ? p.id : newId();
      while (seen.has(id)) id = newId();
      seen.add(id);
      const cap = Math.round(+p.cap);
      out.push({
        id, name, lat, lng, addr: str(p.addr, 120), tel: str(p.tel, 30), hours: str(p.hours, 80),
        cap: cap > 0 && cap <= 999 ? cap : 0,
        amen: Array.isArray(p.amen) ? MP_AMEN.map((a) => a[0]).filter((k) => p.amen.indexOf(k) >= 0) : [],
        memo: str(p.memo, 1000),
        col: Number.isInteger(p.col) && p.col >= 1 && p.col < MP_COLOR_NAME.length ? p.col : 0,   // 예전 저장·백업에는 없다 → 0(기본)
        ts: Number.isFinite(+p.ts) && +p.ts > 0 ? +p.ts : Date.now(),
      });
    });
    return out;
  }
  const mpDB = { items: (() => { try { return mpClean(JSON.parse(localStorage.getItem('bf.places'))); } catch (e) { return []; } })() };
  const mpSave = () => store.set('bf.places', mpDB.items);

  // ---------- 장소 리뷰 (v63) ----------
  // 평점(별 1~5개, 필수) + 100자 이하 한 줄(선택). 장소마다 이 기기에서 하나만 남기며, 이 기기(bf.reviews)에만 저장돼 다른 사람에게 보이지 않는다.
  // 관리자는 설정 → 고급설정 → '리뷰 모아 보기'에서 다른 기기가 내보낸 리뷰 글을 붙여 넣어 모두 모아 볼 수 있다(서버는 쓰지 않는다).
  const RV_LS = 'bf.reviews', RV_IN_LS = 'bf.reviews.in', RV_DID_LS = 'bf.did', RV_MAX = 100;
  const rvChars = (s) => Array.from(typeof s === 'string' ? s : '');                              // 글자 수는 이모지도 한 글자로 센다
  const rvStr = (s, n) => rvChars(typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '').slice(0, n).join('');
  const rvNum = (v) => (Number.isFinite(+v) && v !== null && v !== '' ? +(+v).toFixed(5) : null);
  function rvClean(list, withDid) {
    const out = [], seen = new Set();
    (Array.isArray(list) ? list : []).forEach((x) => {
      if (!x || typeof x.k !== 'string' || !x.k || x.k.length > 160) return;
      const did = withDid ? (typeof x.did === 'string' && /^[a-z0-9]{4,12}$/.test(x.did) ? x.did : '') : '';
      if (withDid && !did) return;
      const id = did + '|' + x.k;
      const r = Math.round(+x.r);
      if (seen.has(id) || !(r >= 1 && r <= 5)) return;
      seen.add(id);
      const rec = { k: x.k, n: rvStr(x.n, 80), la: rvNum(x.la), lo: rvNum(x.lo), r, t: rvStr(x.t, RV_MAX), ts: Number.isFinite(+x.ts) ? +x.ts : Date.now() };
      if (withDid) rec.did = did;
      out.push(rec);
    });
    return out.slice(0, 5000);
  }
  const rvLoad = (key, withDid) => { try { return rvClean(JSON.parse(localStorage.getItem(key)), withDid); } catch (e) { return []; } };
  const rvDB = { items: rvLoad(RV_LS, false), inc: rvLoad(RV_IN_LS, true) };
  const rvSave = () => { store.set(RV_LS, rvDB.items); store.set(RV_IN_LS, rvDB.inc); };
  function rvDid() {   // 이 기기를 구별하는 임의의 짧은 글(이름·전화번호와 무관)
    let d = '';
    try { d = localStorage.getItem(RV_DID_LS) || ''; } catch (e) { d = ''; }
    if (!/^[a-z0-9]{4,12}$/.test(d)) {
      d = Math.random().toString(36).slice(2, 8).padEnd(6, 'x');
      try { localStorage.setItem(RV_DID_LS, d); } catch (e) { /* 무시 */ }
    }
    return d;
  }
  const rvFind = (k) => rvDB.items.find((x) => x.k === k) || null;
  function rvPut(spec, r, t) {
    const rec = { k: spec.k, n: rvStr(spec.n, 80), la: rvNum(spec.la), lo: rvNum(spec.lo), r, t: rvStr(t, RV_MAX), ts: Date.now() };
    const i = rvDB.items.findIndex((x) => x.k === spec.k);
    if (i >= 0) rvDB.items[i] = rec; else rvDB.items.push(rec);
    rvSave();
  }
  function rvDel(k) {
    const n = rvDB.items.length;
    rvDB.items = rvDB.items.filter((x) => x.k !== k);
    if (rvDB.items.length !== n) rvSave();
  }
  const rvStars = (r) => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
  const rvKey = (kind, name, lat, lng) => kind + ':' + String(name).slice(0, 80) + '|' + (+lat).toFixed(5) + ',' + (+lng).toFixed(5);   // 카페·보드게임 카페(자료 파일의 한 줄)
  let rvDraft = null;   // 쓰는 중인 내용 { k, r, t } — 카드가 다시 그려져도(내 위치 갱신 등) 입력이 사라지지 않게 남겨 둔다
  let rvDelArm = '', rvDelTimer = null;
  // 카드 안의 리뷰 칸. spec = { k, n, la, lo }
  // v72: 카드의 '나만의 리뷰' 단추(btn)는 단추 줄(길찾기 등과 같은 크기의 한 칸)에 늘 있고, 쓴 리뷰·입력 칸(box)은 단추 줄 위에 펼쳐진다.
  function rvMount(box, spec, btn) {
    if (!box) return;
    const draw = () => {
      const mine = rvFind(spec.k), d = rvDraft && rvDraft.k === spec.k ? rvDraft : null;
      if (d) {
        const n = rvChars(d.t).length;
        box.innerHTML = '<div class="mp-rv-form">' +
          '<div class="mp-rv-h">' + (mine ? '나만의 리뷰 고치기' : '나만의 리뷰 남기기') + ' <small>이 기기에만 저장됩니다</small></div>' +
          '<div class="mp-rv-stars" role="radiogroup" aria-label="평점">' + [1, 2, 3, 4, 5].map((i) =>
            '<button type="button" class="mp-st' + (i <= d.r ? ' on' : '') + '" data-r="' + i + '" role="radio" aria-checked="' + (i === d.r ? 'true' : 'false') + '" aria-label="' + i + '점">' + (i <= d.r ? '★' : '☆') + '</button>').join('') +
            '<span class="mp-rv-sc">' + (d.r ? d.r + '점' : '별을 눌러 평점을 고르세요') + '</span></div>' +
          '<textarea class="mp-rv-in" rows="2" placeholder="한 줄 리뷰 (선택, 100자 이하)" aria-label="리뷰 문구">' + esc(d.t) + '</textarea>' +
          '<div class="mp-rv-n"><span id="mp-rv-cnt">' + n + '</span> / ' + RV_MAX + '</div>' +
          '<div class="mp-rv-b"><button type="button" class="mp-rb edit" data-a="save"' + (d.r ? '' : ' disabled') + '>저장</button>' +
          '<button type="button" class="mp-rb" data-a="cancel">취소</button>' +
          (mine ? '<button type="button" class="mp-rb" data-a="del">' + (rvDelArm === spec.k ? '한 번 더 누르면 삭제' : '삭제') + '</button>' : '') + '</div></div>';
      } else if (mine) {
        box.innerHTML = '<div class="mp-rv-row"><span class="mp-rv-s" role="img" aria-label="내 평점 ' + mine.r + '점">' + rvStars(mine.r) + '</span><b>나만의 리뷰</b><span class="mp-rv-sp"></span>' +
          '<button type="button" class="mp-rv-ch" data-a="edit">수정</button></div>' + (mine.t ? '<div class="mp-rv-t">' + esc(mine.t) + '</div>' : '');
      } else {
        box.innerHTML = '';
      }
      box.hidden = !(d || mine);   // 리뷰도 입력 중인 글도 없으면 칸 자체를 접어 카드 높이를 늘리지 않는다
      if (btn) {
        btn.classList.toggle('on', !!d);
        btn.setAttribute('aria-expanded', d ? 'true' : 'false');
        btn.setAttribute('aria-label', mine ? '나만의 리뷰 고치기' : '나만의 리뷰 남기기');
      }
      bind();
      if (typeof mpCardFit === 'function' && mpEl) mpCardFit();
      if (d) requestAnimationFrame(() => { const f = box.querySelector('.mp-rv-form'); if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' }); });   // 카드가 작은 화면에서는 입력 칸이 보이게 카드를 스크롤
    };
    const bind = () => {
      const ta = box.querySelector('.mp-rv-in'), save = box.querySelector('[data-a="save"]');
      if (ta) ta.addEventListener('input', () => {
        const ch = rvChars(ta.value);
        if (ch.length > RV_MAX) { ta.value = ch.slice(0, RV_MAX).join(''); }
        rvDraft.t = ta.value;
        const c = box.querySelector('#mp-rv-cnt'); if (c) c.textContent = rvChars(ta.value).length;
      });
      box.querySelectorAll('.mp-st').forEach((b) => b.addEventListener('click', () => {
        rvDraft.r = +b.dataset.r;
        box.querySelectorAll('.mp-st').forEach((x) => { const on = +x.dataset.r <= rvDraft.r; x.classList.toggle('on', on); x.textContent = on ? '★' : '☆'; x.setAttribute('aria-checked', String(+x.dataset.r === rvDraft.r)); });
        const sc = box.querySelector('.mp-rv-sc'); if (sc) sc.textContent = rvDraft.r + '점';
        if (save) save.disabled = false;
      }));
      box.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
        const a = b.dataset.a, mine = rvFind(spec.k);
        if (a === 'new' || a === 'edit') { rvDraft = { k: spec.k, r: mine ? mine.r : 0, t: mine ? mine.t : '' }; rvDelArm = ''; draw(); return; }
        if (a === 'cancel') { rvDraft = null; rvDelArm = ''; draw(); return; }
        if (a === 'save') { if (!rvDraft || !rvDraft.r) return; rvPut(spec, rvDraft.r, rvDraft.t); rvDraft = null; rvDelArm = ''; draw(); return; }
        if (a === 'del') {
          if (rvDelArm !== spec.k) { rvDelArm = spec.k; clearTimeout(rvDelTimer); rvDelTimer = setTimeout(() => { rvDelArm = ''; if (box.isConnected) draw(); }, 4000); draw(); return; }
          rvDel(spec.k); rvDraft = null; rvDelArm = ''; draw();
        }
      }));
    };
    if (btn) btn.addEventListener('click', () => {   // 이미 쓰는 중이면 입력 칸으로, 아니면 새로(또는 쓴 글을 고치러) 연다
      if (rvDraft && rvDraft.k === spec.k) { const t = box.querySelector('.mp-rv-in'); if (t) t.focus(); return; }
      const mine = rvFind(spec.k);
      rvDraft = { k: spec.k, r: mine ? mine.r : 0, t: mine ? mine.t : '' }; rvDelArm = ''; draw();
    });
    draw();
  }
  // 관리자 화면: 이 기기 + 불러온 다른 기기의 리뷰를 모두 합친 목록
  function rvAll() {
    const me = rvDid();
    return rvDB.items.map((x) => Object.assign({}, x, { did: me, mine: true })).concat(rvDB.inc.map((x) => Object.assign({}, x, { mine: false })));
  }
  function rvExportText() { return JSON.stringify({ app: 'bibleflip-reviews', ver: 1, did: rvDid(), savedAt: new Date().toISOString(), reviews: rvDB.items }); }
  // 다른 기기가 내보낸 글을 불러온다. 같은 기기에서 온 것이 이미 있으면 그 기기의 리뷰를 통째로 새것으로 바꾼다. 잘못된 글이면 오류를 던진다.
  function rvImport(text) {
    let d; try { d = JSON.parse(String(text).trim()); } catch (e) { d = null; }
    if (!d || d.app !== 'bibleflip-reviews' || !Array.isArray(d.reviews) || typeof d.did !== 'string' || !/^[a-z0-9]{4,12}$/.test(d.did)) {
      throw new Error('리뷰 내용이 아닙니다. 상대가 「이 기기의 리뷰 내보내기」로 복사한 글을 처음부터 끝까지 붙여 넣었는지 확인해 주세요.');
    }
    if (d.did === rvDid()) throw new Error('이 기기에서 내보낸 글입니다. 다른 기기의 글을 붙여 넣어 주세요.');
    const list = rvClean(d.reviews.map((x) => Object.assign({}, x, { did: d.did })), true);
    rvDB.inc = rvDB.inc.filter((x) => x.did !== d.did).concat(list);
    rvSave();
    return { did: d.did, n: list.length };
  }
  function rvCsv() {
    const q = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const me = rvDid();
    return ['장소,위도,경도,평점,문구,기기,날짜'].concat(rvAll().sort((a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : a.ts - b.ts).map((x) =>
      [q(x.n), q(x.la), q(x.lo), x.r, q(x.t), q(x.did === me ? me + '(이 기기)' : x.did), q(new Date(x.ts).toISOString().slice(0, 10))].join(','))).join('\n');
  }
  function showReviews() {
    sheetTitle.textContent = '리뷰 모아 보기';
    backBtn.hidden = false;
    sheetBack = () => { showAdvanced(); sheetBody.scrollTop = 0; };
    const me = rvDid(), all = rvAll(), groups = new Map();
    all.forEach((x) => { if (!groups.has(x.k)) groups.set(x.k, []); groups.get(x.k).push(x); });
    const gl = [...groups.values()].map((g) => ({ name: g[0].n || '(이름 없음)', list: g.sort((a, b) => b.ts - a.ts), avg: g.reduce((s, x) => s + x.r, 0) / g.length }))
      .sort((a, b) => b.list.length - a.list.length || b.avg - a.avg || (a.name < b.name ? -1 : 1));
    const devs = new Set(all.map((x) => x.did));
    const SHOW = 150;
    sheetBody.innerHTML =
      '<p class="note tight">장소 리뷰(별점 + 100자 이하 한 줄)는 <b>각자의 기기에만</b> 저장되고 다른 사람에게는 보이지 않습니다. ' +
      '관리자는 사용자가 아래 「내보내기」로 복사해 보낸 글을 「모으기」에 붙여 넣어 모든 리뷰를 한곳에서 볼 수 있습니다. (서버로 자동 수집되지는 않습니다)</p>' +
      '<div class="adv-head">모아 본 리뷰 <small class="sub">(' + all.length + '개 · 장소 ' + groups.size + '곳 · 기기 ' + devs.size + '대)</small></div>' +
      (gl.length ? gl.slice(0, SHOW).map((g) => '<div class="rv-g"><div class="rv-gh"><strong>' + esc(g.name) + '</strong><span class="rv-av">★ ' + g.avg.toFixed(1) + ' · ' + g.list.length + '개</span></div>' +
        g.list.map((x) => '<div class="rv-r"><span class="rv-s">' + rvStars(x.r) + '</span>' + (x.t ? '<span class="rv-t">' + esc(x.t) + '</span>' : '<span class="rv-t sub">(문구 없음)</span>') +
          '<small class="rv-w">' + (x.did === me ? '이 기기' : '기기 ' + esc(x.did)) + ' · ' + new Date(x.ts).toISOString().slice(0, 10) + '</small></div>').join('') + '</div>').join('') +
        (gl.length > SHOW ? '<p class="note tight">장소 ' + (gl.length - SHOW) + '곳은 화면에 다 싣지 못했습니다. 아래 「표(CSV) 복사」로 전체를 확인하세요.</p>' : '')
        : '<p class="note">아직 모인 리뷰가 없습니다. 지도의 장소 카드에서 「리뷰 남기기」를 눌러 남길 수 있습니다.</p>') +
      '<div class="adv-head">이 기기의 리뷰 내보내기 <small class="sub">(' + rvDB.items.length + '개 · 기기 번호 ' + me + ')</small></div>' +
      '<p class="adv-desc">사용자가 보내는 쪽입니다. 복사해서 관리자에게 카카오톡 등으로 보내 주세요. 내용은 장소 이름·위치·별점·문구뿐이며 이름이나 전화번호는 들어 있지 않습니다.</p>' +
      '<textarea id="rv-out" class="bk-text" rows="3" readonly aria-label="내보낼 리뷰 내용"></textarea>' +
      '<div class="row"><span id="rv-out-msg" class="sub">&nbsp;</span><button class="seg-btn" id="rv-copy" type="button">리뷰 복사</button></div>' +
      '<div class="adv-head">다른 기기의 리뷰 모으기 <small class="sub">(관리자용)</small></div>' +
      '<p class="adv-desc">받은 글을 아래 상자에 붙여 넣으세요. 같은 기기의 글을 다시 붙여 넣으면 그 기기의 리뷰가 새 내용으로 바뀝니다. 이 기기의 리뷰에는 영향이 없습니다.</p>' +
      '<textarea id="rv-in" class="bk-text" rows="3" placeholder="여기에 붙여 넣기" aria-label="모을 리뷰 내용"></textarea>' +
      '<div class="row"><span id="rv-in-msg" class="sub">&nbsp;</span><button class="seg-btn" id="rv-apply" type="button">모으기</button></div>' +
      '<div class="adv-head">표로 보기</div>' +
      '<div class="row"><span id="rv-csv-msg" class="sub">전체 리뷰를 표(CSV)로 복사해 엑셀·구글 시트에 붙일 수 있습니다.</span><button class="seg-btn" id="rv-csv" type="button">표(CSV) 복사</button></div>' +
      '<div class="row"><span class="sub">모아 온 다른 기기의 리뷰 ' + rvDB.inc.length + '개</span><button class="seg-btn" id="rv-clear" type="button"' + (rvDB.inc.length ? '' : ' disabled') + '>모아 온 리뷰 지우기</button></div>';
    const out = $('#rv-out'), inp = $('#rv-in'), outMsg = $('#rv-out-msg'), inMsg = $('#rv-in-msg');
    out.value = rvExportText();
    const copy = async (text, ta, msgEl, okMsg) => {
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        try { ta.value = text; ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      }
      msgEl.textContent = ok ? okMsg : '복사가 안 됐습니다. 상자를 길게 눌러 전체 선택 → 복사하세요.';
    };
    $('#rv-copy').addEventListener('click', () => copy(out.value, out, outMsg, '복사했습니다. 관리자에게 붙여 넣어 보내세요.'));
    $('#rv-csv').addEventListener('click', () => copy(rvCsv(), out, $('#rv-csv-msg'), '표를 복사했습니다. 엑셀·시트에 붙여 넣으세요.'));
    $('#rv-apply').addEventListener('click', () => {
      if (!inp.value.trim()) { inMsg.textContent = '붙여 넣은 내용이 없습니다.'; return; }
      try {
        const r = rvImport(inp.value);
        showReviews(); sheetBody.scrollTop = 0;
        $('#rv-in-msg').textContent = '기기 ' + r.did + '의 리뷰 ' + r.n + '개를 모았습니다.';
      } catch (err) { inMsg.textContent = err.message || '모으지 못했습니다.'; }
    });
    let armed = 0, armTimer = null;
    $('#rv-clear').addEventListener('click', () => {
      const b = $('#rv-clear');
      if (!armed) { armed = 1; b.textContent = '한 번 더 누르면 지움'; clearTimeout(armTimer); armTimer = setTimeout(() => { armed = 0; b.textContent = '모아 온 리뷰 지우기'; }, 4000); return; }
      clearTimeout(armTimer); armed = 0;
      rvDB.inc = []; rvSave(); showReviews(); sheetBody.scrollTop = 0;
    });
  }
  const mpFind = (id) => mpDB.items.find((p) => p.id === id) || null;

  // 두 지점 사이 거리(m)
  function mpDist(a, b) {
    const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const mpFmtDist = (m) => (m < 1000 ? Math.max(10, Math.round(m / 10) * 10) + 'm' : (m < 10000 ? (m / 1000).toFixed(1) : String(Math.round(m / 1000))) + 'km');
  const mpInKorea = (p) => p.lat >= 31.43 && p.lat <= 44.35 && p.lng >= 122.37 && p.lng <= 132;   // 네이버 지도 앱 주소가 받는 좌표 범위

  // ----- 아이폰 앱(껍데기)과 주고받기 -----
  const mpBridge = () => (NATIVE && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bf) || null;
  let mpReqId = 0, mpLocWait = null, mpLocP = null;
  const mpPending = {};   // 주소 찾기 요청 번호 → 결과를 받을 함수
  window.bfGeo = (r) => { const f = r && mpPending[r.id]; if (f) { delete mpPending[r.id]; f(r); } };
  window.bfLocation = (r) => { const f = mpLocWait; mpLocWait = null; if (f) f(r || { error: 'fail' }); };
  // 현재 위치를 한 번 읽는다 → { lat, lng, acc } 또는 { error: 'denied' | 'fail' | 'timeout' }
  function mpLocate() {
    if (mpLocP) return mpLocP;
    mpLocP = new Promise((resolve) => {
      let done = false, timer = 0;
      const fin = (r) => { if (done) return; done = true; clearTimeout(timer); mpLocWait = null; resolve(r); };
      timer = setTimeout(() => fin({ error: 'timeout' }), 60000);   // 처음에는 위치 허용 창에서 답하는 시간도 필요하다
      const br = mpBridge();
      if (br) { mpLocWait = fin; try { br.postMessage({ loc: 1 }); } catch (e) { fin({ error: 'fail' }); } return; }
      if (!navigator.geolocation) { fin({ error: 'fail' }); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => fin({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
        (e) => fin({ error: e && e.code === 1 ? 'denied' : 'fail' }),
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 20000 });
    }).then((r) => { mpLocP = null; return r; });
    return mpLocP;
  }
  // 주소·이름 → 좌표(kind 'q') / 좌표 → 주소(kind 'r') → { results: [{ name, addr, lat, lng }] } 또는 { error }
  function mpGeo(kind, arg) {
    return new Promise((resolve) => {
      const br = mpBridge();
      if (br) {
        const id = ++mpReqId;
        const timer = setTimeout(() => { delete mpPending[id]; resolve({ error: 'timeout' }); }, 25000);
        mpPending[id] = (r) => { clearTimeout(timer); resolve(r); };
        try { br.postMessage(kind === 'q' ? { geocode: arg, id } : { rgeo: arg, id }); }
        catch (e) { clearTimeout(timer); delete mpPending[id]; resolve({ error: 'fail' }); }
        return;
      }
      // 웹(브라우저)에서는 OpenStreetMap의 주소 검색(Nominatim)을 쓴다. 버튼을 누를 때만 한 번씩 부른다.
      const url = kind === 'q'
        ? 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ko&q=' + encodeURIComponent(arg)
        : 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ko&lat=' + arg.lat + '&lon=' + arg.lng;
      fetch(url).then((r) => r.json()).then((j) => {
        const list = Array.isArray(j) ? j : [j];
        resolve({ results: list.filter((x) => x && x.lat && x.lon).slice(0, 5).map((x) => ({ name: x.name || '', addr: x.display_name || '', lat: +x.lat, lng: +x.lon })) });
      }).catch(() => resolve({ error: 'network' }));
    });
  }
  // 다른 지도 앱·전화 열기. 앱이 없어 안 열리면 fallback(웹 주소)로 연다.
  function mpOpen(url, fallback) {
    const br = mpBridge();
    if (br) { try { br.postMessage({ open: url, fallback: fallback || '' }); return; } catch (e) { /* 아래로 */ } }
    if (/^tel:/.test(url)) { location.href = url; return; }
    window.open(fallback || url, '_blank', 'noopener');
  }
  // 길찾기(v61: 카드 단추는 '길찾기' 하나). 한국 안이면 네이버 지도 앱의 대중교통 길찾기로 열고, 출발지는 일부러 넣지 않는다 —
  // 네이버 지도 URL 스킴은 출발지(slat·slng·sname)를 생략하면 지금 내 위치를 출발지로 쓴다. 앱이 없어 안 열리면 네이버 지도 웹의 장소 검색 주소로 연다(웹 길찾기 주소는 공식 문서가 없다).
  // 한국 밖(네이버 지도가 길찾기를 못 하는 좌표)이면 구글 지도 길찾기로 연다.
  // 정보 보기용 검색어(v73): 가게 이름 + 주소의 시·군·구(같은 이름의 다른 지점이 섞이지 않게). 예) "스타벅스 천호역점 강동구"
  // 주소는 '서울특별시 강동구 강동대로 229'처럼 시·도로 시작하므로, 그 뒤에서 '시·군·구'로 끝나는 낱말을 앞에서부터 이어 붙이고 도로명이 나오면 멈춘다.
  function mpInfoQuery(p) {
    const w = (p.addr || '').trim().split(/\s+/).slice(1), reg = [];
    for (const t of w) { if (/[시군구]$/.test(t)) reg.push(t); else break; }
    return p.name + (reg.length ? ' ' + reg.join(' ') : '');
  }
  function mpLinks(p) {
    const n = encodeURIComponent(p.name), la = p.lat.toFixed(6), lo = p.lng.toFixed(6), q = encodeURIComponent(mpInfoQuery(p));
    return {
      route: mpInKorea(p)
        ? ['nmap://route/public?dlat=' + la + '&dlng=' + lo + '&dname=' + n + '&appname=com.choice0829.bibleflip', 'https://map.naver.com/p/search/' + n]
        : ['https://www.google.com/maps/dir/?api=1&destination=' + la + ',' + lo, ''],
      // 정보 보기(v73): 지도 앱의 통합 검색으로 연다 — 영업 여부·시간·전화·사진·리뷰는 지도 앱이 보여 준다. 앱이 없으면 네이버 지도 웹 검색으로.
      info: mpInKorea(p)
        ? ['nmap://search?query=' + q + '&appname=com.choice0829.bibleflip', 'https://map.naver.com/p/search/' + q]
        : ['https://www.google.com/maps/search/?api=1&query=' + q, ''],
    };
  }
  const mpLocErr = (e) => (e === 'denied'
    ? (NATIVE ? '위치 사용이 꺼져 있습니다. 아이폰 설정 → 책장성경 → 위치에서 "앱을 사용하는 동안"을 선택해 주세요.' : '위치 사용이 허용되지 않았습니다. 브라우저 설정에서 이 사이트의 위치를 허용해 주세요.')
    : '현재 위치를 가져오지 못했습니다. 잠시 뒤 다시 눌러 보세요. (실내·지하에서는 늦을 수 있습니다)');

  // ----- 화면 상태 -----
  let mpEl = null, mpMap = null, mpVec = null, mpVecP = null, mpNoteHold = 0, mpTileSig = '', mpPinLayer = null, mpMeLayer = null, mpDraftMk = null, mpLeafP = null, mpZoomCtl = null, mpPlacedTwo = null;
  const mpMk = {};                        // 장소 id → 지도 핀
  let mpMe = null;                        // 내 위치 { lat, lng, acc }
  let mpLocState = 'idle';                // idle | busy | ok | denied | fail
  let mpSel = null;                       // 고른 장소 id
  let mpSearch = '';                      // 목록 검색어
  const mpFilt = new Set();               // 켜 둔 편의 항목 필터
  let mpView = 'list';                    // 'list' | 'form'
  let mpEditId = null;                    // 수정 중인 장소 id (null이면 새로 추가)
  const mpDraft = { lat: NaN, lng: NaN }; // 입력 중인 장소의 위치
  let mpFormAmen = new Set();
  let mpFormCol = 0;                      // 입력 중인 장소의 핀 색(0 = 기본)
  let mpFormInit = '';
  let mpPicking = false;
  let mpUserMoved = false, mpTileErr = 0, mpDelArm = 0, mpDelTimer = 0;
  // 카페 층(공공데이터 상가정보에서 걸러 앱에 넣은 data/cafes.json: 서울은 모든 카페, 서울 밖은 스타벅스·투썸). 내 장소 목록과 따로 지도 위 점으로만 보인다.
  // 점은 모두 같은 색이고, '프랜차이즈'(목록에 있는 체인) / '개인'(그 밖의 카페)으로 걸러 볼 수 있다. 내 장소(저장한 곳)는 핀으로, 고른 색으로 보인다.
  const MP_BR_LS = 'bf.mapbrand';          // 'off' 이면 끔(기본은 켬). 이 기기만 · 백업 제외
  const MP_BRF_LS = 'bf.mapbrandf';        // 카페 종류 보기: 'all'(기본) | 'fr'(프랜차이즈) | 'ind'(개인). 이 기기만 · 백업 제외
  const MP_BR_FILES = ['data/cafes.json', 'data/brandcafes.json'];   // 앞에서부터 찾는다(없으면 다음 것). 뒤의 것은 옛 형식(스타벅스·투썸만)
  const MP_BR_MINZ = 15;                   // 이 확대 수준보다 멀리서 보면 점을 그리지 않는다(한 화면에 너무 많아짐)
  const MP_BR_MAX = 900;                   // 한 번에 그리는 점의 최대 수(넘으면 화면 가운데에서 가까운 순)
  const MP_BR_CELL = 0.05;                 // 위치 찾기용 격자 크기(도). 약 4~5km
  // 보드게임 카페 층: 카페 층과 따로 켜고 끄는 별도 층(data/boardgame.json, 서울). 점 색이 다르고 단추(주사위)도 따로 있다. 같은 캔버스에 그려 점 누르기가 겹치지 않는다.
  const MP_BG_LS = 'bf.mapbg';             // 'off' 이면 끔(기본은 켬). 이 기기만 · 백업 제외
  const MP_BG_FILE = 'data/boardgame.json';
  const MP_BG_MINZ = 13;                   // 자료가 적어(서울 전체에 수백 곳) 카페 층보다 멀리서부터 보인다
  const MP_BG_MAX = 600;                   // 한 번에 그리는 점의 최대 수(넘으면 화면 가운데에서 가까운 순)
  let mpBgDB = null, mpBgP = null, mpBgState = 'idle', mpBgLayer = null, mpBgSel = -1, mpBgSelMk = null, mpBgCapped = false;   // 상태: idle | loading | ok | none(파일 없음 → 단추도 숨김) | err
  const mpBgOn = () => { try { return localStorage.getItem(MP_BG_LS) !== 'off'; } catch (e) { return true; } };
  // 지하철역 층(v64): 벡터 지도에서만 있는 층(역 아이콘). 카페·보드게임처럼 따로 켜고 끈다. 환승역은 같은 이름끼리 한 곳으로 합쳐 하나만 그린다(mapstyle.js merge).
  const MP_SW_LS = 'bf.mapsubway';         // 'off' 이면 끔(기본은 켬). 이 기기만 · 백업 제외
  const mpSwOn = () => { try { return localStorage.getItem(MP_SW_LS) !== 'off'; } catch (e) { return true; } };
  let mpSwData = null, mpSwSig = '';      // 마지막으로 합친 역 목록(GeoJSON)과 그 서명 — 테마를 바꿔 지도를 새로 만들 때 바로 쓴다
  let mpBrDB = null, mpBrIdx = null, mpBrState = 'idle', mpBrP = null, mpBrLayer = null, mpBrRend = null, mpBrSel = -1, mpBrSelMk = null, mpBrCapped = false;   // 상태: idle | loading | ok | none(파일 없음) | err
  const mpBrOn = () => { try { return localStorage.getItem(MP_BR_LS) !== 'off'; } catch (e) { return true; } };
  const mpBrFiltRaw = () => { try { const v = localStorage.getItem(MP_BRF_LS); return v === 'fr' || v === 'ind' ? v : 'all'; } catch (e) { return 'all'; } };
  // 개인 카페가 든 자료일 때만 종류 걸러 보기를 쓴다(옛 형식 자료는 늘 '전체')
  const mpBrFilt = () => (mpBrDB && mpBrDB.hasInd ? mpBrFiltRaw() : 'all');
  const mpIsOpen = () => !!mpEl && !mpEl.hidden;
  const mpS = (s) => mpEl.querySelector(s);
  const mpNarrow = () => !!mpEl && mpEl.classList.contains('narrow');

  function mpLoadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (mpLeafP) return mpLeafP;
    const load = (el, tag) => new Promise((resolve, reject) => { el.onload = () => resolve(); el.onerror = () => reject(new Error(tag)); document.head.appendChild(el); });
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'lib/leaflet.css';
    const js = document.createElement('script'); js.src = 'lib/leaflet.js';
    mpLeafP = Promise.all([load(css, 'leaflet.css'), load(js, 'leaflet.js')]).then(() => {}, (e) => { mpLeafP = null; throw e; });
    return mpLeafP;
  }
  const mpIcon = (kind, col) => L.divIcon({ className: 'mp-pin' + (kind ? ' ' + kind : '') + (col ? ' c' + col : ''), html: MP_PIN, iconSize: [36, 44], iconAnchor: [18, 42] });

  // 펼침 화면: 왼쪽에 떠 있는 목록·입력 창이 지도를 덮는다. 그 창의 오른쪽 끝까지의 폭(px). 창이 없거나 접혀 있으면 0.
  function mpPanelW() {
    if (!mpEl || !mpEl.classList.contains('two') || mpPicking) return 0;
    const pl = mpS(mpEl.dataset.view === 'form' ? '#mp-form' : '#mp-list');
    if (!pl || pl.hidden || !pl.offsetParent) return 0;
    const mr = mpS('.mp-mapwrap').getBoundingClientRect(), r = pl.getBoundingClientRect();
    return Math.max(0, Math.round(r.right - mr.left + 10));
  }
  // 지도를 옮긴다. 창에 가려지지 않은 부분의 가운데에 오도록 보정한다.
  function mpGo(lat, lng, zoom) {
    if (!mpMap) return;
    mpMap.invalidateSize();
    const off = mpPanelW() / 2;
    let c = L.latLng(lat, lng);
    if (off > 0) c = mpMap.unproject(mpMap.project(c, zoom).subtract([off, 0]), zoom);
    mpMap.setView(c, zoom, { animate: false });
  }
  // 지금 테마에 맞는 벡터 바탕으로 맞춘다. #mp 의 mp-src-vec 클래스는 벡터 바탕이 살아 있을 때만 붙고, 지하철 단추가 이 클래스를 본다.
  // 바탕이 그대로면(같은 테마) 지도를 건드리지 않는다. 테마가 바뀌면 바탕 층만 새로 만든다. 벡터가 안 되는 동안(mpVecFail)은 바탕 없이 핀·목록만 쓴다.
  function mpApplyTile() {
    if (!mpEl) return;
    mpEl.classList.toggle('mp-src-vec', !mpVecFail);
    if (!mpMap || !window.L || mpVecFail) return;
    const sig = 'vec|' + settings.theme;
    if (mpVec && mpTileSig === sig) return;
    if (!mpVecReady()) {   // 벡터 부품은 처음 쓸 때 받는다. 받는 동안은 지금 보이는 바탕을 그대로 둔다.
      mpLoadVector().then(() => { if (!mpVecFail) mpApplyTile(); }, (e) => (e && e.message === 'webgl' ? mpVecFailed('gl', '이 웹뷰에서 WebGL2를 쓸 수 없음') : mpVecFailed('lib', '받지 못한 파일: ' + String(e && e.message || '').replace(/^.*\//, ''))));
      return;
    }
    if (mpVec) { const old = mpVec; mpVec = null; try { mpMap.removeLayer(old); } catch (e) { /* 무시 */ } }
    mpTileSig = sig; mpTileErr = 0;
    const note = mpS('#mp-note');
    if (Date.now() >= mpNoteHold) { note.textContent = MP_NOTE_VEC; note.hidden = true; }
    mpAddVector();
  }
  // ----- 벡터 지도(B): maplibre-gl + 플러그인 + 테마 스타일(mapstyle.js)을 '벡터'를 골랐을 때만 불러온다 -----
  const mpVecReady = () => !!(window.maplibregl && window.L && L.MaplibreGL && window.bfMapStyle);
  function mpLoadVector() {
    if (mpVecReady()) return Promise.resolve();
    if (mpVecP) return mpVecP;
    // WebGL2가 없으면 부품을 받을 필요도 없이 바로 실패로 본다.
    let gl = null; try { gl = document.createElement('canvas').getContext('webgl2'); } catch (e) { gl = null; }
    if (!gl) return Promise.reject(new Error('webgl'));
    const js = (src) => new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = src; el.onload = () => resolve(); el.onerror = () => reject(new Error(src)); document.head.appendChild(el); });
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'lib/maplibre-gl.css'; document.head.appendChild(css);
    mpVecP = js('lib/maplibre-gl.js').then(() => js('lib/leaflet-maplibre-gl.js')).then(() => js('mapstyle.js'))
      .then(() => { if (!mpVecReady()) throw new Error('init'); }, (e) => { mpVecP = null; throw e; });
    return mpVecP;
  }
  // 벡터를 못 쓰는 이유를 기억하고, 바탕 층을 치우고, 안내문을 띄워 둔다. (래스터로 돌아가지 않는다 — 핀·목록은 그대로 쓸 수 있다)
  // 안내문은 지도를 닫았다 다시 열 때(openMp)까지 남는다. 다시 열면 한 번 더 시도한다.
  function mpVecFailed(why, info) {
    if (mpVecFail) return;   // 처음 실패한 이유만 기억한다
    mpVecFail = why; mpVecInfo = info || '';
    if (mpVec) { const old = mpVec; mpVec = null; try { if (mpMap) mpMap.removeLayer(old); } catch (e) { /* 무시 */ } }
    mpTileSig = '';
    if (!mpEl) return;
    mpEl.classList.remove('mp-src-vec');
    const n = mpS('#mp-note');
    n.innerHTML = esc((MP_VEC_WHY[why] || MP_VEC_WHY.time) + ' 지도 그림이 보이지 않습니다. 인터넷 연결을 확인한 뒤 지도를 닫았다가 다시 열어 주세요. 목록과 핀은 그대로 쓸 수 있습니다.') + (mpVecInfo ? '<br><small>' + esc(mpVecInfo) + '</small>' : '');
    n.hidden = false;
    mpNoteHold = Number.MAX_SAFE_INTEGER;
  }
  function mpAddVector() {
    const Layer = L.MaplibreGL.extend({ getAttribution() { return this.options.attribution; } });   // 출처 표시는 우리가 정한 글(MP_VEC_ATTR)로 고정
    let layer = null;
    try {
      layer = new Layer({ style: window.bfMapStyle.build(settings.theme, { subway: mpSwOn(), data: mpSwData }), attribution: MP_VEC_ATTR, fadeDuration: 0, maxPitch: 0 });
      mpVec = layer;
      layer.addTo(mpMap);
    } catch (e) { mpVec = null; mpVecFailed('gl', String(e && e.message || e).slice(0, 120)); return; }
    const gl = layer.getMaplibreMap();
    let loaded = false, errs = 0;
    const st = { style: false, src: false, tiles: 0, err: '' };   // 어디까지 진행됐는지(실패했을 때 진단 문구로 쓴다)
    const diag = () => '스타일 ' + (st.style ? '○' : '×') + ' · 자료 주소 ' + (st.src ? '○' : '×') + ' · 타일 ' + st.tiles + '개' + (st.err ? ' · 마지막 오류: ' + st.err : '');
    const alive = () => mpVec === layer && !!layer.getMaplibreMap();
    const timer = setTimeout(() => { if (alive() && !loaded) mpVecFailed('time', diag()); }, MP_VEC_WAIT);
    if (!gl) { clearTimeout(timer); mpVecFailed('gl', '지도 객체를 만들지 못함'); return; }
    gl.on('load', () => { loaded = true; clearTimeout(timer); });
    gl.on('styleimagemissing', (ev) => {   // 지하철 아이콘은 그림 파일 없이 mapstyle.js 가 그려 준다. 못 그려도 역 이름 글자는 나온다.
      try { const im = window.bfMapStyle.icon(ev && ev.id); if (im && !gl.hasImage(ev.id)) gl.addImage(ev.id, im.data, { pixelRatio: im.ratio }); } catch (e) { /* 무시 */ }
    });
    gl.on('styledata', () => { st.style = true; });
    gl.on('sourcedata', (ev) => { if (!ev || ev.sourceId !== window.bfMapStyle.SRC) return; if (ev.sourceDataType === 'metadata') st.src = true; if (ev.tile) st.tiles++; });   // 지하철 합친 목록(GeoJSON 원)의 알림은 세지 않는다
    gl.on('error', (ev) => {
      if (!alive()) return;
      { const er = ev && ev.error; st.err = String((er && (er.status ? er.status + ' ' : '') + (er.message || '')) || (ev && ev.message) || '').slice(0, 90); }
      // 첫 그림 전: 지도 자료 주소(TileJSON)·스타일 자체의 오류는 바로, 타일 몇 개의 오류는 4번째에 실패로 본다
      if (!loaded) { if (!(ev && ev.tile) || ++errs >= 4) { clearTimeout(timer); mpVecFailed('net', diag()); } return; }
      if (++mpTileErr >= 3 && Date.now() >= mpNoteHold) mpS('#mp-note').hidden = false;
    });
    gl.on('idle', () => { if (!alive()) return; mpTileErr = 0; if (Date.now() >= mpNoteHold) mpS('#mp-note').hidden = true; mpSwRefresh(); });
    gl.on('load', () => { if (alive()) mpSwRefresh(); });
  }
  // 지하철역: 지금 읽어 둔 타일의 역을 모아 같은 이름·가까운 것을 한 곳으로 합쳐 'bf-subway' 원에 넣는다. 합친 역이 하나라도 있으면 합친 층(subway-merged)을, 없으면 타일 그대로의 예비 층(subway-station)을 보인다.
  function mpSwVis(gl, merged) {
    const on = mpSwOn();
    [['subway-station', on && !merged], ['subway-merged', on && merged]].forEach(([id, vis]) => {
      try { if (gl.getLayer(id) && gl.getLayoutProperty(id, 'visibility') !== (vis ? 'visible' : 'none')) gl.setLayoutProperty(id, 'visibility', vis ? 'visible' : 'none'); } catch (e) { /* 무시 */ }
    });
  }
  function mpSwRefresh() {
    const layer = mpVec, gl = layer && layer.getMaplibreMap && layer.getMaplibreMap();
    if (!gl || !window.bfMapStyle || !gl.getLayer || !gl.getLayer('subway-merged')) return;
    const B = window.bfMapStyle;
    if (!mpSwOn()) { mpSwVis(gl, false); return; }
    let fc = null;
    try {
      if (gl.getZoom() >= 11.5) fc = B.merge(gl.querySourceFeatures(B.SRC, { sourceLayer: 'poi', filter: B.STATION_FILTER }));
    } catch (e) { fc = null; }
    if (fc && fc.features.length) {
      const sig = fc.features.map((f) => f.properties.name + '@' + f.geometry.coordinates.join(',')).join(';');
      if (sig !== mpSwSig) {
        const src = gl.getSource(B.SUBWAY_SRC);
        if (src && src.setData) { try { src.setData(fc); mpSwSig = sig; mpSwData = fc; } catch (e) { /* 무시 */ } }
      }
      mpSwVis(gl, true);
    } else if (!mpSwData) {
      mpSwVis(gl, false);   // 아직 모은 역이 없으면 타일 그대로의 예비 층
    } else {
      mpSwVis(gl, true);    // 이 화면에는 역이 없어도(또는 아직 못 읽어도) 지난번 목록이 있으면 합친 층을 그대로 둔다
    }
  }
  // 리뷰 입력(v64): 키보드가 올라오면 지도 카드(아래에 붙어 있어 키보드에 가려짐)를 키보드 바로 위로 올리고, 입력 중에는 이름·리뷰 칸만 남기고 줄인다.
  // 키보드 높이는 앱이 알려 주는 값(kbH)을 쓰고, 웹에서는 visualViewport 가 줄어든 만큼으로 안다.
  function mpKbH() {
    if (kbH > 0) return kbH;
    const v = window.visualViewport;
    return v && v.height < window.innerHeight - 120 ? Math.max(0, Math.round(window.innerHeight - v.height - v.offsetTop)) : 0;
  }
  function mpCardFit() {
    if (!mpEl) return;
    const c = mpS('#mp-card'); if (!c) return;
    const a = document.activeElement, kb = mpKbH();
    const typing = !c.hidden && kb > 0 && !!a && a.tagName === 'TEXTAREA' && c.contains(a) && !!c.querySelector('.mp-rv-form');
    if (!typing) {
      if (c.classList.contains('kbup')) { c.classList.remove('kbup'); c.style.removeProperty('--kb-bottom'); c.style.removeProperty('--kb-max'); }
      return;
    }
    const kbTop = window.innerHeight - kb, wr = (c.offsetParent || mpS('.mp-mapwrap')).getBoundingClientRect();
    c.style.setProperty('--kb-bottom', Math.max(8, Math.round(wr.bottom - kbTop) + 8) + 'px');   // 카드 아래 끝이 키보드 위 8px
    c.style.setProperty('--kb-max', Math.max(150, Math.round(kbTop - wr.top - 16)) + 'px');       // 지도 위 끝 안쪽까지만
    c.classList.add('kbup');
    setTimeout(() => { if (document.activeElement === a) { try { a.scrollIntoView({ block: 'nearest' }); } catch (e) { /* 무시 */ } } }, 60);
  }
  // 지하철 단추: 벡터 지도일 때만 있고, 누르면 두 역 층을 켜고 끈다.
  function mpSwSync() {
    const btn = mpEl && mpS('#mp-sw'); if (!btn) return;
    const on = mpSwOn();
    btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  themeHooks.push(() => { if (mpMap) { mpApplyTile(); mpDrawMe(); mpBrDraw(); } });   // 테마를 바꾸면 바탕(밝은/어두운)과 내 위치 점 색도 바꾼다
  function mpEnsureMap() {
    if (!mpEl || !window.L) return;
    if (mpMap) { mpMap.invalidateSize(); mpApplyTile(); return; }
    mpMap = L.map(mpS('#mp-map'), { zoomControl: false, zoomSnap: 1, minZoom: 3, maxZoom: 19 });
    mpZoomCtl = L.control.zoom({ position: mpNarrow() ? 'topleft' : 'topright', zoomInTitle: '확대', zoomOutTitle: '축소' }).addTo(mpMap);
    mpApplyTile();
    mpMap.createPane('mpBr').style.zIndex = 395;   // 매장 점은 내 위치 점(400)·핀(600)보다 아래
    mpBrRend = L.canvas({ pane: 'mpBr', padding: 0.4, tolerance: 8 });
    mpBrLayer = L.layerGroup().addTo(mpMap);
    mpBgLayer = L.layerGroup().addTo(mpMap);   // 점은 카페 층과 같은 캔버스(mpBrRend)에 그린다
    mpPinLayer = L.layerGroup().addTo(mpMap);
    mpMeLayer = L.layerGroup().addTo(mpMap);
    mpMap.on('dragstart', () => { mpUserMoved = true; });
    mpMap.on('moveend', mpBrDraw);
    mpMap.on('click', () => { if (!mpPicking) mpSelect(null); });
    mpMap.setView([MP_VIEW0.lat, MP_VIEW0.lng], MP_VIEW0.z);
    mpRenderMarkers();
    mpDrawMe();
    mpDraftMarker();
    mpFitInitial();
    mpBrLoad();
    mpBgLoad();
  }
  // 첫 화면: 내 위치가 있으면 그 주변, 없으면 등록한 장소가 모두 보이게, 둘 다 없으면 서울
  function mpFitInitial() {
    if (!mpMap || mpUserMoved) return;
    if (mpMe) mpGo(mpMe.lat, mpMe.lng, 15);
    else if (mpDB.items.length) mpMap.fitBounds(L.latLngBounds(mpDB.items.map((p) => [p.lat, p.lng])), { paddingTopLeft: [48 + mpPanelW(), 48], paddingBottomRight: [48, 48], maxZoom: 16, animate: false });
    else mpMap.setView([MP_VIEW0.lat, MP_VIEW0.lng], MP_VIEW0.z, { animate: false });
  }
  function mpDrawMe() {
    if (!mpMap || !mpMeLayer) return;
    mpMeLayer.clearLayers();
    if (!mpMe) return;
    const blue = (mpEl && getComputedStyle(mpEl).getPropertyValue('--mp-me').trim()) || '#2f7de1';   // 내 위치 점 색: 테마별(style.css의 --mp-me)
    if (mpMe.acc > 25) L.circle([mpMe.lat, mpMe.lng], { radius: Math.min(mpMe.acc, 1500), stroke: false, fillColor: blue, fillOpacity: 0.14, interactive: false }).addTo(mpMeLayer);
    L.circleMarker([mpMe.lat, mpMe.lng], { radius: 8, color: '#fff', weight: 3, fillColor: blue, fillOpacity: 1, interactive: false }).addTo(mpMeLayer);
  }
  function mpDraftMarker() {
    if (!mpMap) return;
    const ok = mpView === 'form' && Number.isFinite(mpDraft.lat) && Number.isFinite(mpDraft.lng);
    if (!ok) { if (mpDraftMk) { mpMap.removeLayer(mpDraftMk); mpDraftMk = null; } return; }
    if (mpDraftMk) mpDraftMk.setLatLng([mpDraft.lat, mpDraft.lng]);
    else mpDraftMk = L.marker([mpDraft.lat, mpDraft.lng], { icon: mpIcon('draft'), interactive: false, keyboard: false }).addTo(mpMap);
  }

  // ----- 카페 층 -----
  // 자료: data/cafes.json = { v:2, src, asof, b:['스타벅스',…], full:['서울'], bb:[남,서,북,동], r:[[브랜드번호(-1 이면 개인), 이름, 주소, 위도, 경도], …] }  (scripts/filter-cafes.py 가 만든다)
  //  · 서울은 모든 카페(프랜차이즈 + 개인), 서울 밖은 스타벅스·투썸만 들어 있다. bb 는 '전부 담은 지역'의 위·경도 범위, full 은 그 지역 이름.
  //  · 옛 data/brandcafes.json(v1: 스타벅스·투썸만, 개인 없음)도 읽는다 — 그때는 종류 걸러 보기가 나오지 않는다.
  function mpBrFetch(i) {
    return fetch(MP_BR_FILES[i]).then((r) => { if (!r.ok) { const e = new Error('http'); e.none = true; throw e; } return r.json(); })
      .catch((e) => { if (e && e.none && i + 1 < MP_BR_FILES.length) return mpBrFetch(i + 1); throw e; });
  }
  function mpBrLoad() {
    if (mpBrDB || mpBrP) return mpBrP;
    mpBrState = 'loading';
    mpBrP = mpBrFetch(0).then((j) => {
      if (!j || !Array.isArray(j.r) || !Array.isArray(j.b)) throw new Error('shape');
      const rows = [];
      j.r.forEach((x) => {
        if (!Array.isArray(x)) return;
        const bi = +x[0], la = +x[3], lo = +x[4];
        if (!(Number.isInteger(bi) && bi >= -1 && bi < j.b.length) || !Number.isFinite(la) || !Number.isFinite(lo)) return;
        rows.push([bi, String(x[1] || (bi >= 0 ? j.b[bi] : '카페')).slice(0, 60), String(x[2] || '').slice(0, 120), la, lo]);
      });
      const idx = new Map();
      rows.forEach((x, i) => { const k = Math.max(0, Math.floor(x[3] / MP_BR_CELL)) * 10000 + Math.max(0, Math.floor(x[4] / MP_BR_CELL)); const a = idx.get(k); if (a) a.push(i); else idx.set(k, [i]); });
      const b = j.b.map((n) => String(n).slice(0, 20));
      const bb = Array.isArray(j.bb) && j.bb.length === 4 && j.bb.every((v) => Number.isFinite(+v)) ? j.bb.map(Number) : null;
      const db = { src: String(j.src || '').slice(0, 80), asof: String(j.asof || '').slice(0, 20), b, r: rows, bb, hasInd: rows.some((x) => x[0] < 0),
        full: (Array.isArray(j.full) ? j.full : []).slice(0, 4).map((n) => String(n).slice(0, 10)), outB: [] };
      if (bb) { const o = new Set(); rows.forEach((x) => { if (x[0] >= 0 && !mpBrInBB(db, x[3], x[4])) o.add(x[0]); }); db.outB = [...o].map((i) => b[i]); }
      mpBrDB = db; mpBrIdx = idx; mpBrState = 'ok';
    }).catch((e) => { mpBrState = e && e.none ? 'none' : 'err'; }).then(() => { mpBrP = null; if (mpIsOpen() && mpMap) mpBrDraw(); });
    return mpBrP;
  }
  // 전부 담은 지역(서울) 안인가 — 가장자리는 0.02도(약 2km) 넉넉하게 본다
  const mpBrInBB = (db, la, lo) => !!db.bb && la >= db.bb[0] - 0.02 && la <= db.bb[2] + 0.02 && lo >= db.bb[1] - 0.02 && lo <= db.bb[3] + 0.02;
  // 점 색: 모든 카페가 같은 색(커피색). 테마에 맞춰 밝기만 바꾼다. (내 장소 핀의 색은 style.css 의 --pc1~8)
  function mpBrPal() {
    const night = document.body.classList.contains('theme-night'), sepia = document.body.classList.contains('theme-sepia');
    return night ? { c: '#d9a577', ring: '#16171a' } : sepia ? { c: '#7a4f33', ring: '#f4ead6' } : { c: '#8a5a3c', ring: '#ffffff' };
  }
  function mpBrDraw() {
    if (!mpMap || !mpBrLayer) return;
    mpBrLayer.clearLayers(); mpBrSelMk = null; mpBrCapped = false;
    const on = mpBrOn(), f = mpBrFilt();
    const btn = mpS('#mp-br'); if (btn) { btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    const bf = mpS('#mp-bf');
    if (bf) { bf.hidden = !(on && mpBrDB && mpBrDB.hasInd); bf.querySelectorAll('button').forEach((b) => { const sel = b.dataset.f === f; b.classList.toggle('on', sel); b.setAttribute('aria-pressed', sel ? 'true' : 'false'); }); }
    if (on && mpBrDB && mpBrIdx && mpMap.getZoom() >= MP_BR_MINZ) {
      const b = mpMap.getBounds().pad(0.4), c = mpMap.getCenter(), S = MP_BR_CELL, rows = mpBrDB.r;
      let out = [];
      for (let a = Math.max(0, Math.floor(b.getSouth() / S)); a <= Math.floor(b.getNorth() / S); a++) {
        for (let o = Math.max(0, Math.floor(b.getWest() / S)); o <= Math.floor(b.getEast() / S); o++) {
          const ix = mpBrIdx.get(a * 10000 + o);
          if (ix) for (let k = 0; k < ix.length; k++) {
            const r = rows[ix[k]];
            if (f === 'fr' ? r[0] < 0 : f === 'ind' ? r[0] >= 0 : false) continue;
            if (r[3] >= b.getSouth() && r[3] <= b.getNorth() && r[4] >= b.getWest() && r[4] <= b.getEast()) out.push(ix[k]);
          }
        }
      }
      if (out.length > MP_BR_MAX) {
        mpBrCapped = true;
        const d2 = (i) => { const r = rows[i]; return (r[3] - c.lat) * (r[3] - c.lat) + (r[4] - c.lng) * (r[4] - c.lng); };
        out = out.sort((x, y) => d2(x) - d2(y)).slice(0, MP_BR_MAX);
      }
      const pal = mpBrPal();
      out.forEach((i) => {
        const r = rows[i];
        L.circleMarker([r[3], r[4]], { renderer: mpBrRend, radius: 6.5, weight: 2, color: pal.ring, fillColor: pal.c, fillOpacity: 1, bubblingMouseEvents: false })
          .on('click', () => mpBrSelect(i)).addTo(mpBrLayer);
      });
      if (mpBrSel >= 0 && rows[mpBrSel]) mpBrMarkSel();
    }
    mpBgDraw();   // 보드게임 점은 늘 카페 점 위에 오도록 뒤에 그린다
    mpBrHintSync();
  }
  function mpBrMarkSel() {
    if (mpBrSelMk) { mpBrLayer.removeLayer(mpBrSelMk); mpBrSelMk = null; }
    const r = mpBrDB && mpBrDB.r[mpBrSel]; if (!r || !mpBrLayer) return;
    const acc = (mpEl && getComputedStyle(mpEl).getPropertyValue('--accent').trim()) || '#9a3b2e';
    mpBrSelMk = L.circleMarker([r[3], r[4]], { renderer: mpBrRend, radius: 12, weight: 3, color: acc, fillOpacity: 0, interactive: false }).addTo(mpBrLayer);
  }
  // 안내 문구(#mp-bhint): 켜진 층(카페·보드게임)을 모두 보고 한 줄만 보인다. 우선순위: 자료 오류 > 확대 안내 > 점이 많아 줄였음 > 담긴 지역 밖
  function mpBrHintSync() {
    const h = mpS('#mp-bhint'); if (!h) return;
    const cOn = mpBrOn(), gOn = mpBgOn() && mpBgState !== 'none';   // 보드게임 자료 파일이 없으면 그 층은 없는 것으로 본다
    const z = mpMap ? mpMap.getZoom() : 99, f = mpBrFilt();
    let msg = '';
    if (cOn && (mpBrState === 'none' || mpBrState === 'err')) msg = '카페 자료를 불러오지 못했습니다.';
    else if (gOn && mpBgState === 'err') msg = '보드게임 카페 자료를 불러오지 못했습니다.';
    else {
      const cReady = cOn && mpBrState === 'ok', gReady = gOn && mpBgState === 'ok';
      const cFar = cReady && z < MP_BR_MINZ, gFar = gReady && z < MP_BG_MINZ;
      if ((cReady || gReady) && (!cReady || cFar) && (!gReady || gFar)) msg = '지도를 확대하면 장소가 보입니다';   // 켜진 층이 모두 이 확대 수준에서는 안 그려진다
      else if (cFar) msg = '커피 카페는 더 확대하면 보입니다';   // 보드게임 점만 보이는 중
      else if (cReady && mpBrCapped) msg = '카페가 많아 가운데에서 가까운 ' + MP_BR_MAX + '곳만 보입니다. 더 확대해 보세요';
      else if (gReady && mpBgCapped) msg = '보드게임 카페가 많아 가운데에서 가까운 ' + MP_BG_MAX + '곳만 보입니다. 더 확대해 보세요';
      else if (mpMap) {
        const c = mpMap.getCenter();
        if (cReady && mpBrDB.bb && f !== 'fr' && !mpBrInBB(mpBrDB, c.lat, c.lng)) {
          const region = mpBrDB.full.join('·') || '서울', o = mpBrDB.outB;
          msg = f === 'ind' ? '개인 카페는 ' + region + '만 담겨 있습니다'
            : o.length && o.length <= 3 ? region + ' 밖에서는 ' + o.join('·') + ' 매장만 보입니다 (개인 카페는 ' + region + '만)'
            : o.length ? region + ' 밖에서는 일부 프랜차이즈 매장만 보입니다 (개인 카페는 ' + region + '만)' : '카페 자료는 ' + region + '만 담겨 있습니다';
        }
        if (!msg && gReady && mpBgDB.bb && !mpBrInBB(mpBgDB, c.lat, c.lng)) msg = '보드게임 카페는 ' + (mpBgDB.full.join('·') || '서울') + '만 담겨 있습니다';
      }
    }
    h.textContent = msg; h.hidden = !msg;
  }
  function mpBrClearSel() {
    if (mpBrSel < 0) return;
    mpBrSel = -1;
    if (mpBrSelMk && mpBrLayer) mpBrLayer.removeLayer(mpBrSelMk);
    mpBrSelMk = null;
  }
  // ----- 보드게임 카페 층 -----
  // 자료: data/boardgame.json = { v:1, src, asof, full:['서울'], bb:[남,서,북,동], r:[[이름, 주소, 위도, 경도], …] }  (scripts/filter-cafes.py 가 cafes.json 과 함께 만든다. 이름에 '보드게임'이 든 가게)
  // 안쪽에서는 카페 층과 같은 모양([-1, 이름, 주소, 위도, 경도])으로 바꿔 두어 mpBrHave 같은 함수를 함께 쓴다.
  function mpBgLoad() {
    if (mpBgDB || mpBgP) return mpBgP;
    mpBgState = 'loading';
    mpBgP = fetch(MP_BG_FILE).then((r) => { if (!r.ok) { const e = new Error('http'); e.none = true; throw e; } return r.json(); }).then((j) => {
      if (!j || !Array.isArray(j.r)) throw new Error('shape');
      const rows = [];
      j.r.forEach((x) => {
        if (!Array.isArray(x)) return;
        const la = +x[2], lo = +x[3];
        if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
        rows.push([-1, String(x[0] || '보드게임 카페').slice(0, 60), String(x[1] || '').slice(0, 120), la, lo]);
      });
      const bb = Array.isArray(j.bb) && j.bb.length === 4 && j.bb.every((v) => Number.isFinite(+v)) ? j.bb.map(Number) : null;
      mpBgDB = { src: String(j.src || '').slice(0, 80), asof: String(j.asof || '').slice(0, 20), r: rows, bb, full: (Array.isArray(j.full) ? j.full : []).slice(0, 4).map((n) => String(n).slice(0, 10)) };
      mpBgState = 'ok';
    }).catch((e) => { mpBgState = e && e.none ? 'none' : 'err'; }).then(() => { mpBgP = null; if (mpIsOpen() && mpMap) mpBrDraw(); });
    return mpBgP;
  }
  // 점 색: 커피 카페(갈색)와 다른 보라 계열. 테마에 맞춰 밝기만 바꾼다.
  function mpBgPal() {
    const night = document.body.classList.contains('theme-night'), sepia = document.body.classList.contains('theme-sepia');
    return night ? { c: '#b4a6f2', ring: '#16171a' } : sepia ? { c: '#5b4a8c', ring: '#f4ead6' } : { c: '#5d4fa8', ring: '#ffffff' };
  }
  function mpBgDraw() {
    if (!mpMap || !mpBgLayer) return;
    mpBgLayer.clearLayers(); mpBgSelMk = null; mpBgCapped = false;
    const on = mpBgOn();
    const btn = mpS('#mp-bg');
    if (btn) { btn.hidden = !(mpBgState === 'ok' || mpBgState === 'err'); btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    if (!(on && mpBgDB && mpMap.getZoom() >= MP_BG_MINZ)) return;
    const b = mpMap.getBounds().pad(0.4), c = mpMap.getCenter(), rows = mpBgDB.r;
    let out = [];
    for (let i = 0; i < rows.length; i++) { const r = rows[i]; if (r[3] >= b.getSouth() && r[3] <= b.getNorth() && r[4] >= b.getWest() && r[4] <= b.getEast()) out.push(i); }
    if (out.length > MP_BG_MAX) {
      mpBgCapped = true;
      const d2 = (i) => { const r = rows[i]; return (r[3] - c.lat) * (r[3] - c.lat) + (r[4] - c.lng) * (r[4] - c.lng); };
      out = out.sort((x, y) => d2(x) - d2(y)).slice(0, MP_BG_MAX);
    }
    const pal = mpBgPal();
    out.forEach((i) => {
      const r = rows[i];
      L.circleMarker([r[3], r[4]], { renderer: mpBrRend, radius: 7, weight: 2, color: pal.ring, fillColor: pal.c, fillOpacity: 1, bubblingMouseEvents: false })
        .on('click', () => mpBgSelect(i)).addTo(mpBgLayer);
    });
    if (mpBgSel >= 0 && rows[mpBgSel]) mpBgMarkSel();
  }
  function mpBgMarkSel() {
    if (mpBgSelMk) { mpBgLayer.removeLayer(mpBgSelMk); mpBgSelMk = null; }
    const r = mpBgDB && mpBgDB.r[mpBgSel]; if (!r || !mpBgLayer) return;
    const acc = (mpEl && getComputedStyle(mpEl).getPropertyValue('--accent').trim()) || '#9a3b2e';
    mpBgSelMk = L.circleMarker([r[3], r[4]], { renderer: mpBrRend, radius: 12, weight: 3, color: acc, fillOpacity: 0, interactive: false }).addTo(mpBgLayer);
  }
  function mpBgClearSel() {
    if (mpBgSel < 0) return;
    mpBgSel = -1;
    if (mpBgSelMk && mpBgLayer) mpBgLayer.removeLayer(mpBgSelMk);
    mpBgSelMk = null;
  }
  // 같은 자리(15m 안, 같은 건물)에 겹친 다른 보드게임 카페 — 점이 겹쳐 맨 위 한 곳만 눌리므로 카드에서 고르게 한다(실제 자료에 같은 좌표 4쌍).
  function mpBgNear(i) {
    const rows = mpBgDB.r, r = rows[i], out = [];
    for (let j = 0; j < rows.length; j++) {
      const q = rows[j];
      if (j === i || Math.abs(q[3] - r[3]) > 0.00025 || Math.abs(q[4] - r[4]) > 0.0004) continue;
      const d = mpDist({ lat: r[3], lng: r[4] }, { lat: q[3], lng: q[4] });
      if (d <= 15) out.push([j, d]);
    }
    return out.sort((x, y) => x[1] - y[1] || x[0] - y[0]).map((x) => x[0]);
  }
  function mpBgSelect(i) {
    if (mpPicking || mpView === 'form' || !mpBgDB || !mpBgDB.r[i]) return;
    mpSelect(null);                       // 내 장소·카페 선택과 카드를 먼저 닫는다(여기서 보드게임 선택도 풀린다)
    mpBgSel = i; mpBgMarkSel();
    const r = mpBgDB.r[i], pt = { name: r[1], addr: r[2], lat: r[3], lng: r[4] };
    const d = mpMe ? mpDist(mpMe, pt) : null, lk = mpLinks(pt), have = mpBrHave(r, ''), near = mpBgNear(i);
    const c = mpS('#mp-card');
    c.innerHTML =
      '<div class="mp-c-top"><i class="mp-bd" style="background:' + mpBgPal().c + '"></i><strong>' + esc(r[1]) + '</strong>' + (d !== null ? '<span class="mp-it-d">' + mpFmtDist(d) + '</span>' : '') +
        '<button type="button" class="mp-c-x" id="mp-c-x" aria-label="닫기">✕</button></div>' +
      (r[2] ? '<div class="mp-c-l">' + esc(r[2]) + '</div>' : '') +
      (near.length ? '<div class="mp-c-l mp-c-near">같은 자리 근처 보드게임 카페 ' + near.length + '곳 ' + near.slice(0, 20).map((j) => '<button type="button" class="mp-nb" data-j="' + j + '">' + esc(mpBgDB.r[j][1]) + '</button>').join('') + (near.length > 20 ? ' 외 ' + (near.length - 20) + '곳' : '') + '</div>' : '') +
      '<div class="mp-rv" id="mp-rv" hidden></div>' +
      '<div class="mp-c-b">' +
        '<button type="button" class="mp-lk" data-o="info">정보 보기</button>' +
        '<button type="button" class="mp-lk" data-o="route">길찾기</button>' +
        '<button type="button" class="mp-lk mp-rv-add" data-o="rv">나만의 리뷰</button>' +
        '<button type="button" class="mp-lk edit" data-o="add"' + (have ? ' disabled' : '') + '>' + (have ? '내 장소에 있음' : '내 장소로 추가') + '</button></div>';
    c.hidden = false;
    rvMount(mpS('#mp-rv'), { k: rvKey('b', r[1], r[3], r[4]), n: r[1], la: r[3], lo: r[4] }, c.querySelector('.mp-rv-add'));
    mpS('#mp-c-x').addEventListener('click', () => { mpBgClearSel(); mpRenderCard(null); });
    c.querySelectorAll('.mp-nb').forEach((b) => b.addEventListener('click', () => mpBgSelect(+b.dataset.j)));
    c.querySelectorAll('.mp-lk').forEach((b) => b.addEventListener('click', () => {
      const o = b.dataset.o;
      if (o === 'rv') return;                   // 나만의 리뷰는 위(rvMount)에서 따로 연결했다
      if (o === 'add') { mpOpenForm({ name: r[1], addr: r[2], tel: '', hours: '', cap: 0, memo: '', amen: [], col: 0, lat: r[3], lng: r[4] }, true); return; }
      mpOpen(lk[o][0], lk[o][1]);
    }));
  }
  // 이미 내 장소에 있는 카페인가(이름이 비슷한 장소가 40m 안에 있으면 같은 곳으로 본다. 프랜차이즈는 브랜드 이름, 개인 카페는 자기 이름의 앞 세 글자로 견준다)
  function mpBrHave(r, brand) {
    const key = (brand || r[1]).replace(/\s/g, '').slice(0, 3);
    return mpDB.items.some((p) => mpDist(p, { lat: r[3], lng: r[4] }) < 40 && p.name.replace(/\s/g, '').indexOf(key) >= 0);
  }
  // 같은 자리(15m 안, 같은 건물)에 겹쳐 있는 다른 카페 — 점이 겹쳐 맨 위 한 곳만 눌리므로 카드에서 고를 수 있게 한다. 지금 보는 종류(전체/프랜차이즈/개인)에 맞는 것만, 가까운 순 최대 40곳(실제 자료에서 한 건물에 30곳 넘게 겹친 곳이 있다).
  function mpBrNear(i) {
    const rows = mpBrDB.r, r = rows[i], f = mpBrFilt(), S = MP_BR_CELL, a0 = Math.floor(r[3] / S), o0 = Math.floor(r[4] / S), out = [];
    for (let a = a0 - 1; a <= a0 + 1; a++) for (let o = o0 - 1; o <= o0 + 1; o++) {
      const ix = mpBrIdx.get(Math.max(0, a) * 10000 + Math.max(0, o));
      if (!ix) continue;
      for (let k = 0; k < ix.length; k++) {
        const j = ix[k], q = rows[j];
        if (j === i || Math.abs(q[3] - r[3]) > 0.00025 || Math.abs(q[4] - r[4]) > 0.0004) continue;
        if (f === 'fr' ? q[0] < 0 : f === 'ind' ? q[0] >= 0 : false) continue;
        const d = mpDist({ lat: r[3], lng: r[4] }, { lat: q[3], lng: q[4] });
        if (d <= 15) out.push([j, d]);
      }
    }
    return out.sort((x, y) => x[1] - y[1] || x[0] - y[0]).map((x) => x[0]);
  }
  function mpBrSelect(i) {
    if (mpPicking || mpView === 'form' || !mpBrDB || !mpBrDB.r[i]) return;
    mpSelect(null);                       // 내 장소 선택·카드를 먼저 닫는다(여기서 매장 선택도 풀린다)
    mpBrSel = i; mpBrMarkSel();
    const r = mpBrDB.r[i], brand = r[0] >= 0 ? mpBrDB.b[r[0]] || '' : '', pt = { name: r[1], addr: r[2], lat: r[3], lng: r[4] };
    const d = mpMe ? mpDist(mpMe, pt) : null, lk = mpLinks(pt), have = mpBrHave(r, brand);
    const near = mpBrNear(i);
    const c = mpS('#mp-card');
    c.innerHTML =
      '<div class="mp-c-top"><i class="mp-bd" style="background:' + mpBrPal().c + '"></i><strong>' + esc(r[1]) + '</strong>' + (d !== null ? '<span class="mp-it-d">' + mpFmtDist(d) + '</span>' : '') +
        '<button type="button" class="mp-c-x" id="mp-c-x" aria-label="닫기">✕</button></div>' +
      (r[2] ? '<div class="mp-c-l">' + esc(r[2]) + '</div>' : '') +
      (near.length ? '<div class="mp-c-l mp-c-near">같은 자리 근처 카페 ' + near.length + '곳 ' + near.slice(0, 40).map((j) => '<button type="button" class="mp-nb" data-j="' + j + '">' + esc(mpBrDB.r[j][1]) + '</button>').join('') + (near.length > 40 ? ' 외 ' + (near.length - 40) + '곳' : '') + '</div>' : '') +
      '<div class="mp-rv" id="mp-rv" hidden></div>' +
      '<div class="mp-c-b">' +
        '<button type="button" class="mp-lk" data-o="info">정보 보기</button>' +
        '<button type="button" class="mp-lk" data-o="route">길찾기</button>' +
        '<button type="button" class="mp-lk mp-rv-add" data-o="rv">나만의 리뷰</button>' +
        '<button type="button" class="mp-lk edit" data-o="add"' + (have ? ' disabled' : '') + '>' + (have ? '내 장소에 있음' : '내 장소로 추가') + '</button></div>';
    c.hidden = false;
    rvMount(mpS('#mp-rv'), { k: rvKey('c', r[1], r[3], r[4]), n: r[1], la: r[3], lo: r[4] }, c.querySelector('.mp-rv-add'));
    mpS('#mp-c-x').addEventListener('click', () => { mpBrClearSel(); mpRenderCard(null); });
    c.querySelectorAll('.mp-nb').forEach((b) => b.addEventListener('click', () => mpBrSelect(+b.dataset.j)));
    c.querySelectorAll('.mp-lk').forEach((b) => b.addEventListener('click', () => {
      const o = b.dataset.o;
      if (o === 'rv') return;                   // 나만의 리뷰는 위(rvMount)에서 따로 연결했다
      if (o === 'add') { mpOpenForm({ name: r[1], addr: r[2], tel: '', hours: '', cap: 0, memo: '', amen: [], col: 0, lat: r[3], lng: r[4] }, true); return; }
      mpOpen(lk[o][0], lk[o][1]);
    }));
  }

  // ----- 목록 · 핀 -----
  function mpVisible() {
    const q = mpSearch.trim().toLowerCase();
    return mpDB.items.filter((p) => {
      if (q && (p.name + ' ' + p.addr + ' ' + p.memo + ' ' + p.hours + ' ' + p.tel).toLowerCase().indexOf(q) < 0) return false;
      for (const k of mpFilt) if (p.amen.indexOf(k) < 0) return false;
      return true;
    });
  }
  const mpDistOf = (p) => (mpMe ? mpDist(mpMe, p) : null);
  function mpSorted() {
    const list = mpVisible().map((p) => ({ p, d: mpDistOf(p) }));
    list.sort((a, b) => (a.d !== null && b.d !== null ? a.d - b.d : 0) || a.p.name.localeCompare(b.p.name, 'ko'));
    return list;
  }
  function mpTags(p) {
    return p.amen.map((k) => '<i>' + esc(MP_AMEN_NAME[k]) + '</i>').join('') + (p.cap ? '<i>' + p.cap + '명</i>' : '');
  }
  function mpRenderLoc() {
    const box = mpS('#mp-loc');
    let msg;
    if (mpLocState === 'busy') msg = '내 위치를 확인하는 중…';
    else if (mpLocState === 'ok' && mpMe) msg = '내 위치 기준 · 가까운 순' + (mpMe.acc > 0 ? ' (오차 약 ' + Math.round(mpMe.acc) + 'm)' : '');
    else if (mpLocState === 'denied') msg = mpLocErr('denied');
    else if (mpLocState === 'fail') msg = mpLocErr('fail');
    else msg = mpMe ? '내 위치 기준 · 가까운 순' : '내 위치를 아직 모릅니다 · 이름순';
    box.innerHTML = '<span class="mp-loc-t' + (mpLocState === 'denied' || mpLocState === 'fail' ? ' warn' : '') + '">' + esc(msg) + '</span>' +
      '<button type="button" class="mp-mini" id="mp-loc-btn"' + (mpLocState === 'busy' ? ' disabled' : '') + '>내 위치 새로고침</button>';
    mpS('#mp-loc-btn').addEventListener('click', () => mpRefreshLoc(true));
  }
  function mpRenderList() {
    if (!mpEl) return;
    mpRenderLoc();
    const all = mpDB.items.length, list = mpSorted();
    mpS('#mp-count').textContent = all ? (list.length === all ? all + '곳' : all + '곳 중 ' + list.length + '곳') : '';
    mpS('#mp-chips').innerHTML = MP_AMEN.map((a) => '<button type="button" class="mp-chip' + (mpFilt.has(a[0]) ? ' on' : '') + '" data-k="' + a[0] + '">' + a[1] + '</button>').join('');
    const box = mpS('#mp-items');
    if (!all) {
      box.innerHTML = '<div class="mp-empty"><b>아직 등록한 장소가 없습니다.</b><br>모임으로 쓰기 좋은 카페를 직접 등록해 보세요. 위치(현재 위치·주소·지도에서 고르기)와 전화·영업시간·수용 인원·콘센트 같은 정보, 메모를 남길 수 있고, 등록하면 내 위치에서 가까운 순으로 보입니다.</div>';
    } else if (!list.length) {
      box.innerHTML = '<div class="mp-empty">조건에 맞는 장소가 없습니다. 검색어나 항목 선택을 바꿔 보세요.</div>';
    } else {
      box.innerHTML = list.map(({ p, d }) =>
        '<div class="mp-item' + (p.id === mpSel ? ' sel' : '') + '" data-id="' + p.id + '">' +
          '<button type="button" class="mp-it-main"><span class="mp-it-top"><i class="mp-sw c' + p.col + '"></i><span class="mp-it-name">' + esc(p.name) + '</span>' +
          (d !== null ? '<span class="mp-it-d">' + mpFmtDist(d) + '</span>' : '') + '</span>' +
          (p.addr ? '<span class="mp-it-sub">' + esc(p.addr) + '</span>' : '') +
          (p.amen.length || p.cap ? '<span class="mp-tags">' + mpTags(p) + '</span>' : '') + '</button>' +
          '<button type="button" class="mp-it-edit" aria-label="' + esc(p.name) + ' 수정"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button></div>').join('');
    }
  }
  function mpRenderMarkers() {
    if (!mpMap || !mpPinLayer) return;
    mpPinLayer.clearLayers();
    Object.keys(mpMk).forEach((k) => { delete mpMk[k]; });
    mpVisible().forEach((p) => {
      const mk = L.marker([p.lat, p.lng], { icon: mpIcon(p.id === mpSel ? 'sel' : '', p.col), title: p.name, zIndexOffset: p.id === mpSel ? 1000 : 0 });
      mk.on('click', () => mpSelect(p.id, { list: true }));
      mk.addTo(mpPinLayer);
      mpMk[p.id] = mk;
    });
  }
  function mpRefresh() { mpRenderList(); mpRenderMarkers(); mpRenderCard(mpSel ? mpFind(mpSel) : null); }

  function mpSelect(id, opt) {
    opt = opt || {};
    const prev = mpSel;
    mpSel = id && mpFind(id) ? id : null;
    const pp = prev ? mpFind(prev) : null;
    if (prev && mpMk[prev]) { mpMk[prev].setIcon(mpIcon('', pp ? pp.col : 0)); mpMk[prev].setZIndexOffset(0); }
    if (mpSel && mpMk[mpSel]) { mpMk[mpSel].setIcon(mpIcon('sel', mpFind(mpSel).col)); mpMk[mpSel].setZIndexOffset(1000); }
    const p = mpSel ? mpFind(mpSel) : null;
    mpEl.querySelectorAll('.mp-item').forEach((it) => it.classList.toggle('sel', it.dataset.id === mpSel));
    mpRenderCard(p);
    if (p && opt.list) { const it = mpS('.mp-item[data-id="' + p.id + '"]'); if (it && it.scrollIntoView) it.scrollIntoView({ block: 'nearest' }); }
    if (p && opt.fly && mpMap) mpGo(p.lat, p.lng, Math.max(mpMap.getZoom(), 16));
  }
  function mpRenderCard(p) {
    const c = mpS('#mp-card');
    mpBrClearSel(); mpBgClearSel();   // 어떤 카드로 바뀌든 카페·보드게임 선택(고리 표시)은 풀린다. 그 카드는 mpBrSelect·mpBgSelect 가 이 뒤에 직접 그린다.
    if (!p || mpPicking) { c.hidden = true; c.innerHTML = ''; return; }
    const d = mpDistOf(p), lk = mpLinks(p);
    c.innerHTML =
      '<div class="mp-c-top"><i class="mp-sw c' + p.col + '"></i><strong>' + esc(p.name) + '</strong>' + (d !== null ? '<span class="mp-it-d">' + mpFmtDist(d) + '</span>' : '') +
        '<button type="button" class="mp-c-x" id="mp-c-x" aria-label="닫기">✕</button></div>' +
      (p.addr ? '<div class="mp-c-l">' + esc(p.addr) + '</div>' : '') +
      (p.hours ? '<div class="mp-c-l">영업시간 · ' + esc(p.hours) + '</div>' : '') +
      (p.tel ? '<div class="mp-c-l">전화 · ' + esc(p.tel) + '</div>' : '') +
      (p.amen.length || p.cap ? '<div class="mp-tags">' + mpTags(p) + '</div>' : '') +
      (p.memo ? '<div class="mp-c-m">' + esc(p.memo) + '</div>' : '') +
      '<div class="mp-rv" id="mp-rv" hidden></div>' +
      '<div class="mp-c-b">' +
        '<button type="button" class="mp-lk" data-o="route">길찾기</button>' +
        '<button type="button" class="mp-lk mp-rv-add" data-o="rv">나만의 리뷰</button>' +
        (p.tel ? '<button type="button" class="mp-lk" data-o="tel">전화</button>' : '') +
        '<button type="button" class="mp-lk edit" data-o="edit">수정</button></div>';
    c.hidden = false;
    rvMount(mpS('#mp-rv'), { k: 'm:' + p.id, n: p.name, la: p.lat, lo: p.lng }, c.querySelector('.mp-rv-add'));
    mpS('#mp-c-x').addEventListener('click', () => mpSelect(null));
    c.querySelectorAll('.mp-lk').forEach((b) => b.addEventListener('click', () => {
      const o = b.dataset.o;
      if (o === 'rv') return;   // 나만의 리뷰는 rvMount 가 연결했다
      if (o === 'edit') { mpOpenForm(p); return; }
      if (o === 'tel') { mpOpen('tel:' + p.tel.replace(/[^\d+]/g, '')); return; }
      mpOpen(lk[o][0], lk[o][1]);
    }));
  }

  // ----- 내 위치 -----
  async function mpRefreshLoc(manual) {
    if (mpLocState === 'busy') return;
    mpLocState = 'busy'; mpRenderLoc();
    const r = await mpLocate();
    if (!mpEl) return;
    if (r.error) {
      mpLocState = r.error === 'denied' ? 'denied' : 'fail';
    } else {
      mpMe = { lat: r.lat, lng: r.lng, acc: Number.isFinite(r.acc) ? r.acc : 0 };
      mpLocState = 'ok';
      mpDrawMe();
      if (mpMap && (manual || !mpUserMoved) && !mpPicking && mpView === 'list') mpGo(mpMe.lat, mpMe.lng, 15);
      mpSyncLL();
    }
    mpRenderList();
    mpRenderMarkers();
    if (mpSel) mpRenderCard(mpFind(mpSel));
  }

  // ----- 등록·수정 입력 화면 -----
  function mpFormSnap() {
    return JSON.stringify([mpS('#mp-f-name').value, mpS('#mp-f-addr').value, mpS('#mp-f-tel').value, mpS('#mp-f-hours').value, mpS('#mp-f-cap').value,
      mpS('#mp-f-memo').value, mpDraft.lat, mpDraft.lng, [...mpFormAmen].sort(), mpFormCol]);
  }
  function mpFormMsg(t, warn) {
    const m = mpS('#mp-f-msg');
    m.textContent = t || ''; m.hidden = !t; m.classList.toggle('warn', !!warn);
  }
  function mpSyncAmen() {
    mpS('#mp-f-amen').innerHTML = MP_AMEN.map((a) => '<button type="button" class="mp-chip' + (mpFormAmen.has(a[0]) ? ' on' : '') + '" data-k="' + a[0] + '">' + a[1] + '</button>').join('');
  }
  function mpSyncCol() {
    mpS('#mp-f-col').innerHTML = MP_COLOR_NAME.map((n, i) => '<button type="button" class="mp-swb c' + i + (i === mpFormCol ? ' on' : '') + '" data-c="' + i + '" role="radio" aria-checked="' + (i === mpFormCol ? 'true' : 'false') + '" aria-label="' + n + '"></button>').join('');
  }
  function mpSyncLL() {
    if (!mpEl) return;
    const box = mpS('#mp-f-ll'), ok = Number.isFinite(mpDraft.lat) && Number.isFinite(mpDraft.lng);
    box.classList.toggle('ok', ok);
    box.textContent = ok
      ? '위치 지정됨 · 위도 ' + mpDraft.lat.toFixed(5) + ' · 경도 ' + mpDraft.lng.toFixed(5) + (mpMe ? ' · 내 위치에서 ' + mpFmtDist(mpDist(mpMe, mpDraft)) : '')
      : '아직 정하지 않았습니다 — 아래 세 가지 중 하나로 정하세요';
  }
  function mpShowView(v) {
    mpView = v;
    mpS('#mp-list').hidden = v !== 'list';
    mpS('#mp-form').hidden = v !== 'form';
    mpEl.dataset.view = v;
    mpS('.mp-l').scrollTop = 0;
    mpS(v === 'form' ? '#mp-form' : '#mp-list').scrollTop = 0;
    mpDraftMarker();
  }
  function mpOpenForm(p, asNew) {   // asNew: p 는 미리 채워 둘 값일 뿐 새 장소로 저장한다(매장 층의 '내 장소로 추가')
    if (mpPicking) mpPickEnd(false);
    mpEditId = p && !asNew ? p.id : null;
    mpS('#mp-f-name').value = p ? p.name : '';
    mpS('#mp-f-addr').value = p ? p.addr : '';
    mpS('#mp-f-tel').value = p ? p.tel : '';
    mpS('#mp-f-hours').value = p ? p.hours : '';
    mpS('#mp-f-cap').value = p && p.cap ? String(p.cap) : '';
    mpS('#mp-f-memo').value = p ? p.memo : '';
    mpDraft.lat = p ? p.lat : NaN; mpDraft.lng = p ? p.lng : NaN;
    mpFormAmen = new Set(p ? p.amen : []);
    mpFormCol = p && p.col ? p.col : 0;
    mpS('#mp-ftitle').textContent = p && !asNew ? '카페 정보 수정' : '장소 추가';
    mpS('#mp-f-del').hidden = !p || !!asNew;
    mpDisarmDel();
    mpS('#mp-f-res').hidden = true; mpS('#mp-f-res').innerHTML = '';
    mpFormMsg('');
    mpSyncAmen(); mpSyncCol(); mpSyncLL();
    mpShowView('form');
    mpFormInit = mpFormSnap();
    if (mpNarrow()) mpTab('l');
    mpRenderCard(null);
    if (p && mpMap) mpGo(p.lat, p.lng, Math.max(mpMap.getZoom(), 16));
  }
  function mpCloseForm() {
    if (mpPicking) mpPickEnd(false);
    mpEditId = null;
    mpDisarmDel();
    mpShowView('list');
    mpRenderCard(mpSel ? mpFind(mpSel) : null);
  }
  function mpSetDraft(lat, lng, fly) {
    mpDraft.lat = lat; mpDraft.lng = lng;
    mpSyncLL(); mpDraftMarker();
    if (mpMap && fly !== false) mpGo(lat, lng, Math.max(mpMap.getZoom(), 16));
    mpAutoAddr(lat, lng);
  }
  // 주소 칸이 비어 있으면 고른 위치의 주소를 찾아 채운다 (직접 적은 주소는 덮어쓰지 않는다)
  async function mpAutoAddr(lat, lng) {
    const inp = mpS('#mp-f-addr');
    if (inp.value.trim()) return;
    const r = await mpGeo('r', { lat, lng });
    if (!mpEl || inp.value.trim() || mpDraft.lat !== lat || mpDraft.lng !== lng) return;
    const it = r.results && r.results[0];
    if (it && it.addr) { inp.value = it.addr.slice(0, 120); mpFormMsg('고른 위치의 주소를 채웠습니다. 다르면 고쳐 쓰세요.'); }
  }
  async function mpFormGps() {
    mpFormMsg('현재 위치를 확인하는 중…');
    const r = await mpLocate();
    if (!mpEl) return;
    if (r.error) { mpFormMsg(mpLocErr(r.error), true); if (r.error === 'denied') mpLocState = 'denied'; return; }
    mpMe = { lat: r.lat, lng: r.lng, acc: Number.isFinite(r.acc) ? r.acc : 0 }; mpLocState = 'ok'; mpDrawMe();
    mpSetDraft(r.lat, r.lng);
    mpFormMsg('현재 위치를 카페 위치로 정했습니다. 카페에 계신 게 아니라면 "지도에서 고르기"로 다듬으세요.');
  }
  async function mpFormFind() {
    const q = mpS('#mp-f-addr').value.trim(), res = mpS('#mp-f-res');
    res.hidden = true; res.innerHTML = '';
    if (!q) { mpFormMsg('주소나 건물 이름을 먼저 적어 주세요. (예: 서울 강동구 강동대로 229)', true); return; }
    mpFormMsg('찾는 중…');
    const r = await mpGeo('q', q);
    if (!mpEl) return;
    if (r.error) { mpFormMsg(r.error === 'network' ? '인터넷에 연결되어 있지 않아 찾지 못했습니다.' : '주소를 찾지 못했습니다. 잠시 뒤 다시 눌러 보세요.', true); return; }
    const list = (r.results || []).filter((x) => x && Number.isFinite(x.lat) && Number.isFinite(x.lng));
    if (!list.length) { mpFormMsg('찾지 못했습니다. 도로명 주소나 "동 이름 + 건물 이름"으로 다시 적어 보세요.', true); return; }
    const pickOne = (it) => {
      mpS('#mp-f-addr').value = (it.addr || q).slice(0, 120);
      mpSetDraft(it.lat, it.lng);
      res.hidden = true; res.innerHTML = '';
      mpFormMsg('찾은 위치로 정했습니다. 지도에서 맞는지 확인하고, 다르면 "지도에서 고르기"로 다듬으세요.');
    };
    if (list.length === 1) { pickOne(list[0]); return; }
    mpFormMsg('아래에서 맞는 곳을 골라 주세요.');
    res.innerHTML = list.map((it, i) => '<button type="button" data-i="' + i + '"><b>' + esc(it.name || it.addr || '(이름 없음)') + '</b>' + (it.name && it.addr ? '<span>' + esc(it.addr) + '</span>' : '') + '</button>').join('');
    res.hidden = false;
    res.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => pickOne(list[+b.dataset.i])));
  }
  // 지도에서 고르기: 지도를 끌어 가운데 십자 표시를 맞추고 '여기로 정하기'를 누른다
  function mpPickStart() {
    if (!mpMap) { mpFormMsg('지도를 아직 불러오지 못했습니다. 잠시 뒤 다시 눌러 보세요.', true); return; }
    mpPicking = true;
    mpEl.classList.add('picking');
    mpS('#mp-cross').hidden = false; mpS('#mp-pick').hidden = false;
    mpRenderCard(null);
    if (mpNarrow()) mpTab('r');
    if (Number.isFinite(mpDraft.lat)) mpGo(mpDraft.lat, mpDraft.lng, Math.max(mpMap.getZoom(), 16));   // 고르는 중에는 목록·입력 창이 숨으므로 지도 가운데가 곧 십자 위치
    else if (mpMe) mpGo(mpMe.lat, mpMe.lng, Math.max(mpMap.getZoom(), 16));
  }
  function mpPickEnd(ok) {
    if (!mpPicking) return;
    mpPicking = false;
    mpEl.classList.remove('picking');
    mpS('#mp-cross').hidden = true; mpS('#mp-pick').hidden = true;
    if (ok && mpMap) {
      const c = mpMap.getCenter();
      mpSetDraft(c.lat, c.lng, false);
      mpFormMsg('지도에서 고른 위치로 정했습니다.');
      mpGo(c.lat, c.lng, mpMap.getZoom());
    }
    if (mpNarrow()) mpTab('l');
    mpRenderCard(mpSel && mpView === 'list' ? mpFind(mpSel) : null);
  }
  function mpDisarmDel() { mpDelArm = 0; clearTimeout(mpDelTimer); const b = mpEl && mpEl.querySelector('#mp-f-del'); if (b) b.textContent = '삭제'; }
  function mpFormSave() {
    const name = mpS('#mp-f-name').value.trim();
    if (!name) { mpFormMsg('이름을 적어 주세요.', true); mpS('#mp-f-name').focus(); return; }
    if (!(Number.isFinite(mpDraft.lat) && Number.isFinite(mpDraft.lng))) { mpFormMsg('위치를 정해 주세요. "현재 위치로", "주소로 찾기", "지도에서 고르기" 중 하나를 쓰면 됩니다.', true); mpS('#mp-f-ll').scrollIntoView({ block: 'center' }); return; }
    const old = mpEditId ? mpFind(mpEditId) : null;
    if (!old && mpDB.items.length >= MP_MAX) { mpFormMsg('장소는 ' + MP_MAX + '곳까지 등록할 수 있습니다.', true); return; }
    const cap = Math.round(parseFloat(mpS('#mp-f-cap').value));
    const rec = mpClean([{
      id: old ? old.id : newId(), name, lat: mpDraft.lat, lng: mpDraft.lng,
      addr: mpS('#mp-f-addr').value, tel: mpS('#mp-f-tel').value, hours: mpS('#mp-f-hours').value, cap: cap > 0 ? cap : 0,
      amen: [...mpFormAmen], memo: mpS('#mp-f-memo').value, col: mpFormCol, ts: old ? old.ts : Date.now(),
    }])[0];
    if (old) mpDB.items = mpDB.items.map((p) => (p.id === old.id ? rec : p)); else mpDB.items.push(rec);
    mpSave();
    mpFormInit = mpFormSnap();
    mpCloseForm();
    mpRefresh();
    mpSelect(rec.id, { fly: true, list: true });
    showToastLine('저장했습니다 · ' + rec.name, true);
  }
  function mpFormDelete() {
    const old = mpEditId ? mpFind(mpEditId) : null;
    if (!old) return;
    const b = mpS('#mp-f-del');
    if (!mpDelArm) {
      mpDelArm = 1; b.textContent = '한 번 더 누르면 삭제';
      clearTimeout(mpDelTimer); mpDelTimer = setTimeout(mpDisarmDel, 4000);
      return;
    }
    mpDB.items = mpDB.items.filter((p) => p.id !== old.id);
    mpSave();
    rvDel('m:' + old.id);
    if (mpSel === old.id) mpSel = null;
    mpFormInit = mpFormSnap();
    mpCloseForm();
    mpRefresh();
    showToastLine('삭제했습니다 · ' + old.name, true);
  }
  function mpTryClose() {
    if (mpView === 'form' && mpFormSnap() !== mpFormInit) { showToastLine('작성 중인 내용이 있습니다. 저장하거나 [취소]를 눌러 주세요.', true); return; }
    closeMp();
  }

  // ----- 배치: 펼침(넓은 화면)은 왼쪽 목록·입력 / 오른쪽 지도, 좁은 화면은 '목록 | 지도' 탭 -----
  // 펼침에서는 검색·키워드·카페 추가를 위 줄로, 내 위치·새로고침을 지도 아래 줄로 옮기고, 좁은 화면에서는 목록 안의 원래 자리로 되돌린다.
  function mpPlace(two) {
    if (mpPlacedTwo === two) return;
    mpPlacedTwo = two;
    const bar = mpS('.mp-bar'), tabs = mpS('.mp-tabs'), list = mpS('#mp-list'), top = mpS('.mp-top');
    const q = mpS('#mp-q'), add = mpS('#mp-add'), chips = mpS('#mp-chips'), loc = mpS('#mp-loc'), cnt = mpS('#mp-count');
    if (two) {
      bar.insertBefore(q, tabs); bar.insertBefore(add, tabs);
      mpS('.mp-sub').appendChild(chips);
      mpS('.mp-foot').append(cnt, loc);
    } else {
      top.append(cnt, add);
      list.prepend(loc, top, q, chips);
    }
  }
  function layoutMp() {
    if (!mpEl) return;
    const g = geometry(), W = g.W, H = g.H, si = g.si;
    const two = W >= 680 && W >= H * 1.1 && H >= 520;   // 가로로 눕힌 아이폰처럼 높이가 낮으면 지도가 너무 작아지므로 '목록 | 지도' 탭을 쓴다
    mpEl.classList.toggle('two', two);
    mpEl.classList.toggle('narrow', !two);
    mpPlace(two);
    if (mpZoomCtl) mpZoomCtl.setPosition(two ? 'topright' : 'topleft');
    const rail = NATIVE && two && si.left < 8 && si.right >= 60;   // 듀오 펼침: 오른쪽 안전영역 맨 위의 상태 알약 자리만 비운다
    // 위·아래 여백을 같게: 위는 안전영역 + 12, 아래는 안전영역(홈 막대) + 14 다. 듀오처럼 위 안전영역은 없고 아래만 있으면 화면이 위로 쏠려 보이므로,
    // 아래 여백이 더 클 때만 그 차이의 절반만큼 화면 전체를 아래로 내린다(위 여백 +drop, 아래 여백 −drop. 두 여백의 합은 그대로).
    // 위 안전영역(노치·상태 표시줄)이 더 큰 기기는 위로 올릴 수 없으므로 그대로 둔다.
    const top0 = Math.max(Math.round(si.top), 0) + 12;
    const bot0 = (kbH > 0 && !two ? 0 : Math.max(Math.round(si.bottom), 0)) + 14;
    const drop = Math.max(0, Math.round((bot0 - top0) / 2));
    const top = top0 + drop;
    const set = (k, v) => mpEl.style.setProperty(k, v + 'px');
    set('--mp-top', top);
    set('--mp-topr', two ? (rail ? Math.max(top, NATIVE_PILL_BOTTOM + 6) : top) : 12);
    set('--mp-bot', bot0 - drop);
    set('--mp-l', Math.max(rail || si.left < 8 ? 22 : 0, Math.round(si.left) + 10));
    const mr = Math.max(rail || si.right < 8 ? 22 : 0, rail ? 22 : Math.round(si.right) + 10);
    set('--mp-r', mr);
    set('--mp-bandr', rail ? Math.round(si.right) + 8 : mr);   // 위 줄은 오른쪽 위 상태 알약 자리를 피한다
    if (two) {   // 알약 아래에서 지도가 시작하도록, 키워드 줄 아래 간격을 맞춘다
      const cb = mpS('#mp-chips').getBoundingClientRect().bottom;
      set('--mp-gapt', Math.max(10, rail ? Math.round(Math.max(top, NATIVE_PILL_BOTTOM + 6) - cb) : 0));
    }
    if (mpMap) requestAnimationFrame(() => { if (mpIsOpen() && mpMap) mpMap.invalidateSize(); });
  }
  function mpTab(t) {
    mpEl.dataset.tab = t;
    mpEl.querySelectorAll('.mp-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    if (mpMap) requestAnimationFrame(() => { if (mpIsOpen() && mpMap) mpMap.invalidateSize(); });
  }

  function buildMp() {
    const el = document.createElement('div');
    el.id = 'mp'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '모임 장소 지도');
    const field = (id, label, inner) => '<div class="mp-f"><label for="' + id + '">' + label + '</label>' + inner + '</div>';
    el.innerHTML =
      '<div class="mp-bar">' +
        '<button type="button" class="link-btn mp-x" id="mp-close">‹ 닫기</button>' +
        '<strong>모임 장소</strong>' +
        '<div class="mp-tabs"><button type="button" data-t="l">목록</button><button type="button" data-t="r">지도</button></div>' +
      '</div>' +
      '<div class="mp-sub"></div>' +
      '<div class="mp-l">' +
        '<button type="button" class="mp-ptog" id="mp-ptog" aria-expanded="true">‹ 목록 접기</button>' +
        '<div class="mp-view" id="mp-list">' +
          '<div class="mp-loc" id="mp-loc"></div>' +
          '<div class="mp-top"><span class="mp-count" id="mp-count"></span><button type="button" class="mp-add" id="mp-add">＋ 장소 추가</button></div>' +
          '<input id="mp-q" class="mp-in" type="search" placeholder="이름·주소·메모로 찾기" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" aria-label="장소 찾기">' +
          '<div class="mp-chips" id="mp-chips"></div>' +
          '<div id="mp-items"></div>' +
        '</div>' +
        '<div class="mp-view" id="mp-form" hidden>' +
          '<h3 id="mp-ftitle">장소 추가</h3>' +
          field('mp-f-name', '이름 <b>*</b>', '<input id="mp-f-name" class="mp-in" type="text" maxlength="60" placeholder="예: OO커피 강동점" autocomplete="off" enterkeyhint="next">') +
          '<div class="mp-f"><label>위치 <b>*</b></label><div class="mp-ll" id="mp-f-ll"></div>' +
            '<div class="mp-btns"><button type="button" class="mp-btn" id="mp-f-gps">현재 위치로</button><button type="button" class="mp-btn" id="mp-f-pick">지도에서 고르기</button></div>' +
            '<div class="mp-addr"><input id="mp-f-addr" class="mp-in" type="text" maxlength="120" placeholder="주소 (예: 서울 강동구 강동대로 229)" autocomplete="off" enterkeyhint="search" aria-label="주소">' +
              '<button type="button" class="mp-btn" id="mp-f-find">주소로 찾기</button></div>' +
            '<div class="mp-res" id="mp-f-res" hidden></div><p class="mp-msg" id="mp-f-msg" hidden></p></div>' +
          field('mp-f-tel', '전화', '<input id="mp-f-tel" class="mp-in" type="tel" inputmode="tel" maxlength="30" placeholder="예: 02-1234-5678" autocomplete="off" enterkeyhint="next">') +
          field('mp-f-hours', '영업시간', '<input id="mp-f-hours" class="mp-in" type="text" maxlength="80" placeholder="예: 매일 09:00–22:00 (월 휴무)" autocomplete="off" enterkeyhint="next">') +
          field('mp-f-cap', '수용 인원', '<div class="mp-cap"><input id="mp-f-cap" class="mp-in" type="number" inputmode="numeric" min="0" max="999" placeholder="예: 20" enterkeyhint="next"><span>명</span></div>') +
          '<div class="mp-f"><label>편의 항목</label><div class="mp-chips" id="mp-f-amen"></div></div>' +
          '<div class="mp-f"><label>지도 핀 색</label><div class="mp-cols" id="mp-f-col" role="radiogroup" aria-label="지도 핀 색"></div></div>' +
          field('mp-f-memo', '메모', '<textarea id="mp-f-memo" class="mp-in" rows="4" maxlength="1000" placeholder="예: 2층 별실은 8명까지, 오후 3시 이후 한산"></textarea>') +
          '<div class="mp-fa"><button type="button" class="mp-act" id="mp-f-save">저장</button><button type="button" class="mp-btn" id="mp-f-cancel">취소</button><button type="button" class="mp-btn warn" id="mp-f-del" hidden>삭제</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="mp-r"><div class="mp-mapwrap">' +
        '<div id="mp-map"></div>' +
        '<div class="mp-note" id="mp-note" hidden>지도 바탕을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. 목록과 핀 위치는 그대로 쓸 수 있습니다.</div>' +
        '<div class="mp-bhint" id="mp-bhint" hidden></div>' +
        '<button type="button" class="mp-me" id="mp-me" aria-label="내 위치로 이동">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg></button>' +
        '<div class="mp-bf" id="mp-bf" role="group" aria-label="카페 종류" hidden>' +
          '<button type="button" data-f="all">전체</button><button type="button" data-f="fr">프랜차이즈</button><button type="button" data-f="ind">개인</button></div>' +
        '<button type="button" class="mp-br" id="mp-br" aria-label="카페 표시" aria-pressed="true">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10h11v4.5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V10z"/><path d="M16 11h1.4a2.4 2.4 0 0 1 0 4.8H16"/><path d="M8.5 3.5v3M12.5 3.5v3"/></svg></button>' +
        '<button type="button" class="mp-subway" id="mp-sw" aria-label="지하철역 표시" aria-pressed="true">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="3.5" width="13" height="13" rx="3.6"/><path d="M5.5 10.5h13"/><circle cx="9" cy="13.6" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="13.6" r=".9" fill="currentColor" stroke="none"/><path d="M8.4 20.5l1.7-4M15.6 20.5l-1.7-4"/></svg></button>' +
        '<button type="button" class="mp-bg" id="mp-bg" aria-label="보드게임 카페 표시" aria-pressed="true" hidden>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none"/></svg></button>' +
        '<div class="mp-card" id="mp-card" hidden></div>' +
        '<div class="mp-cross" id="mp-cross" hidden><i></i></div>' +
        '<div class="mp-pick" id="mp-pick" hidden><span>지도를 끌어 가운데 십자(+)를 카페 위치에 맞춘 뒤 눌러 주세요.</span>' +
          '<button type="button" class="mp-btn" id="mp-pick-no">취소</button><button type="button" class="mp-act" id="mp-pick-ok">여기로 정하기</button></div>' +
      '</div></div>' +
      '<div class="mp-foot"></div>';
    document.body.appendChild(el);
    mpEl = el;

    mpS('#mp-close').addEventListener('click', mpTryClose);
    mpS('#mp-ptog').addEventListener('click', () => {
      const off = mpEl.classList.toggle('pl-off');
      const b = mpS('#mp-ptog');
      b.textContent = off ? '목록 펼치기 ›' : '‹ 목록 접기'; b.setAttribute('aria-expanded', off ? 'false' : 'true');
    });
    mpEl.querySelectorAll('.mp-tabs button').forEach((b) => b.addEventListener('click', () => mpTab(b.dataset.t)));
    // 목록
    mpS('#mp-add').addEventListener('click', () => mpOpenForm(null));
    mpS('#mp-q').addEventListener('input', (e) => { mpSearch = e.target.value; mpRefresh(); });
    mpS('#mp-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
    mpS('#mp-chips').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-k]');
      if (!b) return;
      if (mpFilt.has(b.dataset.k)) mpFilt.delete(b.dataset.k); else mpFilt.add(b.dataset.k);
      mpRefresh();
    });
    mpS('#mp-items').addEventListener('click', (e) => {
      const it = e.target.closest('.mp-item');
      if (!it) return;
      const p = mpFind(it.dataset.id);
      if (!p) return;
      if (e.target.closest('.mp-it-edit')) { mpOpenForm(p); return; }
      if (mpNarrow()) mpTab('r');
      mpSelect(p.id, { fly: true });
    });
    // 입력 화면
    mpS('#mp-f-gps').addEventListener('click', mpFormGps);
    mpS('#mp-f-pick').addEventListener('click', mpPickStart);
    mpS('#mp-f-find').addEventListener('click', mpFormFind);
    mpS('#mp-f-addr').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); mpFormFind(); } });
    mpS('#mp-f-amen').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-k]');
      if (!b) return;
      if (mpFormAmen.has(b.dataset.k)) mpFormAmen.delete(b.dataset.k); else mpFormAmen.add(b.dataset.k);
      b.classList.toggle('on', mpFormAmen.has(b.dataset.k));
    });
    mpS('#mp-f-col').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-c]');
      if (!b) return;
      mpFormCol = +b.dataset.c;
      mpSyncCol();
    });
    ['#mp-f-name', '#mp-f-tel', '#mp-f-hours', '#mp-f-cap'].forEach((q) => mpS(q).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }));
    mpS('#mp-f-save').addEventListener('click', mpFormSave);
    mpS('#mp-f-cancel').addEventListener('click', mpCloseForm);
    mpS('#mp-f-del').addEventListener('click', mpFormDelete);
    // 지도 위 단추
    mpS('#mp-br').addEventListener('click', () => {
      const on = !mpBrOn();
      try { localStorage.setItem(MP_BR_LS, on ? 'on' : 'off'); } catch (e) { /* 저장 못 해도 이번에는 바뀜 */ }
      if (on) mpBrLoad();   // v63: '표시를 켰습니다/껐습니다' 검은 안내는 없앴다(켜졌는지는 단추 모양으로 안다)
      else if (mpBrSel >= 0) { mpBrClearSel(); mpRenderCard(mpSel ? mpFind(mpSel) : null); }
      mpBrDraw();
    });
    mpS('#mp-bg').addEventListener('click', () => {
      const on = !mpBgOn();
      try { localStorage.setItem(MP_BG_LS, on ? 'on' : 'off'); } catch (e) { /* 저장 못 해도 이번에는 바뀜 */ }
      if (on) mpBgLoad();
      else if (mpBgSel >= 0) { mpBgClearSel(); mpRenderCard(mpSel ? mpFind(mpSel) : null); }
      mpBrDraw();
    });
    mpS('#mp-sw').addEventListener('click', () => {
      const on = !mpSwOn();
      try { localStorage.setItem(MP_SW_LS, on ? 'on' : 'off'); } catch (e) { /* 저장 못 해도 이번에는 바뀜 */ }
      mpSwSync(); mpSwRefresh();
    });
    mpSwSync();
    mpS('#mp-bf').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-f]');
      if (!b) return;
      try { localStorage.setItem(MP_BRF_LS, b.dataset.f); } catch (er) { /* 저장 못 해도 이번에는 바뀜 */ }
      const sel = mpBrSel >= 0 && mpBrDB ? mpBrDB.r[mpBrSel] : null;
      if (sel && (b.dataset.f === 'fr' ? sel[0] < 0 : b.dataset.f === 'ind' ? sel[0] >= 0 : false)) { mpBrClearSel(); mpRenderCard(mpSel ? mpFind(mpSel) : null); }   // 걸러져 사라질 카페의 카드는 닫는다
      else if (sel) { const i = mpBrSel; mpBrSelect(i); }   // 남는 카페의 카드는 '같은 자리' 목록을 새 필터에 맞게 다시 그린다
      mpBrDraw();
    });
    mpS('#mp-me').addEventListener('click', () => {
      if (mpMe && mpMap) { mpGo(mpMe.lat, mpMe.lng, Math.max(mpMap.getZoom(), 15)); mpRefreshLoc(false); }
      else mpRefreshLoc(true);
    });
    mpS('#mp-pick-ok').addEventListener('click', () => mpPickEnd(true));
    mpS('#mp-pick-no').addEventListener('click', () => mpPickEnd(false));
    if (window.ResizeObserver) new ResizeObserver(() => { if (mpIsOpen()) layoutMp(); }).observe(el);
  }

  async function openMp() {
    closeSpot();
    if (!mpEl) buildMp();
    mpEl.hidden = false;
    mpUserMoved = false;
    mpVecFail = ''; mpVecInfo = ''; mpNoteHold = 0;   // 지난번에 벡터가 안 됐어도 지도를 열 때마다 한 번 더 시도한다
    mpApplyTile();   // 열 때마다 바탕을 다시 맞춘다
    mpTab('l');
    layoutMp();
    mpShowView(mpView);
    mpRenderList();
    setTimeout(layoutMp, 120);
    mpRefreshLoc(false);   // 열 때마다 내 위치를 새로 읽는다 (처음에는 iOS가 위치 허용을 묻는다)
    try { await mpLoadLeaflet(); } catch (e) {
      if (mpIsOpen()) { const n = mpS('#mp-note'); n.textContent = '지도 부품을 불러오지 못했습니다. 앱을 다시 열어 보세요. 목록은 그대로 쓸 수 있습니다.'; n.hidden = false; }
      return;
    }
    if (!mpIsOpen()) return;
    mpEnsureMap();
    layoutMp();
  }
  function closeMp() {
    if (!mpEl) return;
    if (mpView === 'form') mpCloseForm();   // 입력 화면을 열어 둔 채 닫아도, 다음에 열면 목록부터 보인다 (작성 중인 내용이 있으면 mpTryClose가 먼저 막는다)
    if (mpPicking) mpPickEnd(false);
    mpEl.hidden = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  onMenu($('#btn-pick'), () => { showBooks(pos.book >= 39 ? 'nt' : 'ot'); openSheet(false); });
  onMenu($('#btn-settings'), () => { showSettings(); openSheet(false); });
  onMenu($('#btn-hl'), () => { showHighlights(); openSheet(false); });
  onMenu($('#btn-notes'), () => { showNotes(); openSheet(true); });
  onMenu($('#btn-card'), () => { openPc(); });
  onMenu($('#btn-map'), () => { openMp(); });
  onMenu($('#btn-ask'), () => { showInquiry(); openSheet(false); });
  onMenu($('#btn-search'), () => {
    const input = showSearch();
    openSheet(true);
    input.focus();   // 버튼을 누른 같은 순간에 포커스를 줘야 아이폰에서 키보드가 올라온다
  });

  // ---------- 설치 안내(아이폰 Safari에서만) ----------
  function maybeShowHint() {
    const standalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const seen = localStorage.getItem('bf.hint') === '1';
    if (NATIVE || standalone || !ios || seen) return;
    $('#hint').hidden = false;
  }
  $('#hint-close').addEventListener('click', () => {
    $('#hint').hidden = true;
    try { localStorage.setItem('bf.hint', '1'); } catch (e) { /* 무시 */ }
  });

  // ---------- 시작 ----------
  async function start() {
    try {
      const res = await fetch('data/krv.json');
      bible = await res.json();
    } catch (e) {
      $('#loading').textContent = '본문을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 열어 주세요.';
      return;
    }
    if (!(pos.book >= 0 && pos.book < bible.books.length)) pos = { book: 0, chapter: 0, verse: 1 };
    migrateMarks();
    await rebuild(pos);
  }

  if (!NATIVE && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  start();
})();
