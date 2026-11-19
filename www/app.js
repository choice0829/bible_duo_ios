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
  const NATIVE_TEXT_OUT = 30;           // 앱 펼침: 화면 바깥쪽 가장자리에서 본문 글자까지(px). 책 카드 없이 화면 전체를 책장으로 쓴다 (v41)
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
  const APP_VER = 'v45';   // sw.js의 CACHE 숫자와 함께 올린다. 고급설정 → 화면 정보에 표시돼, 새 버전이 적용됐는지 확인할 수 있다.
  const THEMES = { paper: '종이', sepia: '세피아', night: '야간' };
  const DESKS = { plain: '단색', linen: '린넨', wood: '나무결', leather: '가죽' };   // 책상(상단 배경) 질감
  const DESK_DEFAULT = 'linen';
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
  let settings = store.get('bf.settings', { fontSize: 18, theme: 'paper', layout: 'auto', font: 'myeongjo', std: false, desk: DESK_DEFAULT });
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
  // 한 쪽(접힘·세로) 화면의 메뉴 단추: 책 이름 오른쪽에 MENU_COLS개씩 줄을 나눠 놓는다 (6개 → 3개씩 2줄). 펼친 화면은 한 줄.
  const MENU_COUNT = 6, MENU_COLS = 3;
  const MENU_ROWS = Math.ceil(MENU_COUNT / MENU_COLS);
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
      padX: full ? padOut : padX, padOut, padIn, full, tabEdge: full ? Math.max(padOut - 6, 0) : shiftX,
      padTop, padBottom, si, shiftX, eff, stageTop, txtTop, headR, intoPill,
      textW: pageW - padOut - padIn, textH: pageH - txtTop - padBottom,
    };
  }

  // 책 이름이 길어 한 줄에 다 안 들어가면 글자를 조금씩 줄여 이름이 잘리지 않게 한다 (최소 24px)
  function fitTitle() {
    const b = $('#loc-book');
    if (!b) return;
    const root = document.documentElement.style;
    const base = lastTitleFs || 44;
    let fs = base;
    root.setProperty('--title-fs', fs + 'px');
    while (fs > 18 && b.scrollWidth > b.clientWidth + 1) { fs -= 2; root.setProperty('--title-fs', fs + 'px'); }
  }
  let lastTitleFs = 44;

  // 테마(종이·세피아·야간)와 책상 질감을 body 클래스로 적용하고, 상태 표시줄 색(theme-color)을 책상 색에 맞춘다.
  const deskOf = () => (DESKS[settings.desk] ? settings.desk : DESK_DEFAULT);
  function applyDesk() {
    const look = ' theme-' + settings.theme + ' desk-' + deskOf();
    const strip = (el) => el.className.replace(/\b(theme|desk)-\w+/g, '').replace(/\s+/g, ' ').trim();
    document.body.className = strip(document.body) + look;
    // html(캔버스)에도 같은 클래스를 달아, 책 바깥 여백(듀오 오른쪽 안전영역 등)이 흰색 대신 책상 색·질감으로 칠해지게 한다
    document.documentElement.className = (strip(document.documentElement) + look).trim();
    refreshSystemColor();
    // 아이폰 앱: 상태 표시줄 글자색(밝게/어둡게)과 빈틈 색을 테마에 맞추도록 앱에 알린다
    try { if (NATIVE) window.webkit.messageHandlers.bf.postMessage({ theme: settings.theme }); } catch (e) { /* 무시 */ }
  }
  // iOS가 오른쪽(듀오 시스템 띠)·위쪽 색을 읽는 곳(theme-color, 가장자리에 닿은 고정 요소)은 테마를 바꿔도 곧바로 다시 읽지 않는 경우가 있다.
  // (v36 실기기: 야간으로 바꿨는데 띠에 세피아색이 그대로 남음) → 색이 바뀌면 meta와 가장자리 띠를 새 노드로 갈아 끼우고, 잠시 뒤 두 번 더 한다.
  // 앱을 켤 때·다시 열 때·화면 크기가 바뀔 때(접기/펴기)도 같은 방식으로 한 번씩 다시 읽게 한다.
  let sysColorKey = '', sysColorTimers = [];
  function refreshSystemColor(force) {
    if (NATIVE) return;   // 앱 안에서는 시스템 띠 색을 읽을 일이 없다
    const desk = getComputedStyle(document.body).getPropertyValue('--desk').trim();
    if (!desk) return;
    const key = settings.theme + '|' + deskOf() + '|' + desk;
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
    if (!launchSnapped) { launchSnapped = true; takeSnap('시작', g); afterRestartCheck(g); }
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
  barKinds.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) guard(() => applyKind(b.dataset.kind)); });
  barPens.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    tool.pen = b.dataset.pen; store.set('bf.tool', tool); paintBarTools();
  });
  barColors.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    tool.c = +b.dataset.c; store.set('bf.tool', tool); paintBarTools();
  });
  $('#ab-close').addEventListener('click', clearSelection);
  $('#ab-all').addEventListener('click', () => guard(() => replaceAct((it) => { it.s = 0; it.e = itemText(it).length; })));
  $('#ab-erase').addEventListener('click', () => guard(eraseSel));
  $('#ab-s-prev').addEventListener('click', () => guard(() => moveEdge('s', -1)));
  $('#ab-s-next').addEventListener('click', () => guard(() => moveEdge('s', 1)));
  $('#ab-e-prev').addEventListener('click', () => guard(() => moveEdge('e', -1)));
  $('#ab-e-next').addEventListener('click', () => guard(() => moveEdge('e', 1)));
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
    turning = true;
    const f = flip;   // 애니메이션 도중 책이 다시 만들어지면(회전 등) 새 책에는 손대지 않는다
    try {
      f.startUserTouch({ x: -9999, y: -9999 });
      f.userMove({ x: x0, y: edge }, true);      // 방향·모서리 결정
    } catch (err) { turning = false; return; }
    const t0 = performance.now();
    const pt = (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // 천천히 시작해 빨라졌다 느려지게
      return { x: x0 + (x1 - x0) * e, y: edge - r.height * 0.1 * Math.sin(Math.PI * k) };
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

  // 손가락의 위아래 움직임은 15%만 반영한다. 그대로 쓰면 접힘선이 크게 비스듬해져 어색하다.
  function stagePt(e, r, corner) {
    const edge = corner === 'bottom' ? r.height - 2 : 2;
    const y = e.clientY - r.top;
    return { x: e.clientX - r.left, y: edge + (y - edge) * 0.15 };
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
  function endPointer(e, cancelled) {
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
  ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach((ev) => window.addEventListener(ev, () => { selecting = false; }));
  stage.addEventListener('pointerup', (e) => endPointer(e, false));
  stage.addEventListener('pointercancel', (e) => endPointer(e, true));
  window.addEventListener('keydown', (e) => {
    if (pcIsOpen()) { if (e.key === 'Escape') closePc(); return; }   // 포토카드 화면이 열려 있으면 책장은 넘기지 않는다
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
  let rotCount = 0, rotRebuilt = 0, rotLast = '';
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
      rotLast = '배율 ' + (window.visualViewport.scale).toFixed(2) + ' → 바로잡기 ' + scaleKicks + '회';
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
        if (recTries) addRecLog('정상 값으로 돌아옴(' + recTries + '단계 뒤)');
        recTries = 0; recGiveUp = {};
      } else if (key !== lastGeo && !recGiveUp[key]) {
        if (recTries < 2 && waited < 9000) {
          recTries++;
          addRecLog(bad + ' → ' + recTries + '단계 되돌리기');
          doRecover(recTries);
          rotLast = bad + ' → ' + recTries + '단계 되돌리기';
          settleKey = ''; settleSame = 0;
          settleTimer = setTimeout(settleTick, 800);
          return;
        }
        if (canAutoRestart()) { restartApp(bad, true); return; }
        recGiveUp[key] = true;
        addRecLog('되돌리지 못함 → 그대로 둠 (' + bad + ')');
      }
      if (!bad && key !== lastGeo && softSuspect(g)) softNudge(g);
      takeSnap('회전 뒤', g);
      const target = rotPos || pos, n = settleSame, w = waited;
      settleStart = 0; rotPos = null;
      rotCount++;
      if (key !== lastGeo) {
        rotRebuilt++;
        rotLast = g.W + '×' + g.H + ' 안전영역 ' + [g.si.top, g.si.right, g.si.bottom, g.si.left].join('/') + ' · ' + w + 'ms 기다림(' + n + ') → 다시 만듦';
        rebuild(target);   // 다 만든 뒤 확인은 rebuild 끝에서 예약한다
      } else {
        rotLast = g.W + '×' + g.H + ' · ' + w + 'ms → 그대로';
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
      healLast = '배치 어긋남: ' + why;
      healCount++;
      if (scaleOff()) kickViewport(true);
      if (verifyTries++ < 3) { rotRebuilt++; rotLast = healLast; verifying = true; rebuild(pos); }
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
  // 밀린 것을 발견하면 제자리로 돌리고, 그래도 안 되면 책을 다시 만든다. 몇 번 있었는지는 설정의 '화면 진단'에 남는다.
  let healCount = 0, healLast = '', healRebuilt = 0;
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
    healCount++;
    healLast = found.join(' · ');
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

  // ---------- 화면 기록 · 어긋남 복구 (v28) ----------
  // 아이폰 듀오는 가로 → 세로 → 가로로 돌린 뒤, 앱이 받는 화면 정보(안전영역 등)가 실제 화면과 맞지 않는 채 남는 일이 있다.
  // (예: 가로인데 안전영역이 세로 때의 '아래 34'로 읽히고 화면이 위로 올라가 있음) 이 값은 앱이 직접 고칠 수 없으므로
  //  ① 그런 상태를 알아채면 viewport 태그 갈아 끼우기 → 문서 다시 계산시키기 → (마지막으로) 앱 다시 시작 순서로 되돌려 보고
  //  ② 몇 번 돌렸는지와 회전 때마다의 화면 값을 '화면 진단'에 남겨, 정상일 때와 비교할 수 있게 한다.
  const snaps = (() => { const s = store.get('bf.snaps', { list: [] }); return Array.isArray(s.list) ? s.list.slice(-8).map(String) : []; })();
  const recLog = [];
  let recTries = 0, recGiveUp = {}, launchSnapped = false;
  let touchMax = { x: 0, y: 0 }, touchOut = 0, touchLast = '';
  const hms = () => { const d = new Date(); return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); };
  function addRecLog(msg) { recLog.push(hms() + ' ' + msg); while (recLog.length > 6) recLog.shift(); }
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
  function unitProbe() {
    const o = unitSizes();
    return Object.keys(o).map((k) => k + ' ' + (o[k] ? o[k][0] + '×' + o[k][1] : '-')).join(' · ');
  }
  // 바깥 창·큰 화면(lvh) 높이와 앱이 아는 높이(H)의 차. 가로 화면에서 이 차가 크면 앱이 아는 화면이 실제보다 낮다는 뜻이다.
  function heightGap(H) {
    const o = unitSizes();
    return Math.max(window.outerHeight || 0, o.lvw ? o.lvw[1] : 0, o.vw ? o.vw[1] : 0) - H;
  }
  function takeSnap(tag, g0) {
    try {
      const g = g0 || geometry(), v = window.visualViewport;
      const so = window.screen && screen.orientation ? screen.orientation.type.replace(/-(primary|secondary)/, '') + ' ' + screen.orientation.angle + '°' : '-';
      snaps.push(hms() + ' ' + tag + ' · ' + (g.H >= g.W ? '세로' : '가로') + ' ' + g.W + '×' + g.H +
        ' · 안전영역 ' + [g.si.top, g.si.right, g.si.bottom, g.si.left].map(Math.round).join('/') +
        ' · 배율 ' + (v ? v.scale.toFixed(2) : '-') + ' · ' + unitProbe() +
        ' · 바깥 ' + window.outerWidth + '×' + window.outerHeight + ' · 화면 ' + screen.width + '×' + screen.height + ' ' + so);
      while (snaps.length > 8) snaps.shift();
      store.set('bf.snaps', { list: snaps });
    } catch (e) { /* 무시 */ }
  }
  // 손가락이 닿은 곳이 앱이 아는 화면 밖이면 기록해 둔다 (앱이 아는 화면이 실제보다 작다는 증거)
  window.addEventListener('pointerdown', (e) => {
    touchMax = { x: Math.max(touchMax.x, Math.round(e.clientX)), y: Math.max(touchMax.y, Math.round(e.clientY)) };
    if (e.clientX >= window.innerWidth - 0.5 || e.clientY >= window.innerHeight - 0.5) { touchOut++; touchLast = Math.round(e.clientX) + ',' + Math.round(e.clientY); }
  }, true);
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
    addRecLog('가벼운 확인 1회');
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
      addRecLog('앱 다시 시작' + (auto ? '(자동)' : '(직접)'));
      store.set('bf.snaps', { list: snaps });
    } catch (e) { /* 무시 */ }
    location.reload();
  }
  // 고급설정의 '다시 맞추기': 1·2단계를 차례로 하고 화면을 처음부터 다시 계산해 책을 새로 만든다
  function refitScreen() {
    addRecLog('직접 다시 맞추기');
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
        addRecLog('다시 시작 뒤에도 어긋난 값 → 자동 다시 시작 끔');
      } else if (rec.t && Date.now() - rec.t < 30000) {
        addRecLog('다시 시작 뒤 정상');
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
      stuckTicks = 0; healCount++; healLast = '책장이 중간에 멈춤(' + st + ')';
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
  // → --kb(px)와 html.kb 클래스로 창(#sheet)·포토카드 화면(#pc)을 키보드 위쪽 영역에 맞추고, 입력 중인 칸이 보이도록 스크롤한다.
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
    if (kbH > 0) revealFocused();
  };
  document.addEventListener('focusin', () => { setTimeout(fitSheet, 50); if (kbH > 0) revealFocused(); });
  document.addEventListener('focusout', () => setTimeout(fitSheet, 50));
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

  // 화면 크기 진단: 접은 화면의 좌우 공백 원인을 찾기 위해 실제로 그려진 크기를 보여 준다.
  function diagText() {
    const R = (el) => { if (!el) return '-'; const r = el.getBoundingClientRect(); return Math.round(r.left) + '~' + Math.round(r.right) + ' (폭 ' + Math.round(r.width) + ') × 위 ' + Math.round(r.top) + '~' + Math.round(r.bottom); };
    const vis = [...document.querySelectorAll('#stage .page')].find((el) => el.getBoundingClientRect().width > 0);
    const v = window.visualViewport;
    const g = pg && pg.g;
    const rec = store.get('bf.rec', { t: 0, n: 0, noauto: false });
    return [
      '창 ' + window.innerWidth + '×' + window.innerHeight + ' · 보이는 영역 ' + (v ? Math.round(v.width) + '×' + Math.round(v.height) + ' 배율 ' + v.scale : '-'),
      '화면 ' + screen.width + '×' + screen.height + ' · DPR ' + window.devicePixelRatio,
      '계산 ' + (g ? '폭 ' + g.W + ' 쪽폭 ' + g.pageW + ' 좌우여백 ' + g.padX + ' 본문폭 ' + g.textW : '-'),
      '무대 ' + R($('#stage')),
      '쪽 ' + R(vis),
      '본문 ' + R(vis && vis.querySelector('.txt')),
      '밀림 바로잡음 ' + healCount + '번' + (healLast ? ' (마지막: ' + healLast + ')' : '') + ' · 스크롤 ' + Math.round(window.scrollY) + ' · 보이는 영역 위 ' + (v ? Math.round(v.offsetTop) : '-'),
      '안전영역 위/오른/아래/왼 ' + (g ? [g.si.top, g.si.right, g.si.bottom, g.si.left].map(Math.round).join('/') : '-') + ' · 머리줄 아래 ' + (document.querySelector('.head-row') ? Math.round(document.querySelector('.head-row').getBoundingClientRect().bottom) : '-') + ' · 본문 시작 ' + (g ? g.padTop : '-'),
      '회전·접기 ' + rotCount + '번(다시 만듦 ' + rotRebuilt + ')' + (rotLast ? ' · 마지막: ' + rotLast : ''),
      '배율 ' + (v ? v.scale.toFixed(2) : '-') + ' · 보이는 영역 ' + (v ? Math.round(v.width) + '×' + Math.round(v.height) : '-') + ' · innerWidth ' + window.innerWidth + '×' + window.innerHeight + ' · 문서 폭 ' + document.documentElement.scrollWidth + ' · 기기 ' + screen.width + '×' + screen.height + ' · 배율 바로잡기 ' + kickTotal + '번',
      '지금 단위 ' + unitProbe() + ' · 문서 ' + document.documentElement.clientWidth + '×' + document.documentElement.clientHeight +
        ' · 바깥 ' + window.outerWidth + '×' + window.outerHeight + ' · 쓸 수 있는 화면 ' + screen.availWidth + '×' + screen.availHeight +
        ' · 방향 ' + (screen.orientation ? screen.orientation.type + ' ' + screen.orientation.angle + '°' : '-'),
      '앱이 아는 높이와 바깥 창 높이의 차 ' + (g ? Math.round(heightGap(g.H)) : '-') + ' (가로에서 40 이상이면 어긋남)',
      '터치 최대 ' + touchMax.x + ',' + touchMax.y + ' · 앱이 아는 화면 밖 ' + touchOut + '번' + (touchLast ? ' (마지막 ' + touchLast + ')' : ''),
      '어긋남 복구 ' + (recLog.length ? recLog.join(' / ') : '없음') + (rec.t ? ' · 앱 다시 시작 ' + (rec.n || 0) + '번' + (rec.noauto ? '(자동 끔)' : '') : ''),
      '<b>최근 화면 기록</b> (오래된 것부터)<br>' + (snaps.length ? snaps.map((x) => '· ' + x).join('<br>') : '-'),
    ].join('<br>');
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
  const trBtn = $('#btn-easy');
  const syncTrBtn = () => { trBtn.classList.toggle('on', !!settings.std); trBtn.setAttribute('aria-pressed', settings.std ? 'true' : 'false'); };
  syncTrBtn();
  // 'AI 표준어 번역'을 골랐을 때 그 아래에 나오는 보기와 안내문
  const STD_INFO =
    '<div class="easy-eg typo"><div class="eg-h">보기 (창세기 1장 1절)</div>' +
    '<p><sup class="vn">1</sup>태초에 하나님이 천지를 창조하시니라</p>' +
    '<p class="std">태초에 하나님이 하늘과 땅을 창조하셨다.</p></div>' +
    '<p class="note">※ 이 풀이는 개역한글의 뜻을 현대 표준어로 옮겨 쓴 <b>참고용 글</b>입니다. 공식 번역본이 아니며, 본문과 조금 다르게 읽힐 수 있으니 정확한 뜻은 개역한글 본문과 함께 확인해 주세요. 설교나 가르침에 쓰기 전에는 목회자·전문가의 검토를 권합니다.</p>';
  function showTranslations() {
    sheetTitle.textContent = '번역 선택';
    setSheetAct(null);
    backBtn.hidden = true;
    sheetBack = null;
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
      syncTrBtn();
      $('#tr-info-std').hidden = !settings.std;   // 고르면 안내문이 나오고, 끄면 사라진다
      clearTimeout(settingsTimer);
      settingsTimer = setTimeout(() => rebuild(pos), 250);   // 창은 그대로 두고 뒤의 본문만 다시 만든다 (읽던 위치 유지)
    });
  }

  function showSettings() {
    sheetTitle.textContent = '읽기 설정';
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
      '<div class="row"><span>책상 질감</span>' + seg(DESKS, deskOf(), 'desk') + '</div>' +
      '<div class="row col"><span>글씨체</span><div class="fontgrid">' + Object.keys(FONTS).map((k) =>
        '<button class="fbtn' + (k === settings.font ? ' on' : '') + '" data-k="font" data-v="' + k +
        '" style="font-family:' + FONTS[k].stack.replace(/"/g, "'") + '">' + FONTS[k].label + '<small>가나다 창조 Aa</small></button>').join('') +
      '</div></div>' +
      '<div class="row"><span>화면 구성</span>' + seg(LAYOUTS, settings.layout, 'layout') + '</div>' +
      '<button class="row rowlink" id="go-adv" type="button"><span>고급설정 <small class="sub">여백 · 위치 · 화면 정보</small></span><span class="chev">›</span></button>' +
      '<p class="note">자동: 화면이 넓으면(펼친 상태) 두 쪽, 좁으면(접힌 상태) 한 쪽으로 보여 줍니다.<br>본문: 개역한글 (퍼블릭 도메인)</p>';
    $('#go-adv').addEventListener('click', () => { showAdvanced(); sheetBody.scrollTop = 0; });
    sheetBody.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, settings.fontSize + (+b.dataset.f)));
      if (next !== settings.fontSize) changeSettings({ fontSize: next });
    }));
    sheetBody.querySelectorAll('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.k === 'desk') {   // 책 쪽 나누기와 무관: 다시 만들지 않고 바로 적용
          settings = Object.assign({}, settings, { desk: b.dataset.v });
          store.set('bf.settings', settings);
          applyDesk();
          const keep = sheetBody.scrollTop; showSettings(); sheetBody.scrollTop = keep;
          return;
        }
        changeSettings({ [b.dataset.k]: b.dataset.v });
      }));
  }

  // ---------- 고급설정: 여백 · 위치 · 화면 정보 ----------
  function showAdvanced() {
    sheetTitle.textContent = '고급설정';
    backBtn.hidden = false;
    sheetBack = () => { showSettings(); sheetBody.scrollTop = 0; };
    const g = geometry();
    const topSp = g.eff.topSpread, topSi = g.eff.topSingle, shift = g.eff.shiftX, bot = g.eff.bottomSpread;
    // 한 항목 = 이름 + 값 조절(− 값 +) + 설명
    const item = (name, sub, key, step, val, minus, plus, desc) =>
      '<div class="adv"><div class="row"><span>' + name + ' <small class="sub">' + sub + '</small></span><div class="stepper">' +
      '<button data-adv="' + key + '" data-step="-' + step + '" aria-label="' + minus + '">' + (key === 'shiftX' ? '◂' : '−') + '</button><b>' + val + '</b>' +
      '<button data-adv="' + key + '" data-step="' + step + '" aria-label="' + plus + '">' + (key === 'shiftX' ? '▸' : '+') + '</button></div></div>' +
      '<p class="adv-desc">' + desc + '</p></div>';
    // 안전영역 때문에 실제 적용된 윗 여백이 설정값과 다른 경우만 알려 준다
    const topNote = g.spread && g.padTop !== topSp
      ? '<br><b>※ 지금 화면의 안전영역(위 ' + g.si.top + ') 때문에 실제로는 ' + g.padTop + 'px로 적용됩니다.</b>' : '';
    sheetBody.innerHTML =
      '<div class="adv-head">펼친 화면 (두 쪽)</div>' +
      item('윗 여백', '(펼침)', 'topSpread', 4, topSp, '줄이기', '늘리기',
        '화면 맨 위에서 본문이 시작되는 곳까지의 높이입니다. 이 안에 책 이름·메뉴 아이콘과 오른쪽 위 상태 아이콘이 들어갑니다. 줄이면 본문이 더 위로 올라와 한 쪽에 들어가는 줄 수가 늘어납니다.' + topNote) +
      (NATIVE ? '' : item('가로 위치', '(오른쪽으로)', 'shiftX', 4, shift, '왼쪽으로', '오른쪽으로',
        '두 쪽 전체를 오른쪽으로 옮기는 양입니다. 아이폰 듀오를 펼치면 앱이 실제 화면보다 좁은 영역만 알려 받아 두 쪽이 왼쪽으로 쏠려 보입니다. 값을 키우면 가운데로 오지만, 옮긴 만큼 한 쪽의 폭이 좁아져 한 줄에 들어가는 글자가 줄어듭니다.')) +
      item('아래 여백', '(펼침)', 'bottomSpread', 4, bot, '줄이기', '늘리기',
        '본문 맨 아래에 비워 두는 높이입니다. 화면 맨 아래 일부는 앱이 그릴 수 없는 영역이라, 0으로 해도 그만큼은 비어 보입니다.') +
      '<div class="adv-head">접은 화면 (한 쪽)</div>' +
      item('윗 여백', '(한 쪽)', 'topSingle', 4, topSi, '줄이기', '늘리기',
        '접은 상태에서 본문이 시작되는 높이입니다. 접은 화면은 책 이름 아래에 메뉴 아이콘이 한 줄 더 있어서, 너무 줄이면 본문과 겹칩니다.') +
      '<div class="row"><span>여백 기본값으로 되돌리기</span><button class="seg-btn" id="adv-reset" type="button">되돌리기</button></div>' +
      '<button class="row rowlink" id="go-bk" type="button"><span>데이터 백업 <small class="sub">하이라이트 · 읽던 위치 내보내기/불러오기</small></span><span class="chev">›</span></button>' +
      '<p class="note">기본값은 기기와 화면에 맞춰 자동으로 정해집니다(듀오 펼침: 윗 ' + TOP_DEFAULT.topSpread + ' · 가로 위치 ' + SHIFT_DEFAULT + ' · 아래 ' + BOTTOM_SPREAD_DEFAULT + ', 한 쪽 윗 ' + TOP_DEFAULT.topSingle + '). 가로로 돌린 아이폰은 머리줄이 작아지고 노치 쪽이 비워집니다.' +
      '<br>값을 바꾸면 본문이 잠시 뒤에 새로 정렬됩니다. 읽던 위치는 그대로 유지됩니다.</p>' +
      '<div class="adv-head">화면 정보</div>' +
      '<p class="note tight">현재 화면 ' + g.W + ' × ' + g.H + ' px (창 ' + window.innerWidth + ' × ' + window.innerHeight + ') · ' + (g.spread ? '펼침(두 쪽)' : '한 쪽') +
      ' (자동 기준: 폭 ' + AUTO_SPREAD_MIN_WIDTH + 'px 이상, 또는 가로 화면이면 ' + AUTO_SPREAD_MIN_LANDSCAPE + 'px 이상)<br>안전영역 위 ' + g.si.top + ' · 아래 ' + g.si.bottom + ' · 좌 ' + g.si.left + ' · 우 ' + g.si.right +
      '<br>기기 화면 ' + screen.width + ' × ' + screen.height + ' · 배율 ' + (window.devicePixelRatio || 1) + ' · 앱 버전 ' + APP_VER + (NATIVE ? ' (아이폰 앱)' : '') + '</p>' +
      '<div class="row"><span>화면이 위로 올라가거나 작게 보일 때 <small class="sub">값을 새로 읽고 책을 다시 만듭니다</small></span><button class="seg-btn" id="adv-refit" type="button">다시 맞추기</button></div>' +
      '<div class="row"><span>앱 다시 시작 <small class="sub">읽던 위치는 그대로 · 안 고쳐지면 이걸로</small></span><button class="seg-btn" id="adv-restart" type="button">다시 시작</button></div>' +
      '<p class="note diag"><b>화면 진단</b><br>' + diagText() + '</p>';
    const LIMITS = { topSpread: [TOP_MIN_SPREAD, TOP_MAX], topSingle: [TOP_MIN_SINGLE, TOP_MAX], shiftX: [0, 160], bottomSpread: [0, 80] };
    sheetBody.querySelectorAll('[data-adv]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.adv, cur = geometry().eff[key];
      const next = Math.min(LIMITS[key][1], Math.max(LIMITS[key][0], cur + (+b.dataset.step)));
      if (next !== cur) changeSettings({ [key]: next }, showAdvanced);
    }));
    $('#go-bk').addEventListener('click', () => { showBackup(); sheetBody.scrollTop = 0; });
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
      pos, tool, anns, notes: notesDB.items,
      settings: { fontSize: settings.fontSize, theme: settings.theme, desk: deskOf(), font: settings.font, layout: settings.layout, std: !!settings.std },
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
    if (DESKS[s.desk]) patch.desk = s.desk;
    if (FONTS[s.font]) patch.font = s.font;
    if (LAYOUTS[s.layout]) patch.layout = s.layout;
    if (typeof s.std === 'boolean') patch.std = s.std;
    settings = Object.assign({}, settings, patch);
    store.set('bf.settings', settings);
    syncTrBtn();
    return { verses, marks, notes: notes ? notes.length : null };
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
      '<p class="note tight">하이라이트·설교노트·읽던 위치·글꼴 설정은 <b>이 기기의 이 앱 안</b>에만 저장됩니다. ' +
      '앱 주소를 옮기거나 앱을 지우면 사라지므로, 그 전에 아래에서 백업해 두세요.</p>' +
      '<div class="adv-head">내보내기 <small class="sub">(표시한 구절 ' + n + '개 · 설교노트 ' + notesDB.items.length + '개)</small></div>' +
      '<p class="adv-desc">버튼을 눌러 복사한 뒤 메모 앱이나 카카오톡 「나에게」 같은 곳에 붙여 두세요.</p>' +
      '<textarea id="bk-out" class="bk-text" rows="4" readonly aria-label="백업 내용"></textarea>' +
      '<div class="row"><span id="bk-out-msg" class="sub">&nbsp;</span><button class="seg-btn" id="bk-copy" type="button">백업 내용 복사</button></div>' +
      '<div class="adv-head">불러오기</div>' +
      '<p class="adv-desc">복사해 둔 백업 내용을 아래 상자에 붙여 넣으세요. <b>지금 있는 표시와 설교노트는 모두 백업 내용으로 바뀝니다.</b></p>' +
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
        showToastLine('불러왔습니다 · ' + r.verses + '구절, 표시 ' + r.marks + '개' + (r.notes === null ? '' : ', 설교노트 ' + r.notes + '개'));
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
    const edge = pg.g.tabEdge != null ? pg.g.tabEdge : pg.g.shiftX;   // 노트 탭의 오른쪽 끝(책 왼쪽 가장자리, 앱 펼침은 본문 왼쪽 끝 6px 앞)
    const tw = Math.min(23, edge - 4);
    if (tw < 16) return;   // 왼쪽 여백이 너무 좁으면 탭은 생략하고 본문의 절 번호 배지만 보인다
    // 지금 펼쳐진 두 쪽(왼쪽 L, 오른쪽 L+1)만 읽는 순서대로 본다. 그 노트 본문이 처음 나오는 줄의 높이를 잡는다.
    const W = window.innerWidth, top = {};
    const L = flip.getCurrentPageIndex(), all = stage.querySelectorAll('.page');
    const want = [all[L], all[L + 1]].filter(Boolean);
    const shown = want.map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width >= 10 && x.r.right > 1 && x.r.left < W - 1);
    // 쪽이 아직 자리를 잡기 전이면 잠시 뒤 다시 시도한다 (책을 막 만든 직후·책장이 막 넘어간 직후·느린 기기)
    if (shown.length < want.length && (tries || 0) < 8) { tabsTimer = setTimeout(() => refreshTabs((tries || 0) + 1), 150); return; }
    shown.forEach((x) => {
      x.el.querySelectorAll('p.nt').forEach((p) => {
        const y = p.getBoundingClientRect().top;
        (p.dataset.n || '').split(' ').forEach((id) => { if (id && !(id in top)) top[id] = y; });
      });
    });
    const items = Object.keys(top).filter((id) => noteById(id)).map((id) => {
      const n = noteById(id);
      const label = Array.from(n.title.replace(/\s+/g, '')).slice(0, 5).join('');   // 제목 앞 5글자
      return { id, y0: top[id], label, title: n.title, h: Math.round(Array.from(label).length * 12.5 + 18) };
    }).sort((p, q) => p.y0 - q.y0);
    // 겹치지 않게 위에서부터 쌓고, 아래로 넘치면 위로 당긴다. 그래도 안 들어가면 나머지는 "+N" 하나로 줄인다.
    const topLim = 60, botLim = window.innerHeight - 10, gap = 5;
    const stack = (list) => {
      let y = -1e9;
      list.forEach((it) => { it.y = Math.max(it.y0, y, topLim); y = it.y + it.h + gap; });
      let lim = botLim;
      for (let i = list.length - 1; i >= 0; i--) { list[i].y = Math.min(list[i].y, lim - list[i].h); lim = list[i].y - gap; }
      return !list.length || list[0].y >= topLim;
    };
    let list = items;
    for (let keep = items.length; keep >= 0; keep--) {
      list = items.slice(0, keep).map((it) => Object.assign({}, it));
      if (keep < items.length) list.push({ more: items.length - keep, label: '+' + (items.length - keep), title: '설교노트 목록', y0: botLim, h: 34 });
      if (stack(list)) break;
    }
    const left = edge - tw;   // 탭의 오른쪽 끝이 책 왼쪽 가장자리에 붙는다
    tabsEl.innerHTML = list.map((it) =>
      '<button type="button" class="nt-tab" ' + (it.more ? 'data-more="1"' : 'data-note="' + it.id + '"') +
      ' aria-label="' + (it.more ? '설교노트 더 보기: ' : '설교노트: ') + esc(it.title).replace(/"/g, '&quot;') + '" ' +
      'style="--n1:' + (it.more ? '#7A7A7A' : noteColor(it.id)) + ';left:' + left + 'px;top:' + Math.round(it.y) + 'px;width:' + tw + 'px;height:' + it.h + 'px">' +
      '<b>' + esc(it.label) + '</b></button>').join('');
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
  function showToastLine(msg) {
    let t = document.getElementById('infotoast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'infotoast';
      t.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:60px;z-index:99;max-width:90%;background:#222;color:#fff;' +
        'padding:11px 16px;border-radius:12px;font-size:14px;line-height:1.4;text-align:center';
      t.addEventListener('click', () => t.remove());
      document.body.appendChild(t);
    }
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
  // ---------- 성경구절 포토카드 ----------
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
  const PC_SIZES = [[0.85, '작게'], [1, '보통'], [1.15, '크게']];
  let pcEl = null;
  function pcIsOpen() { return !!pcEl && !pcEl.hidden; }

  // 꾸밈 값(글씨체·색·틀·배경·어둡기·크기·날짜 표시)만 기억한다. 구절·문구·사진은 카드를 만들 때마다 새로 고른다.
  const pcPref = store.get('bf.pc', { font: 'nanumM', ink: 'light', frame: 'white', bg: 0, dim: 25, size: 1, showDate: true });
  if (PC_FONT_KEYS.indexOf(pcPref.font) < 0) pcPref.font = 'nanumM';
  if (!PC_FRAMES[pcPref.frame]) pcPref.frame = 'white';
  if (!(pcPref.bg >= 0 && pcPref.bg < PC_BG.length)) pcPref.bg = 0;
  pcPref.dim = Math.min(Math.max(+pcPref.dim || 0, 0), 70);
  if (!PC_SIZES.some((s) => s[0] === pcPref.size)) pcPref.size = 1;
  pcPref.ink = pcPref.ink === 'dark' ? 'dark' : 'light';
  pcPref.showDate = pcPref.showDate !== false;
  const pcSavePref = () => store.set('bf.pc', pcPref);

  const pcv = { bi: 0, c: 1, v1: 1, v2: 1 };   // 고른 구절 (장은 1부터)
  let pcKey = '';                               // 본문 칸을 마지막으로 채운 구절
  let pcVerseText = '', pcCaption = '', pcDateStr = '';
  let pcPhoto = null;                           // { img(줄여 둔 사진), w, h }
  let pcZoom = 1, pcPanX = 0, pcPanY = 0;       // 확대 배율 · 끌어서 옮긴 양(카드 픽셀)
  let pcRaf = 0;
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
  function pcFaces() { return [FONTS[pcPref.font].face, 'KF Gowun Dodum']; }
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

  function pcDraw() {
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

    // 성경 구절
    const stack = font.stack;
    const ink = light ? '#FFFFFF' : '#2B2A28';
    const text = (pcVerseText || '').trim();
    const IN = 84, bx = PC_PX + IN, by = PC_PY + IN, bw = PC_PS - IN * 2, bh = PC_PS - IN * 2;
    const refFs = 40, refBlock = 44 + 3 + 30 + Math.round(refFs * 1.2);   // 본문과 출처 사이 간격 + 짧은 줄 + 출처 글자
    let over = false;
    if (light) { ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 3; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = ink;
    let body = { fs: 0, lines: [] };
    const lhR = 1.62;
    if (text) {
      body = pcFit2(ctx, text, stack, bw, bh - refBlock, Math.round(72 * pcPref.size), Math.round(30 * pcPref.size), lhR);
      over = body.over;
    }
    const bodyH = body.lines.length * body.fs * lhR;
    const total = bodyH + (text ? refBlock : refBlock - 44);
    let y = by + (bh - total) / 2;
    ctx.font = body.fs + 'px ' + stack;
    body.lines.forEach((ln, i) => { ctx.fillText(ln, PC_PX + PC_PS / 2, y + (i + 0.5) * body.fs * lhR); });
    y += bodyH + (text ? 44 : 0);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 0.75; ctx.fillStyle = ink;
    ctx.fillRect(PC_PX + PC_PS / 2 - 32, y, 64, 3);
    ctx.globalAlpha = 0.95;
    ctx.font = refFs + 'px ' + stack;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    if (light) { ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2; }
    ctx.fillText(pcRef(), PC_PX + PC_PS / 2, y + 3 + 30 + refFs * 0.6);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.restore();

    // 사진 테두리
    ctx.strokeStyle = 'rgba(0,0,0,.10)'; ctx.lineWidth = 2;
    ctx.strokeRect(PC_PX - 1, PC_PY - 1, PC_PS + 2, PC_PS + 2);

    // 아래 문구·날짜
    const cap = pcCaption.trim(), date = pcPref.showDate ? pcFmtDate(pcDateStr) : '';
    if (cap || date) {
      const cst = FONTS.gowunD.stack, top = PC_PY + PC_PS, bandH = PC_H - top;
      const dateFs = 36, dateH = date ? Math.round(dateFs * 1.4) : 0, gap = cap && date ? 14 : 0;
      let cf = { fs: 0, lines: [] };
      if (cap) cf = pcFit2(ctx, cap, cst, PC_W - 220, 140, 58, 34, 1.35, 2);
      const capH = cf.lines.length * cf.fs * 1.35;
      const tot = capH + gap + dateH;
      let cy = top + (bandH - tot) / 2 - 4;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fr.ink;
      ctx.font = cf.fs + 'px ' + cst;
      cf.lines.forEach((ln, i) => ctx.fillText(ln, PC_W / 2, cy + (i + 0.5) * cf.fs * 1.35));
      cy += capH + gap;
      if (date) {
        ctx.globalAlpha = 0.58;
        ctx.font = dateFs + 'px ' + cst;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
        ctx.fillText(date, PC_W / 2, cy + dateH / 2);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        ctx.globalAlpha = 1;
      }
    }
    // 종이 가장자리
    ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, PC_W - 2, PC_H - 2);
    return { over };
  }

  function pcRender() {
    if (pcRaf || !pcIsOpen()) return;
    pcRaf = requestAnimationFrame(() => {
      pcRaf = 0;
      if (!pcIsOpen()) return;
      pcEnsureFonts();
      let r = { over: false };
      try { r = pcDraw(); } catch (err) { showError(err); }
      const w = pcQ('#pc-warn');
      w.hidden = !r.over;
      w.textContent = r.over ? "본문이 길어 카드에 다 들어가지 않아 끝이 줄어듭니다. 절 수를 줄이거나 글자 크기를 '작게'로 바꿔 보세요." : '';
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
    set('--pc-bot', (kbH > 0 ? 0 : Math.max(Math.round(si.bottom), 0)) + 14);   // 키보드가 올라와 있으면 홈 막대 자리는 키보드가 덮는다
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
  function pcRefill() {   // 고른 구절의 본문을 본문 칸에 넣는다 (직접 고친 글은 다른 구절을 고르면 새 본문으로 바뀐다)
    pcKey = pcv.bi + '.' + pcv.c + '.' + pcv.v1 + '.' + pcv.v2;
    pcVerseText = pcGather();
    pcQ('#pc-verse').value = pcVerseText;
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
    pcQ('#pc-hint').textContent = pcPhoto ? '카드 위에서 사진을 끌어 위치를, 두 손가락으로 벌려 크기를 바꿀 수 있습니다.' : '';
    pcQ('#pc-canvas').style.cursor = pcPhoto ? 'grab' : 'default';
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
      pcSavePref();
    } catch (err) {
      showToastLine('사진을 불러오지 못했습니다. 다른 사진으로 다시 시도해 주세요.');
    }
    pcSync(); pcRender();
  }
  function pcClearPhoto() {
    pcPhoto = null; pcZoom = 1; pcPanX = 0; pcPanY = 0;
    pcApplyPreset(pcPref.bg);
    pcSavePref(); pcSync(); pcRender();
  }

  // ----- 카드 위에서 끌기(위치) · 두 손가락 벌리기(크기) · 마우스 휠(크기) -----
  function pcBindGesture(cv) {
    const ptrs = new Map();
    let lastDist = 0, lastMid = null;
    const scale = () => PC_W / Math.max(1, cv.clientWidth);
    const mid = () => { const a = Array.from(ptrs.values()); return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; };
    cv.addEventListener('pointerdown', (e) => {
      if (!pcPhoto) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const m = mid(); lastDist = m.d; lastMid = m; } else { lastDist = 0; lastMid = null; }
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p || !pcPhoto) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
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
    const up = (e) => { ptrs.delete(e.pointerId); lastDist = 0; lastMid = null; if (ptrs.size === 2) { const m = mid(); lastDist = m.d; lastMid = m; } };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      if (!pcPhoto) return;
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
      pcDraw();                                   // 글꼴이 다 준비된 뒤 한 번 더 그려서 내보낸다
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
    }
  }

  function buildPc() {
    const el = document.createElement('div');
    el.id = 'pc'; el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '성경구절 포토카드');
    const seg = (k, items) => '<div class="seg pc-seg" data-k="' + k + '">' +
      items.map((it) => '<button type="button" data-v="' + it[0] + '">' + it[1] + '</button>').join('') + '</div>';
    el.innerHTML =
      '<div class="pc-bar">' +
        '<button type="button" class="link-btn pc-x" id="pc-close">‹ 닫기</button>' +
        '<strong>포토카드</strong>' +
        '<div class="pc-tabs"><button type="button" data-t="l">입력</button><button type="button" data-t="r">카드</button></div>' +
      '</div>' +
      '<div class="pc-l"><div class="pc-form" id="pc-form">' +
        '<div class="pc-sec"><h3>성경 구절</h3>' +
          '<input id="pc-ref" class="pc-in" type="text" placeholder="직접 입력 (예: 요 3:16-18)" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">' +
          '<p class="pc-msg" id="pc-refmsg" hidden></p>' +
          '<div class="pc-sel"><select id="pc-book" aria-label="책"></select><select id="pc-ch" aria-label="장"></select>' +
            '<select id="pc-v1" aria-label="시작 절"></select><span>~</span><select id="pc-v2" aria-label="끝 절"></select></div>' +
          '<textarea id="pc-verse" class="pc-in pc-verse" rows="5" placeholder="구절을 고르면 본문이 들어갑니다. 직접 고쳐 쓸 수도 있습니다."></textarea>' +
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
        '<div class="pc-sec"><h3>꾸미기</h3>' +
          '<div class="pc-lbl">글씨체</div>' + seg('font', PC_FONT_KEYS.map((k) => [k, FONTS[k].label])) +
          '<div class="pc-lbl">글자색</div>' + seg('ink', [['light', '흰색'], ['dark', '진한 색']]) +
          '<div class="pc-lbl">글자 크기</div>' + seg('size', PC_SIZES) +
          '<div class="pc-lbl">카드 틀</div>' + seg('frame', Object.keys(PC_FRAMES).map((k) => [k, PC_FRAMES[k].label])) +
        '</div>' +
      '</div></div>' +
      '<div class="pc-r">' +
        '<div class="pc-stage"><canvas id="pc-canvas" width="' + PC_W + '" height="' + PC_H + '" aria-label="포토카드 미리보기"></canvas></div>' +
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
    pcQ('#pc-verse').addEventListener('input', (e) => { pcVerseText = e.target.value; pcRender(); });
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
    // 꾸미기(글씨체·글자색·크기·틀)
    pcEl.querySelectorAll('.pc-seg').forEach((sg) => sg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const k = sg.dataset.k;
      pcPref[k] = (k === 'size') ? parseFloat(b.dataset.v) : b.dataset.v;
      pcSavePref(); pcSync(); pcRender();
    }));
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
    pcEl.hidden = false;
    pcEl.dataset.tab = 'l';
    pcEl.querySelectorAll('.pc-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === 'l'));
    if (pcKey !== pcv.bi + '.' + pcv.c + '.' + pcv.v1 + '.' + pcv.v2) pcRefill(); else pcQ('#pc-verse').value = pcVerseText;
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

  onMenu($('#btn-pick'), () => { showBooks(pos.book >= 39 ? 'nt' : 'ot'); openSheet(false); });
  onMenu($('#btn-easy'), () => { showTranslations(); openSheet(false); });
  onMenu($('#btn-settings'), () => { showSettings(); openSheet(false); });
  onMenu($('#btn-hl'), () => { showHighlights(); openSheet(false); });
  onMenu($('#btn-notes'), () => { showNotes(); openSheet(true); });
  onMenu($('#btn-card'), () => { openPc(); });
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
