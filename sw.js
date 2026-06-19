// Service Worker — 振動・異音問診サポートツール
const CACHE_NAME = 'monshin-tool-v4.31';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logic_complaint.html',
  './logic_intake.html',
  './logic_meter.html',
  './logic_deepdive.html',
  './logic_summary.html',
  './logic_diagnosis.html',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap'
];

// インストール時: 静的アセットをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// アクティベート時: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME)
             .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// フェッチ時: キャッシュファースト、なければネットワーク
// ただし Gemini API への通信はキャッシュしない（常にネットワーク）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API通信はキャッシュせず、常にネットワークへ
  if (url.hostname === 'generativelanguage.googleapis.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Googleスプレッドシート（マスターデータ）はネットワークファースト（フォールバック付き）
  if (url.hostname === 'docs.google.com') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // その他のリソースはキャッシュファースト
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // レスポンスをキャッシュに保存
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // オフラインでキャッシュもない場合
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
