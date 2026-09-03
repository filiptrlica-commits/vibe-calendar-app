// netlify/functions/share-proxy.js
//
// Ukládá sdílené záznamy (stav úkolu, checklist, odběry push notifikací)
// do NETLIFY BLOBS — vlastního úložiště appky přímo na Netlify.
//
// Netlify Blobs se v tomhle nasazení neumí nakonfigurovat automaticky
// (potvrzeno chybou "MissingBlobsEnvironmentError" přímo z appky), takže
// appka mu to řekne explicitně — potřebuje k tomu dvě hodnoty z Netlify
// (Site ID a přístupový token), uložené jako proměnné prostředí
// BLOBS_SITE_ID a BLOBS_TOKEN (Site configuration → Environment variables).
const { getStore } = require("@netlify/blobs");

function randomId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function getSharedStore(){
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (!siteID || !token) {
    throw new Error("BLOBS_SITE_ID / BLOBS_TOKEN nejsou nastavené v Netlify (Site configuration → Environment variables).");
  }
  return getStore({ name: "shared-items", siteID, token });
}

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Neplatné JSON tělo požadavku." }) };
  }

  const { op, shareId, data } = body;

  try {
    const store = getSharedStore();

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
