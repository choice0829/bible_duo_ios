// 오프라인에서도 열리도록 앱 파일과 본문을 저장해 둔다.
// 앱을 수정해서 다시 올릴 때는 아래 CACHE 이름의 숫자를 올려야 기기에 새 버전이 반영된다.
const CACHE = 'bibleflip-v58';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.webmanifest',
  'lib/page-flip.browser.js',
  'lib/leaflet.js',
  'lib/leaflet.css',
  'data/krv.json',
  'fonts/nanum-myeongjo.woff2',
  'fonts/gowun-batang.woff2',
  'fonts/gowun-dodum.woff2',
  'fonts/nanum-gothic.woff2',
  'fonts/nanum-myeongjo-bold.woff2',
  'fonts/gowun-batang-bold.woff2',
  'fonts/nanum-gothic-bold.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

// 쉬운 말 풀이(data/std/)는 책을 더할 때마다 바뀌므로 버전 번호를 올리지 않아도 새로 받아 오도록 '네트워크 먼저'로 다루고,
// 설치할 때 준비된 책 목록(index.json)을 보고 전부 미리 저장해 오프라인에서도 열리게 한다.
async function precacheStd(cache) {
  try {
    const res = await fetch(new Request('data/std/index.json', { cache: 'reload' }));
    if (!res.ok) return;
    const idx = await res.clone().json();
    await cache.put('data/std/index.json', res);
    await Promise.all(Object.keys((idx && idx.books) || {}).filter((id) => /^[a-z0-9]+$/.test(id)).map(async (id) => {
      try { const r = await fetch(new Request('data/std/' + id + '.json', { cache: 'reload' })); if (r.ok) await cache.put('data/std/' + id + '.json', r); } catch (e) { /* 무시 */ }
    }));
  } catch (e) { /* 풀이 목록을 못 받아도 앱 설치는 계속한다 */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))).then(() => precacheStd(c)).then(() => Promise.all(['data/cafes.json', 'data/brandcafes.json'].map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (/\/data\/std\/[^/]+\.json$/.test(new URL(event.request.url).pathname)) {   // 쉬운 말 풀이: 네트워크 먼저, 안 되면 저장해 둔 것
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(event.request, copy)); }
        return res;
      }).catch(() => caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || new Response('', { status: 504 })))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request))
  );
});
