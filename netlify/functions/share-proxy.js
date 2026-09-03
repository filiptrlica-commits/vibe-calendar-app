// netlify/functions/share-proxy.js
//
// Ukládá sdílené záznamy (stav úkolu, checklist, odběry push notifikací)
// do NETLIFY BLOBS — vlastního úložiště appky přímo na Netlify. Appka dřív
// používala cizí bezplatnou službu jsonblob.com, ale ta appku blokovala
// (Cloudflare ochrana blokovala serverové volání jako "podezřelé" a
// samotné volání z telefonu appka občas nedostala vůbec skrz kvůli
// pravidlům prohlížeče). Netlify Blobs je součást stejné platformy, kde
// appka běží, takže žádné z těchhle omezení nehrozí.
const { getStore } = require("@netlify/blobs");

function randomId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Neplatné JSON tělo požadavku." }) };
  }

  const { op, shareId, data } = body;
  const store = getStore("shared-items");

  try {
    if (op === "create") {
      const id = randomId();
      const record = { ...data, createdAt: Date.now(), updatedAt: Date.now() };
      await store.setJSON(id, record);
      return { statusCode: 200, body: JSON.stringify({ id }) };
    }

    if (op === "get") {
      if (!shareId) return { statusCode: 400, body: JSON.stringify({ error: "Chybí shareId." }) };
      const record = await store.get(shareId, { type: "json" });
      if (!record) return { statusCode: 404, body: JSON.stringify({ error: "Záznam nenalezen." }) };
      return { statusCode: 200, body: JSON.stringify(record) };
    }

    if (op === "update") {
      if (!shareId) return { statusCode: 400, body: JSON.stringify({ error: "Chybí shareId." }) };
      const current = (await store.get(shareId, { type: "json" })) || {};
      const merged = { ...current, ...data, updatedAt: Date.now() };
      await store.setJSON(shareId, merged);
      return { statusCode: 200, body: JSON.stringify(merged) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Neznámá operace: " + op }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Neznámá chyba serveru." }) };
  }
};
