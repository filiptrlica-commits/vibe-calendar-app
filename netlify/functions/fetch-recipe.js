// netlify/functions/fetch-recipe.js
//
// Appka v prohlížeči nemůže stahovat obsah cizích webů přímo (blokuje to
// CORS), takže to za ni udělá tahle malá serverová funkce — stáhne stránku
// s receptem, ořeže HTML na čitelný text, a appka ho pak pošle AI, ať z
// něj vytáhne skutečné suroviny místo hádání jen podle názvu jídla.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: "Neplatné JSON tělo požadavku." }) }; }

  const { url } = body;
  if (!url || !/^https?:\/\//i.test(url)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Chybí platná URL adresa (musí začínat http:// nebo https://)." }) };
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    });
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: "Stránku se nepodařilo stáhnout: http-" + res.status }) };
    }
    const html = await res.text();
    // Hrubé, ale spolehlivé ořezání HTML na čitelný text — odstraní skripty,
    // styly a značky, ať appka pošle AI jen text, ne balast.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000); // appka pošle jen rozumně velký úsek, ne celou stránku
    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: "Stránka neobsahuje žádný čitelný text." }) };
    }
    return { statusCode: 200, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Stažení stránky selhalo." }) };
  }
};
