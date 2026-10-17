// Service worker do PWA.
// - Modelo (.onnx) e /assets/ (inclui os .wasm do ONNX Runtime, com hash no nome): cache primeiro.
// - Páginas e demais arquivos: rede primeiro, com o cache como reserva (funciona sem internet).
// - API e mapa: sempre pela rede (a fila offline do app cuida dos envios).

const VERSAO = "v1";
const CACHE_APP = `app-${VERSAO}`;
const CACHE_PESADOS = `pesados-${VERSAO}`;
const SO_REDE = ["/deteccoes", "/obstaculos", "/mapa", "/saude", "/docs", "/openapi.json"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(["/", "/manifest.webmanifest"])));
  self.skipWaiting();
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => ![CACHE_APP, CACHE_PESADOS].includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== "GET" || url.origin !== location.origin) return;
  if (SO_REDE.some((p) => url.pathname.startsWith(p))) return;

  if (url.pathname.startsWith("/modelos/") || url.pathname.startsWith("/assets/")) {
    ev.respondWith(
      caches.open(CACHE_PESADOS).then(async (cache) => {
        const salvo = await cache.match(ev.request);
        if (salvo) return salvo;
        const resp = await fetch(ev.request);
        if (resp.ok) cache.put(ev.request, resp.clone());
        return resp;
      }),
    );
    return;
  }

  ev.respondWith(
    fetch(ev.request)
      .then((resp) => {
        if (resp.ok) caches.open(CACHE_APP).then((c) => c.put(ev.request, resp.clone()));
        return resp;
      })
      .catch(async () => (await caches.match(ev.request)) ?? (await caches.match("/"))),
  );
});
