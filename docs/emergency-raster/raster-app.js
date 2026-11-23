// 비상용 래스터(A) 지도 — 책장성경 v67 의 코드를 그대로 떼어 둔 것입니다. (앱 v68 부터 앱에는 들어 있지 않습니다)
// 이 파일은 앱에 들어가지 않습니다(www/ 밖). 되살리는 순서는 같은 폴더의 README.md 를 따르세요.
// 아래 조각은 모두 v67(커밋 f1cb403)의 www/app.js 에서 글자 그대로 가져온 것이므로, v67 에서 검증된 동작입니다.
// 조각마다 '붙일 곳'이 적혀 있습니다. 줄 번호는 v67 기준이라 v68 이후에는 어긋나므로 함수·상수 이름으로 찾으세요.


// ============================================================
// [1] 지도 상수·열쇠·방식 선택 — 붙일 곳: app.js 의 '모임 장소(카페) 지도' 구역에서 MP_VEC_ATTR 가 있는 자리.
//     (v68 의 MP_NOTE_VEC, mpWantVec 정의는 이 조각의 MP_NOTE, mpWantVec 로 바꿉니다. MP_VEC_ATTR·MP_VEC_WAIT·MP_VEC_WHY 는 v68 에도 있으므로 겹치면 한 벌만 남깁니다)
// ============================================================
  const MP_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';   // 열쇠가 없을 때의 바탕(OpenStreetMap). CSS 색조로만 테마에 맞춘다.
  const MP_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  // 열쇠(CARTO 무료 API 키)가 있으면 테마에 맞는 CARTO 바탕을 쓴다: 종이·세피아 = Positron(밝고 옅은 도로) + 색조, 야간 = Dark Matter.
  // 열쇠는 이 기기(bf.mapkey)에만 저장하고 데이터 백업에는 넣지 않는다. 입력은 설정 → 고급설정에서 한다.
  const MP_CARTO = 'https://basemaps.cartocdn.com/rastertiles/';
  const MP_CARTO_STYLE = { paper: 'light_all', sepia: 'light_all', night: 'dark_all' };
  const MP_CARTO_ATTR = MP_ATTR + ', © <a href="https://carto.com/attribution/">CARTO</a>';
  const MP_KEY_LS = 'bf.mapkey', MP_KEY_URL = 'https://carto.com/basemaps/apikey/';
  const mpKeyOk = (k) => /^\S{6,200}$/.test(k);
  const mpKeyGet = () => { try { const k = (localStorage.getItem(MP_KEY_LS) || '').trim(); return mpKeyOk(k) ? k : ''; } catch (e) { return ''; } };
  // 지금 테마·열쇠에 맞는 바탕 설정. nz = 그 서비스가 실제로 주는 가장 큰 확대 단계(그 이상은 늘려서 보여 준다)
  function mpTileCfg() {
    const key = mpKeyGet();
    return key
      ? { src: 'carto', url: MP_CARTO + (MP_CARTO_STYLE[settings.theme] || 'light_all') + '/{z}/{x}/{y}.png?key=' + encodeURIComponent(key), attr: MP_CARTO_ATTR, nz: 18 }
      : { src: 'osm', url: MP_TILE, attr: MP_ATTR, nz: 19 };
  }
  const MP_NOTE = {
    osm: '지도 바탕을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. 목록과 핀 위치는 그대로 쓸 수 있습니다.',
    carto: '지도 바탕을 불러오지 못했습니다. 인터넷 연결과, 설정 → 고급설정에 입력한 지도 열쇠를 확인해 주세요. 목록과 핀 위치는 그대로 쓸 수 있습니다.',
    vec: '지도 자료를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요. 목록과 핀 위치는 그대로 쓸 수 있습니다.',
  };
  // 지도 방식: 'vector'(B, 기본 — 도로·건물·글자를 MapLibre가 직접 그림. 키 없는 OpenFreeMap 자료) / 'raster'(A, 비상용 — 그림 조각 타일).
  // v52부터 기본은 B. B가 안 되면(이 기기에서 WebGL이 안 됨·부품/자료를 못 받음·제때 안 그려짐) 그 실행 동안은 자동으로 A로 돌아간다. 선택값(bf.mapeng)은 이 기기에만 저장하고 데이터 백업에는 넣지 않는다. 저장값이 없으면 B.
  const MP_ENG_LS = 'bf.mapeng';
  const mpEngGet = () => { try { return localStorage.getItem(MP_ENG_LS) === 'raster' ? 'raster' : 'vector'; } catch (e) { return 'vector'; } };
  const MP_VEC_ATTR = '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  const MP_VEC_WAIT = 15000;   // 이 시간 안에 첫 그림이 안 나오면 실패로 본다(ms)
  const MP_VEC_WHY = {
    gl: '이 기기의 웹뷰에서 벡터 지도(WebGL)를 쓸 수 없어',
    lib: '벡터 지도 부품을 불러오지 못해',
    net: '벡터 지도 자료를 받지 못해',
    time: '벡터 지도가 제때 그려지지 않아',
  };
  let mpVecFail = '', mpVecInfo = '';   // 벡터가 안 된 이유(MP_VEC_WHY의 키)와 진단 한 줄. 값이 있으면 이번 실행에서는 A로 보여 준다. 설정에서 방식을 다시 고르면 비운다.
  const mpWantVec = () => mpEngGet() === 'vector' && !mpVecFail;


// ============================================================
// [2] mpApplyTile — 붙일 곳: v68 의 mpApplyTile 함수 전체를 이 함수로 바꿉니다. (바탕을 래스터로 그리고, 벡터가 안 되면 래스터로 돌아가는 v67 동작)
// ============================================================
  // 지금 테마·열쇠에 맞는 바탕으로 맞춘다. #mp의 mp-src-carto / mp-src-osm 클래스는 CSS가 바탕 그림의 색조(필터)를 고르는 데 쓴다.
  // 바탕 주소가 그대로면 지도를 건드리지 않는다. 바뀌면(테마 변경·열쇠 입력·삭제) 바탕 층만 새로 만든다.
  function mpApplyTile() {
    if (!mpEl) return;
    const vec = mpWantVec();
    const c = mpTileCfg();
    mpEl.classList.toggle('mp-src-vec', vec);
    mpEl.classList.toggle('mp-src-carto', !vec && c.src === 'carto');
    mpEl.classList.toggle('mp-src-osm', !vec && c.src === 'osm');
    if (!mpMap || !window.L) return;
    const sig = vec ? 'vec|' + settings.theme : c.url;
    if ((mpTile || mpVec) && mpTileSig === sig) return;
    if (vec && !mpVecReady()) {   // 벡터 부품은 처음 쓸 때 받는다. 받는 동안은 지금 보이는 바탕을 그대로 둔다.
      mpLoadVector().then(() => { if (mpWantVec()) mpApplyTile(); }, (e) => (e && e.message === 'webgl' ? mpVecFailed('gl', '이 웹뷰에서 WebGL2를 쓸 수 없음') : mpVecFailed('lib', '받지 못한 파일: ' + String(e && e.message || '').replace(/^.*\//, ''))));
      return;
    }
    if (mpTile) { mpMap.removeLayer(mpTile); mpTile = null; }
    if (mpVec) { const old = mpVec; mpVec = null; try { mpMap.removeLayer(old); } catch (e) { /* 무시 */ } }
    mpTileSig = sig; mpTileErr = 0;
    const note = mpS('#mp-note');
    if (Date.now() >= mpNoteHold) { note.textContent = MP_NOTE[vec ? 'vec' : c.src]; note.hidden = true; }
    if (vec) { mpAddVector(); return; }
    mpTile = L.tileLayer(c.url, { maxZoom: 19, maxNativeZoom: c.nz, attribution: c.attr });
    mpTile.on('tileerror', () => { if (++mpTileErr >= 2 && Date.now() >= mpNoteHold) mpS('#mp-note').hidden = false; });
    mpTile.on('tileload', () => { mpTileErr = 0; if (Date.now() >= mpNoteHold) mpS('#mp-note').hidden = true; });
    mpTile.addTo(mpMap);
  }


// ============================================================
// [3] mpVecFailed — 붙일 곳: v68 의 mpVecFailed 함수 전체를 이 함수로 바꿉니다. (안내문을 9초만 띄우고 래스터로 돌아가는 v67 동작)
// ============================================================
  // 벡터를 못 쓰는 이유를 기억하고 A(래스터)로 돌아간다. 안내 글은 몇 초 동안 띄운다.
  function mpVecFailed(why, info) {
    if (mpVecFail) return;   // 처음 실패한 이유만 기억한다
    mpVecFail = why; mpVecInfo = info || '';
    mpNoteHold = 0;
    mpApplyTile();
    if (!mpEl) return;
    const n = mpS('#mp-note');
    n.textContent = (MP_VEC_WHY[why] || MP_VEC_WHY.time) + ' 기본(래스터) 지도로 보여 드립니다. 설정 → 고급설정에서 방식을 다시 고를 수 있습니다.';
    n.hidden = false;
    mpNoteHold = Date.now() + 9000;
    setTimeout(() => { if (mpEl && Date.now() >= mpNoteHold) mpS('#mp-note').hidden = true; }, 9100);
  }


// ============================================================
// [4] 고급설정 화면의 '모임 장소 지도 그림'·'래스터(A) 지도 열쇠' 구역(HTML) — 붙일 곳: showAdvanced() 의 sheetBody.innerHTML 에서
//     '여기부터 다시 맞추기·앱 다시 시작' 구역(adv-head '화면이 위로 올라가거나…') 바로 앞. 이 조각은 문자열을 '+' 로 이어 붙이는 한 덩어리입니다.
//     (adv-desc 설명은 v68 에서는 ⓘ 단추로 접히므로, 되살릴 때 help('mapeng', …) / help('mapkey', …) 형태로 바꾸면 화면이 다른 항목과 같아집니다)
// ============================================================
      '<div class="adv-head">모임 장소 지도 그림</div>' +
      '<p class="adv-desc">지도를 그리는 방식을 고릅니다. <b>벡터(B)</b>는 도로·건물·글자를 앱이 직접 그려 테마 색이 정확하고 열쇠가 필요 없는 <b>기본 방식</b>입니다. <b>래스터(A)</b>는 그림 조각을 받아 보여 주는 비상용 방식입니다. ' +
        '벡터가 이 기기에서 안 되면 자동으로 래스터로 돌아옵니다. 선택은 <b>이 기기에만</b> 저장되며 데이터 백업에는 들어가지 않습니다.</p>' +
      '<div class="mk-btns"><button class="seg-btn" id="me-vector" type="button">벡터 (B) · 기본</button><button class="seg-btn" id="me-raster" type="button">래스터 (A) · 비상용</button></div>' +
      '<p class="note tight" id="me-state"></p>' +
      '<div class="adv-head">래스터(A) 지도 열쇠 (비상용)</div>' +
      '<p class="adv-desc">비상용 래스터 방식에서 테마(종이·세피아·야간)에 맞춘 CARTO 지도를 쓰려면 무료 열쇠(API 키)가 필요합니다. 아래 단추로 받는 곳을 열어 이메일로 받은 열쇠를 붙여 넣어 주세요. ' +
        '열쇠는 <b>이 기기에만</b> 저장되며 데이터 백업에는 들어가지 않습니다. 열쇠가 없으면 OpenStreetMap 지도에 테마 색조만 입혀 보여 줍니다. (벡터 방식에서는 쓰이지 않습니다)</p>' +
      '<p class="note tight" id="mk-state"></p>' +
      '<input id="mk-in" class="bk-text mk-in" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="여기에 열쇠 붙여 넣기" aria-label="지도 열쇠">' +
      '<div class="mk-btns"><button class="seg-btn" id="mk-open" type="button">받는 곳 열기</button><button class="seg-btn" id="mk-save" type="button">저장</button><button class="seg-btn" id="mk-clear" type="button">지우기</button></div>' +
      '<p class="adv-desc" id="mk-msg">&nbsp;</p>' +

// ============================================================
// [5] 위 화면의 동작(지도 방식 버튼·열쇠 저장/지우기) — 붙일 곳: showAdvanced() 안, ⓘ 토글 처리 바로 뒤
// ============================================================
    // 지도 방식(A 래스터 / B 벡터): 고르면 바로 저장하고, 지도가 열려 있든 아니든 바탕을 다시 맞춘다. 다시 고르면 '벡터 실패' 기록도 지워 한 번 더 시도한다.
    const meState = () => {
      const vec = mpEngGet() === 'vector';
      $('#me-raster').classList.toggle('on', !vec); $('#me-vector').classList.toggle('on', vec);
      $('#me-raster').setAttribute('aria-pressed', String(!vec)); $('#me-vector').setAttribute('aria-pressed', String(vec));
      $('#me-state').innerHTML = !vec
        ? '<b>래스터(A) 사용 중</b> · 비상용 방식입니다. 아래 열쇠가 있으면 테마별 CARTO 지도, 없으면 OpenStreetMap에 색조를 입혀 보입니다. 기본 방식으로 돌아가려면 위 \'벡터 (B)\'를 누르세요.'
        : (mpVecFail
          ? '<b>벡터(B) 선택됨</b> · ' + MP_VEC_WHY[mpVecFail] + ' 이번에는 래스터로 보입니다. 다시 눌러 한 번 더 시도할 수 있습니다.' + (mpVecInfo ? '<br><small>진단: ' + esc(mpVecInfo) + '</small>' : '')
          : '<b>벡터(B) 사용 중</b> · 기본 방식입니다. 키 없는 공개 지도 서버(OpenFreeMap)에서 자료를 받아 테마 색으로 그립니다. (인터넷 연결 필요)');
    };
    const meSet = (v) => {
      try { localStorage.setItem(MP_ENG_LS, v); } catch (e) { $('#me-state').textContent = '저장하지 못했습니다.'; return; }
      mpVecFail = ''; mpVecInfo = '';
      mpApplyTile(); meState();
    };
    meState();
    $('#me-raster').addEventListener('click', () => meSet('raster'));
    $('#me-vector').addEventListener('click', () => meSet('vector'));
    // 지도 열쇠: 입력·저장·지우기. 저장한 열쇠는 화면에 다시 보여 주지 않는다. 바뀌면 지도가 열려 있든 아니든 바탕을 다시 맞춘다.
    const mkMsg = (t) => { $('#mk-msg').textContent = t; };
    const mkState = () => {
      const has = !!mpKeyGet();
      $('#mk-state').innerHTML = has
        ? '<b>열쇠 입력됨</b> · 지도 그림이 테마에 맞는 CARTO 지도로 보입니다. (인터넷 연결 필요)'
        : '<b>열쇠 없음</b> · 지금은 OpenStreetMap 지도에 테마 색조만 입혀 보입니다.';
      $('#mk-clear').disabled = !has;
    };
    mkState();
    $('#mk-open').addEventListener('click', () => mpOpen(MP_KEY_URL, MP_KEY_URL));
    $('#mk-save').addEventListener('click', () => {
      const v = $('#mk-in').value.trim();
      if (!mpKeyOk(v)) { mkMsg('열쇠를 붙여 넣어 주세요. (공백 없이 6자 이상)'); return; }
      try { localStorage.setItem(MP_KEY_LS, v); } catch (e) { mkMsg('저장하지 못했습니다.'); return; }
      $('#mk-in').value = '';
      mpApplyTile(); mkState();
      mkMsg('저장했습니다. 지도 화면을 열어 확인하세요.');
    });
    $('#mk-clear').addEventListener('click', () => {
      try { localStorage.removeItem(MP_KEY_LS); } catch (e) { /* 무시 */ }
      $('#mk-in').value = '';
      mpApplyTile(); mkState();
      mkMsg('지웠습니다.');
    });


// ============================================================
// [6] openMp() — v67 은 지도를 열 때마다 아래 한 줄만 있었습니다. v68 은 그 앞에 '이전 벡터 실패 기록 지우기' 줄이 있습니다. 둘 다 두어도 됩니다.
// ============================================================
    mpApplyTile();   // 설정에서 열쇠를 넣거나 지웠을 수 있으니, 열 때마다 바탕을 다시 맞춘다
