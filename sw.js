/* English Quest Service Worker — 離線快取 v3 */
const CACHE = "englishquest-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./content-grammar.js",
  "./content-mock.js",
  "./content-mock-extra.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(function (c) {
        return c.addAll(ASSETS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) {
            return k !== CACHE;
          }).map(function (k) {
            return caches.delete(k);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // API 請求完全不快取（帳號與存檔一律走網路）
  if (url.pathname.indexOf("/api/") === 0) return;

  // 導覽（開新頁面）：網路優先，離線才用快取，確保拿到最新版
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then(function (resp) {
          const clone = resp.clone();
          caches.open(CACHE).then(function (c) {
            c.put(e.request, clone);
          });
          return resp;
        })
        .catch(function () {
          return caches.match(e.request).then(function (r) {
            return r || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // 靜態資源：快取優先，沒有再上網抓並快取
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request)
        .then(function (resp) {
          if (resp && resp.status === 200 && resp.type === "basic") {
            const clone = resp.clone();
            caches.open(CACHE).then(function (c) {
              c.put(e.request, clone);
            });
          }
          return resp;
        })
        .catch(function () {
          return new Response("", { status: 504, statusText: "offline" });
        });
    })
  );
});
