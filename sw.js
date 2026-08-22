// Volitelný samostatný Service Worker pro plnou instalovatelnost a offline režim.
// Prohlížeče (z bezpečnostních důvodů) nedovolí registrovat Service Worker
// z data:/blob: URL, proto index.html zkouší inline verzi jako fallback,
// ale pro 100% spolehlivou instalaci na ploše telefonu nahraj tento soubor
// do STEJNÉ složky jako index.html na svůj hosting (např. GitHub Pages, Netlify).
//
// CACHE_NAME se zvyšuje při každé větší aktualizaci — starý cache se při
// aktivaci smaže, ať appka nikdy nezůstane "zaseknutá" na staré verzi.
const CACHE_NAME = "kalendar-cache-v2";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Network-first: appka se vždy pokusí stáhnout nejnovější verzi ze sítě jako
// první — takže po každém "netlify deploy" se změny projeví hned po dalším
// otevření appky. Uložená kopie v cache se použije JEN jako záložní řešení,
// když není dostupné připojení (offline režim).
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).then((res) => {
      const resClone = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone)).catch(() => {});
      return res;
    }).catch(() => caches.match(event.request))
  );
});
self.addEventListener("notificationclick", (event) => {
  const taskId = (event.notification.data && event.notification.data.taskId) || null;
  const action = event.action || "open";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:"window", includeUncontrolled:true}).then((list) => {
      const msg = { type: action === "mute" ? "stop-reminder-sound" : "open-reminder-task", taskId };
      if(list.length > 0){
        list.forEach((c) => c.postMessage(msg));
        return list[0].focus();
      }
      return self.clients.openWindow("./").then((c) => { if(c) c.postMessage(msg); });
    })
  );
});
