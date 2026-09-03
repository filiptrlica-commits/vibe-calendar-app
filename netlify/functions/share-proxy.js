// netlify/functions/share-proxy.js
//
// Appka v prohlížeči NEVOLÁ jsonblob.com přímo — dělá to přes tuhle funkci.
// Důvod: prohlížeče z bezpečnostních důvodů schovávají hlavičku "Location"
// (kde je ID nově vytvořeného záznamu) u volání na cizí server (CORS), pokud
// ten cizí server výslovně neřekne "tuhle hlavičku appce ukaž". jsonblob.com
// to nedělá, takže appka by při přímém volání z prohlížeče ID záznamu nikdy
// nezískala, i když by se sdílení navenek tvářilo jako úspěšné.
//
// Server-to-server volání (tahle funkce → jsonblob.com) žádné takové
// omezení nemá — funkce si hlavičku přečte bez problému a pošle appce zpátky
// čistá data v těle odpovědi, které appka bez omezení přečte vždycky.

const JSONBLOB_API = "https://jsonblob.com/api/jsonBlob";

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Neplatné JSON tělo požadavku." }) };
  }

  const { op, shareId, data } = body;

  try {
    if (op === "create") {
      const res = await fetch(JSONBLOB_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, createdAt: Date.now(), updatedAt: Date.now() }),
      });
      if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: "jsonblob create selhal: http-" + res.status }) };
      const loc = res.headers.get("Location") || res.headers.get("location") || "";
      const id = loc.split("/").filter(Boolean).pop();
      if (!id) return { statusCode: 502, body: JSON.stringify({ error: "jsonblob nevrátil ID nového záznamu." }) };
      return { statusCode: 200, body: JSON.stringify({ id }) };
    }

    if (op === "get") {
      if (!shareId) return { statusCode: 400, body: JSON.stringify({ error: "Chybí shareId." }) };
      const res = await fetch(`${JSONBLOB_API}/${shareId}`);
      if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: "jsonblob get selhal: http-" + res.status }) };
      const json = await res.json();
      return { statusCode: 200, body: JSON.stringify(json) };
    }

    if (op === "update") {
      if (!shareId) return { statusCode: 400, body: JSON.stringify({ error: "Chybí shareId." }) };
      const current = await fetch(`${JSONBLOB_API}/${shareId}`).then(r => r.ok ? r.json() : {}).catch(() => ({}));
      const merged = { ...current, ...data, updatedAt: Date.now() };
      const res = await fetch(`${JSONBLOB_API}/${shareId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!res.ok) return { statusCode: 502, body: JSON.stringify({ error: "jsonblob update selhal: http-" + res.status }) };
      return { statusCode: 200, body: JSON.stringify(merged) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Neznámá operace: " + op }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Neznámá chyba serveru." }) };
  }
};
