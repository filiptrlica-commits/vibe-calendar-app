// Volitelný samostatný Service Worker pro plnou instalovatelnost a offline režim.
// Prohlížeče (z bezpečnostních důvodů) nedovolí registrovat Service Worker
// z data:/blob: URL, proto index.html zkouší inline verzi jako fallback,
// ale pro 100% spolehlivou instalaci na ploše telefonu nahraj tento soubor
// do STEJNÉ složky jako index.html na svůj hosting (např. GitHub Pages, Netlify).
//
// CACHE_NAME se zvyšuje při každé větší aktualizaci — starý cache se při
// aktivaci smaže, ať appka nikdy nezůstane "zaseknutá" na staré verzi.
const CACHE_NAME = "kalendar-cache-v3";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
// Umožní appce (app.js) říct nové, ještě čekající verzi service workeru
// "převezmi vládu hned", místo aby čekala, až uživatel appku úplně zavře
// a znovu otevře — díky tomu se třeba podpora push notifikací aktivuje
// hned po nasazení, ne až za den nebo dva.
self.addEventListener("message", (event) => {
  if(event.data && event.data.type === "skip-waiting") self.skipWaiting();
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
// Přijetí skutečné push notifikace ze serveru (funguje i s appkou zavřenou
// a telefonem zamčeným) — appka na pozadí jen ukáže, co jí server poslal.
self.addEventListener("push", (event) => {
  let data = { title: "Vibe Calendar", message: "Něco se změnilo ve sdílené položce.", url: "./" };
  try{ if(event.data) data = { ...data, ...event.data.json() }; }catch(e){}
  // Kromě zobrazení notifikace pošle appce (pokud je zrovna otevřená) potvrzení
  // "push skutečně dorazil" — díky tomu appka v diagnostice pozná jistě, jestli
  // se telefon k serveru vůbec dostal, nebo jestli to zůstalo jen na doručení
  // (OS oprávnění), místo aby appka jen hádala.
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.message,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        data: { url: data.url },
        tag: "vibe-calendar-share-update",
      }),
      self.clients.matchAll({type:"window", includeUncontrolled:true}).then((list) => {
        list.forEach((c) => c.postMessage({ type: "push-received-debug", receivedAt: Date.now() }));
      }),
    ])
  );
});
self.addEventListener("notificationclick", (event) => {
  const taskId = (event.notification.data && event.notification.data.taskId) || null;
  const url = (event.notification.data && event.notification.data.url) || "./";
  const action = event.action || "open";
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:"window", includeUncontrolled:true}).then((list) => {
      const msg = { type: action === "mute" ? "stop-reminder-sound" : "open-reminder-task", taskId };
      if(list.length > 0){
        list.forEach((c) => c.postMessage(msg));
        return list[0].focus();
      }
      return self.clients.openWindow(url).then((c) => { if(c) c.postMessage(msg); });
    })
  );
});
