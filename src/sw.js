/* eslint-disable no-restricted-globals */
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

const PAGES_CACHE = "pages";

// Precache build assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Единоразовая чистка «отравленного» кэша страниц: раньше при таймауте 5с в
// кэш pages могли попасть 503-ответы, из-за чего навигация вечно отдавала 503
// из кэша. Удаляем этот рантайм-кэш при активации нового SW.
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete(PAGES_CACHE));
});

// API и WebSocket никогда не кэшируем сервис-воркером — только сеть.
registerRoute(
  ({ url }) => url.pathname.startsWith("/api") || url.pathname.startsWith("/ws"),
  new NetworkOnly()
);

// HTML-навигации: сеть-первым с запасным таймаутом и кэшированием ТОЛЬКО 200.
// - networkTimeoutSeconds увеличен до 30с, чтобы тяжёлые/медленные страницы
//   успевали загрузиться и не сбрасывались в кэш преждевременно;
// - CacheableResponsePlugin([200]) не даёт сохранять 5xx (503/500/502) в кэш,
//   поэтому ошибочные ответы больше не «залипают».
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: PAGES_CACHE,
    networkTimeoutSeconds: 30,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  })
);

// JS/CSS: stale-while-revalidate
registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "style",
  new StaleWhileRevalidate({
    cacheName: "assets",
  })
);

// External media should bypass CacheFirst to avoid no-response from empty cache.
registerRoute(
  ({ url }) => url.href.startsWith("https://app.nurcrm.kg/media/"),
  new NetworkOnly()
);

// Images: cache-first with expiration
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

