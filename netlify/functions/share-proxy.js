// netlify/functions/share-proxy.js
//
// Appka v prohlížeči NEVOLÁ jsonblob.com přímo — dělá to přes tuhle funkci.
// Dva důvody, oba potvrzené v praxi (ne jen teorie):
//  1) Prohlížeče schovávají hlavičku "Location" (ID nového záznamu) u volání
//     na cizí server (CORS), pokud to ten server výslovně nedovolí.
//  2) jsonblob.com navíc BLOKUJE požadavky, co nevypadají jako běžný
//     prohlížeč (vrací 403), což se stává typicky u serverových volání bez
//     hlaviček jako User-Agent — proto je tahle funkce posílá schválně,
//     ať jsonblob.com žádost nerozezná od běžné návštěvy webu.
const JSONBLOB_API = "https://jsonblob.com/api/jsonBlob";
const BROWSER_LIKE_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

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
        headers: BROWSER_LIKE_HEADERS,
        body: JSON.stringify({ ...data, createdAt: Date.now(), updatedAt: Date.now() }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { statusCode: 502, body: JSON.stringify({ error: "jsonblob create selhal: http-" + res.status, jsonblobBody: errBody }) };
      }
      const loc = res.headers.get("Location") || res.headers.get("location") || "";
      const id = loc.split("/").filter(Boolean).pop();
      if (!id) return { statusCode: 502, body: JSON.stringify({ error: "jsonblob nevrátil ID nového záznamu." }) };
      return { statusCode: 200, body: JSON.stringify({ id }) };
    }

    if (op === "get") {
      if (!shareId) return { statusCode: 400, body: JSON.stringify({ error: "Chybí shareId." }) };
      const res = await fetch(`${JSONBLOB_API}/${shareId}`, { headers: BROWSER_LIKE_HEADERS });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { statusCode: 502, body: JSON.stringify({ error: "jsonblob get selhal: http-" + res.status, jsonblobBody: errBody }) };
      }
      const json = await res.json();
      return { statusCode: 200, body: JSON.stringify(json) };
    }

    if (op === "update") {
      if (!shareId) return { statusCode: 400, body: JSON.stringify({ error: "Chybí shareId." }) };
      const current = await fetch(`${JSONBLOB_API}/${shareId}`, { headers: BROWSER_LIKE_HEADERS }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
      const merged = { ...current, ...data, updatedAt: Date.now() };
      const res = await fetch(`${JSONBLOB_API}/${shareId}`, {
        method: "PUT",
        headers: BROWSER_LIKE_HEADERS,
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        return { statusCode: 502, body: JSON.stringify({ error: "jsonblob update selhal: http-" + res.status, jsonblobBody: errBody }) };
      }
      return { statusCode: 200, body: JSON.stringify(merged) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Neznámá operace: " + op }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Neznámá chyba serveru." }) };
  }
};
