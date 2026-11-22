// 모임 장소 지도 — 벡터 방식(B)의 테마별 지도 스타일.
// OpenFreeMap(키 없는 공개 서버)이 주는 OpenMapTiles 규격의 벡터 타일을 MapLibre가 그린다.
// 색은 앱 테마(종이·세피아·야간)에 맞춰 여기서 정한다. 래스터 방식(A)처럼 CSS 필터로 색조를 입히는 것이 아니라, 도로·물·공원·건물·글자 색을 직접 지정한다.
// 이 파일은 '벡터 방식'을 골랐을 때만 app.js가 불러온다. (maplibre-gl.js, leaflet-maplibre-gl.js 다음에)
//
// 주의: MapLibre 줌 = Leaflet 줌 − 1 (leaflet-maplibre-gl 플러그인이 그렇게 맞춘다). 아래 minzoom·폭 값은 MapLibre 줌 기준이다.
(function () {
  'use strict';

  const TILEJSON = 'https://tiles.openfreemap.org/planet';
  const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
  const SRC = 'openmaptiles';

  // 테마별 색. (종이 = 따뜻한 베이지·옅은 도로 / 세피아 = 갈색 톤 / 야간 = 어두운 회청색)
  const PAL = {
    paper: {
      land: '#F2EFE2', resid: '#EFEBDB', water: '#C4D6D8', wood: '#D5DDBE', grass: '#E1E6CC', park: '#D9E1C0', sand: '#EDE5C8', ice: '#F6F6F0',
      indus: '#E8E3D2', school: '#EBE4CC', hospital: '#EEDFD6', cemetery: '#DDE0C8', building: '#E6DFCA', buildingLine: '#D3CAB0',
      minor: '#FBF8EE', minorCase: '#DDD4BC', mid: '#FFFDF4', midCase: '#D2C8AC', main: '#FFF3D3', mainCase: '#CDBD94', motor: '#F6DDA4', motorCase: '#C4AF7C',
      path: '#B8AD94', rail: '#A89E88', boundary: '#B4A78C',
      text: '#4A4036', textMuted: '#7A6E5E', halo: '#F2EFE2', waterText: '#5F7F85',
      subway: '#2F6BB3', subwayFg: '#FFFFFF', subwayText: '#2A5A94',
    },
    sepia: {
      land: '#E8D8BA', resid: '#E4D3B3', water: '#BAC3B2', wood: '#CBC596', grass: '#D5CDA2', park: '#CFC99C', sand: '#E3D2A8', ice: '#EFE6D0',
      indus: '#DDCCA9', school: '#E0CFA9', hospital: '#E4CDB4', cemetery: '#CFC9A0', building: '#D9C5A0', buildingLine: '#C4AC80',
      minor: '#F2E6CC', minorCase: '#CDB88C', mid: '#F8EDD3', midCase: '#C3AB7C', main: '#F9E7BC', mainCase: '#B99F6A', motor: '#F0D393', motorCase: '#AE9055',
      path: '#A68E66', rail: '#9C8660', boundary: '#A58D63',
      text: '#4B3621', textMuted: '#79603F', halo: '#E8D8BA', waterText: '#5D6F5F',
      subway: '#3F6B8E', subwayFg: '#FBF3E0', subwayText: '#2F5775',
    },
    night: {
      land: '#1A1B1F', resid: '#1D1E23', water: '#0F1722', wood: '#1B2622', grass: '#1D2822', park: '#1F2B26', sand: '#25241F', ice: '#2A2D33',
      indus: '#212227', school: '#23232A', hospital: '#2A2224', cemetery: '#1E2622', building: '#25272D', buildingLine: '#2F323A',
      minor: '#32353D', minorCase: '#141519', mid: '#3C404A', midCase: '#141519', main: '#474B57', mainCase: '#141519', motor: '#5A5346', motorCase: '#141519',
      path: '#4A4E58', rail: '#4A4E58', boundary: '#4D515D',
      text: '#C3C6CF', textMuted: '#8E93A0', halo: '#1A1B1F', waterText: '#6C8CA8',
      subway: '#4F8FD6', subwayFg: '#0F1722', subwayText: '#8FB9EA',
    },
  };

  const Z = (...stops) => ['interpolate', ['linear'], ['zoom']].concat(stops);
  const ZE = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom']].concat(stops);
  const NAME = ['coalesce', ['get', 'name:ko'], ['get', 'name']];
  const LINE = ['==', ['geometry-type'], 'LineString'];
  const cls = (...c) => ['in', ['get', 'class'], ['literal', c]];
  const tunnel = ['==', ['get', 'brunnel'], 'tunnel'];
  const FONT = ['Noto Sans Regular'], FONT_B = ['Noto Sans Bold'], FONT_I = ['Noto Sans Italic'];

  function build(theme) {
    const p = PAL[theme] || PAL.paper;
    const L = [];
    const add = (l) => { l.source = SRC; L.push(l); };

    L.push({ id: 'bg', type: 'background', paint: { 'background-color': p.land } });

    // ----- 땅·물 -----
    add({
      id: 'landcover', type: 'fill', 'source-layer': 'landcover',
      paint: {
        'fill-color': ['match', ['get', 'class'], ['wood', 'forest'], p.wood, ['grass', 'farmland', 'scrub', 'wetland'], p.grass, 'sand', p.sand, ['ice', 'glacier'], p.ice, p.grass],
        'fill-opacity': Z(5, 0.5, 11, 0.9),
      },
    });
    add({
      id: 'landuse', type: 'fill', 'source-layer': 'landuse', minzoom: 8,
      paint: {
        'fill-color': ['match', ['get', 'class'],
          'residential', p.resid, ['industrial', 'railway', 'garages', 'quarry'], p.indus, ['school', 'university', 'college', 'kindergarten'], p.school,
          'hospital', p.hospital, 'cemetery', p.cemetery, ['playground', 'pitch', 'stadium', 'track', 'dog_park', 'zoo'], p.park, ['commercial', 'retail'], p.indus, p.land],
        'fill-opacity': Z(8, 0.5, 13, 1),
      },
    });
    add({ id: 'park', type: 'fill', 'source-layer': 'park', paint: { 'fill-color': p.park, 'fill-opacity': 0.9 } });
    add({ id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': p.water } });
    add({
      id: 'waterway', type: 'line', 'source-layer': 'waterway', minzoom: 8, filter: LINE,
      paint: { 'line-color': p.water, 'line-width': ZE(8, 0.4, 14, 1.6, 18, 6) },
    });
    add({ id: 'aeroway', type: 'fill', 'source-layer': 'aeroway', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': p.indus } });

    // ----- 건물 -----
    add({
      id: 'building', type: 'fill', 'source-layer': 'building', minzoom: 13,
      paint: { 'fill-color': p.building, 'fill-outline-color': p.buildingLine, 'fill-opacity': Z(13, 0, 15, 1) },
    });

    // ----- 길 (아래에서 위로: 철길·샛길 → 작은 길 → 중간 길 → 큰 길 → 고속도로) -----
    const road = (id, filter, fill, casing, wFill, wCase, minzoom) => {
      add({
        id: id + '-case', type: 'line', 'source-layer': 'transportation', minzoom, filter: ['all', LINE, filter],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': casing, 'line-width': wCase, 'line-opacity': ['case', tunnel, 0.45, 1] },
      });
      add({
        id, type: 'line', 'source-layer': 'transportation', minzoom, filter: ['all', LINE, filter],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': fill, 'line-width': wFill, 'line-opacity': ['case', tunnel, 0.5, 1] },
      });
    };
    // 철도·지하철 노선선(회색 점선)은 v63부터 그리지 않는다 — 지하철은 역 아이콘(맨 아래 'subway-station' 층)만 보인다.
    add({
      id: 'path', type: 'line', 'source-layer': 'transportation', minzoom: 14, filter: ['all', LINE, cls('path', 'pier')],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': p.path, 'line-width': Z(14, 0.6, 18, 2), 'line-dasharray': [2, 2] },
    });
    road('road-minor', cls('minor', 'service', 'track'), p.minor, p.minorCase,
      ZE(12, 0.4, 14, 1.4, 16, 4, 18, 12), ZE(12, 0.9, 14, 2.4, 16, 5.6, 18, 14), 12);
    road('road-mid', cls('secondary', 'tertiary'), p.mid, p.midCase,
      ZE(10, 0.4, 12, 1.2, 14, 3, 16, 7, 18, 16), ZE(10, 1, 12, 2.2, 14, 4.4, 16, 8.6, 18, 18), 10);
    road('road-main', cls('primary', 'trunk'), p.main, p.mainCase,
      ZE(7, 0.4, 10, 1.4, 12, 2.6, 14, 4.4, 16, 9, 18, 20), ZE(7, 1, 10, 2.4, 12, 3.8, 14, 6, 16, 10.6, 18, 22), 7);
    road('road-motor', cls('motorway'), p.motor, p.motorCase,
      ZE(5, 0.4, 10, 1.8, 12, 3, 14, 5, 16, 10, 18, 22), ZE(5, 1, 10, 2.8, 12, 4.2, 14, 6.6, 16, 11.6, 18, 24), 5);

    // ----- 경계 -----
    add({
      id: 'boundary', type: 'line', 'source-layer': 'boundary', filter: ['all', ['<=', ['coalesce', ['get', 'admin_level'], 99], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': p.boundary, 'line-width': Z(2, 0.6, 10, 1.3), 'line-dasharray': [3, 2] },
    });

    // ----- 글자 -----
    const halo = { 'text-halo-color': p.halo, 'text-halo-width': 1.6 };
    add({
      id: 'water-name', type: 'symbol', 'source-layer': 'water_name', minzoom: 8,
      layout: { 'text-field': NAME, 'text-font': FONT_I, 'text-size': 12, 'text-max-width': 6 },
      paint: Object.assign({ 'text-color': p.waterText }, halo),
    });
    add({
      id: 'road-name', type: 'symbol', 'source-layer': 'transportation_name', minzoom: 13,
      layout: {
        'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT, 'text-size': Z(13, 10, 17, 12.5), 'symbol-spacing': 280,
        'text-rotation-alignment': 'map', 'text-pitch-alignment': 'viewport',
      },
      paint: Object.assign({ 'text-color': p.textMuted }, halo),
    });
    add({
      id: 'housenumber', type: 'symbol', 'source-layer': 'housenumber', minzoom: 17,
      layout: { 'text-field': ['get', 'housenumber'], 'text-font': FONT, 'text-size': 10 },
      paint: Object.assign({ 'text-color': p.textMuted }, halo),
    });
    // 가게·시설(POI) 점과 이름은 일부러 그리지 않는다(v58). 모임 장소 지도에는 내 장소와 카페 층만 점으로 보이게 하려는 것이다.
    // 다만 지하철·전철역(poi 층의 class=railway · subclass=station)은 v60부터 아이콘 + 이름으로 따로 그린다(맨 아래 'subway-station' 층). 출구·버스 정류장은 그리지 않는다.
    const place = (id, classes, minzoom, maxzoom, size, font, extra) => add({
      id, type: 'symbol', 'source-layer': 'place', minzoom, maxzoom, filter: cls.apply(null, classes),
      layout: Object.assign({ 'text-field': NAME, 'text-font': font || FONT, 'text-size': size, 'text-max-width': 8 }, extra || {}),
      paint: Object.assign({ 'text-color': p.text }, halo),
    });
    place('place-sub', ['suburb', 'quarter', 'neighbourhood', 'hamlet', 'isolated_dwelling'], 12, 17, Z(12, 11, 16, 13), FONT, { 'text-transform': 'none' });
    place('place-village', ['village'], 10, 17, Z(10, 11, 15, 14), FONT);
    place('place-town', ['town'], 8, 16, Z(8, 12, 14, 16), FONT);
    place('place-island', ['island'], 8, 16, 12, FONT_I);
    place('place-city', ['city'], 5, 15, Z(5, 13, 12, 19), FONT_B);
    place('place-state', ['state', 'province', 'region'], 3, 8, Z(3, 11, 7, 14), FONT);
    place('place-country', ['country'], 1, 6, Z(1, 12, 5, 18), FONT_B);
    // 지하철역: 맨 위 층이라 도로·동네 이름과 겹치면 역이 이긴다. 같은 역이 점·면 두 번 들어 있어도 먼저 놓인 하나만 남는다.
    add({
      id: 'subway-station', type: 'symbol', 'source-layer': 'poi', minzoom: 12,
      // v63: 모든 노선의 역이 나오도록 조금 넓게 고른다 — railway 계열의 역·간이역·지하철·경전철·모노레일(출구·전차 정류장·버스는 제외), 이름이 있는 것만.
      filter: ['all',
        ['any', ['==', ['get', 'class'], 'railway'], ['==', ['get', 'subclass'], 'subway']],
        ['in', ['get', 'subclass'], ['literal', ['station', 'halt', 'subway', 'light_rail', 'monorail']]],
        ['any', ['has', 'name'], ['has', 'name:ko'], ['has', 'name_en']]],
      layout: {
        'icon-image': 'bf-subway-' + theme, 'icon-size': Z(12, 0.7, 16, 1), 'icon-padding': 2, 'icon-allow-overlap': true,   // v63: 붙어 있는 역도 아이콘은 하나도 빠지지 않게(이름은 자리가 있을 때만)
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        'text-field': NAME, 'text-font': FONT_B, 'text-size': Z(12, 10, 17, 13), 'text-anchor': 'left', 'text-offset': [1.15, 0], 'text-max-width': 8, 'text-optional': true,
      },
      paint: { 'text-color': p.subwayText, 'text-halo-color': p.halo, 'text-halo-width': 1.6 },
    });

    return {
      version: 8, name: 'bf-' + theme,
      sources: { [SRC]: { type: 'vector', url: TILEJSON } },
      glyphs: GLYPHS,
      transition: { duration: 0, delay: 0 },
      layers: L,
    };
  }

  // 지하철 아이콘: 그림 파일 없이 캔버스로 그려 MapLibre에 넣는다(app.js 가 'styleimagemissing' 때 부른다). id = 'bf-subway-<테마>'.
  // 24×24 칸에 둥근 배지 + 전철 앞모습(몸통·앞유리·불빛·다리). 해상도 2배(48×48)로 그려 pixelRatio 2 로 쓴다.
  function icon(id) {
    const m = /^bf-subway-(paper|sepia|night)$/.exec(String(id || '')); if (!m) return null;
    const p = PAL[m[1]], R = 2, S = 24;
    const c = document.createElement('canvas'); c.width = c.height = S * R;
    const g = c.getContext('2d'); if (!g) return null;
    g.scale(R, R);
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = p.halo; g.beginPath(); g.arc(12, 12, 11.5, 0, Math.PI * 2); g.fill();          // 바깥 테두리(배경색) — 지도 위에서 또렷하게
    g.fillStyle = p.subway; g.beginPath(); g.arc(12, 12, 10, 0, Math.PI * 2); g.fill();          // 배지
    g.fillStyle = p.subwayFg; rr(7.5, 5.2, 9, 11.3, 2.6); g.fill();                              // 몸통
    g.fillStyle = p.subway; rr(9.1, 7, 5.8, 4.2, 1); g.fill();                                   // 앞유리
    g.beginPath(); g.arc(9.9, 13.9, 0.95, 0, Math.PI * 2); g.arc(14.1, 13.9, 0.95, 0, Math.PI * 2); g.fill();   // 불빛
    g.strokeStyle = p.subwayFg; g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(9.2, 16.6); g.lineTo(7.8, 18.9); g.moveTo(14.8, 16.6); g.lineTo(16.2, 18.9); g.stroke();   // 다리
    return { data: g.getImageData(0, 0, S * R, S * R), ratio: R };
  }

  window.bfMapStyle = { build, PAL, TILEJSON, GLYPHS, icon };
})();
