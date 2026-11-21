// 시험용 가짜 벡터 타일: OpenMapTiles 규격(층 이름·class·name)을 흉내 낸 작은 동네 하나를 만든다.
// 실제 OpenFreeMap 자료가 아니다. '스타일이 층·class를 올바르게 읽어 색·글자를 그리는지'만 확인하는 용도다. (실제 모습은 실기기에서 확인)
import geojsonvt from 'geojson-vt'; import vtpbf from 'vt-pbf';

// 기준점: 가나 카페(강동구 천호동 근처) — tests/map4.mjs의 PLACE와 같은 좌표
const C = { lat: 37.5301, lng: 127.1238 };
const dLat = (m) => m / 111320, dLng = (m) => m / (111320 * Math.cos(C.lat * Math.PI / 180));
const pt = (x, y) => [C.lng + dLng(x), C.lat + dLat(y)];      // 기준점에서 동쪽 x m, 북쪽 y m
const line = (props, ...xy) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: xy.map(([x, y]) => pt(x, y)) } });
const poly = (props, ...xy) => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [[...xy, xy[0]].map(([x, y]) => pt(x, y))] } });
const point = (props, x, y) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: pt(x, y) } });
const fc = (features) => ({ type: 'FeatureCollection', features });
const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

const LAYERS = {
  landcover: fc([
    poly({ class: 'grass' }, ...box(-1200, -1200, 2400, 2400)),
    poly({ class: 'wood' }, ...box(-420, 120, 300, 260)),
  ]),
  landuse: fc([
    poly({ class: 'residential' }, ...box(-700, -700, 1400, 700)),
    poly({ class: 'school' }, ...box(160, 160, 220, 180)),
  ]),
  park: fc([poly({ class: 'park', name: '천호공원' }, ...box(-380, -330, 330, 280))]),
  water: fc([poly({ class: 'river' }, [-1200, -900], [1200, -900], [1200, -640], [-1200, -700])]),
  waterway: fc([line({ class: 'stream' }, [-600, -300], [-300, -520], [-100, -690])]),
  building: fc((() => {
    const b = []; let i = 0;
    for (let x = 60; x < 520; x += 70) for (let y = 40; y < 140; y += 60) b.push(poly({ render_height: 10 + (i++ % 4) * 5 }, ...box(x, y, 46, 38)));
    for (let x = -300; x < -40; x += 60) b.push(poly({ render_height: 9 }, ...box(x, -450, 40, 32)));
    return b;
  })()),
  transportation: fc([
    line({ class: 'motorway' }, [-1200, 420], [-300, 380], [400, 480], [1200, 430]),
    line({ class: 'primary' }, [-1200, 0], [1200, 0]),
    line({ class: 'secondary' }, [0, -900], [0, 900]),
    line({ class: 'tertiary' }, [-1200, 220], [1200, 260]),
    line({ class: 'minor' }, [-500, -250], [-500, 700]),
    line({ class: 'minor' }, [300, -250], [300, 700]),
    line({ class: 'minor' }, [-900, -180], [900, -180]),
    line({ class: 'service' }, [60, 0], [60, 140], [520, 140]),
    line({ class: 'path' }, [-380, -330], [-60, -60], [0, 0]),
    line({ class: 'rail' }, [-1200, 640], [1200, 600]),
    line({ class: 'primary', brunnel: 'tunnel' }, [-900, 0], [-1200, 0]),
  ]),
  transportation_name: fc([
    line({ class: 'primary', name: '천호대로' }, [-900, 0], [900, 0]),
    line({ class: 'secondary', name: '성내로' }, [0, -800], [0, 800]),
    line({ class: 'minor', name: '구천면로' }, [-900, -180], [900, -180]),
    line({ class: 'tertiary', name: '양재대로' }, [-1100, 220], [1100, 260]),
  ]),
  boundary: fc([line({ admin_level: 4, maritime: 0 }, [-1200, 800], [1200, 760])]),
  place: fc([
    point({ class: 'city', name: '서울' }, 0, 700),
    point({ class: 'suburb', name: '천호동' }, -200, 160),
    point({ class: 'neighbourhood', name: '성내동' }, 400, -330),
    point({ class: 'village', name: '둔촌마을 Dunchon' }, 640, 360),   // 영문이 섞인 이름: 글자 파일(glyph)을 요청하게 한다(한글만 있으면 기기 글꼴로 바로 그려 요청이 없다)
  ]),
  water_name: fc([point({ class: 'river', name: '한강' }, 200, -790)]),
  poi: fc([
    point({ class: 'cafe', name: '가나 카페', rank: 1 }, 0, 0),
    point({ class: 'restaurant', name: '다라 식당', rank: 3 }, 120, 60),
    point({ class: 'railway', subclass: 'station', name: '천호', rank: 2 }, -140, 20),                    // 지하철역: v60부터 아이콘+이름으로 그린다
    point({ class: 'railway', subclass: 'station', name: '둔촌동', rank: 6 }, 520, 300),                  // 두 번째 역(멀리)
    point({ class: 'entrance', subclass: 'subway_entrance', name: '천호역 5번 출구', rank: 3 }, -120, 44), // 출구는 그리지 않는다
    point({ class: 'bus', subclass: 'bus_stop', name: '천호역 버스정류장', rank: 5 }, -80, 90),            // 버스 정류장도 그리지 않는다
    point({ class: 'railway', subclass: 'station', rank: 7 }, 300, -200),                                  // 이름 없는 역은 그리지 않는다
    point({ class: 'convenience', name: 'GS25 천호점', rank: 4 }, -200, -60),   // 영문·숫자가 섞인 이름: 글자 파일(glyph)을 요청하게 한다
    point({ class: 'school', name: '천호초등학교', rank: 10 }, 260, 250),
    point({ class: 'shop', name: '마을 문구점', rank: 40 }, -60, -120),
  ]),
  housenumber: fc([point({ housenumber: '229' }, 30, 24)]),
};

const INDEX = {};
for (const [name, data] of Object.entries(LAYERS)) INDEX[name] = new geojsonvt(data, { maxZoom: 14, extent: 4096, buffer: 64, tolerance: 3, indexMaxZoom: 4, indexMaxPoints: 100000 });

// z/x/y 타일 하나를 MVT(.pbf)로 만든다. 비어 있으면 빈 타일.
export function tile(z, x, y) {
  const z2 = Math.min(z, 14), sc = 2 ** (z - z2), layers = {};
  const zz = z2, xx = Math.floor(x / sc), yy = Math.floor(y / sc);   // maxzoom(14) 위의 확대는 MapLibre가 늘려 쓰므로 요청되지 않지만 안전하게
  for (const [name, idx] of Object.entries(INDEX)) { const t = idx.getTile(zz, xx, yy); if (t) layers[name] = t; }
  return Buffer.from(vtpbf.fromGeojsonVt(layers, { version: 2, extent: 4096 }));
}
export const TILEJSON = (origin) => ({ tilejson: '3.0.0', name: 'bf-test', format: 'pbf', minzoom: 0, maxzoom: 14, bounds: [-180, -85, 180, 85], tiles: [origin + '/t/{z}/{x}/{y}.pbf'] });
