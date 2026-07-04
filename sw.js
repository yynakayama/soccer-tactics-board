// Soccer Tactics Board — Service Worker
// 戦略: network-first（同一オリジンGETのみ）。オンライン時は常に最新を取得し、
// 取得できた応答をキャッシュへ書き戻す。オフライン時のみキャッシュから描画する。
// 単一キャッシュ名で運用し、activate で旧キャッシュを掃除。deploy 毎の版数バンプは不要。
const CACHE = "soccer-board-cache";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./i18n.js",
  "./manifest.webmanifest",
  "./assets/favicon-16.png",
  "./assets/favicon-32.png",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // 同一オリジンの GET のみ扱う。POST や外部リクエストはブラウザ既定に任せる。
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 正常応答のみキャッシュを更新（エラー応答は保存しない）。
        if (response && response.ok) {
          const copy = response.clone();
          caches
            .open(CACHE)
            .then((cache) => cache.put(request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        // オフライン等でネットワークが使えない時のみキャッシュへ。
        // 未キャッシュのナビゲーションは index.html にフォールバック。
        caches.match(request).then((cached) => cached || caches.match("./index.html")),
      ),
  );
});
