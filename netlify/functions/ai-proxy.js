// netlify/functions/ai-proxy.js
//
// Bezpečný server-side proxy k Anthropic API. Appka v prohlížeči NIKDY
// nevidí API klíč — ten žije jen tady, jako proměnná prostředí
// ANTHROPIC_API_KEY nastavená v Netlify (Site configuration →
// Environment variables). Appka posílá požadavky přesně ve formátu,
// který Anthropic API očekává, takže tahle funkce je jen bezpečně
// "přeposílá" dál a přidá k nim tajný klíč.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY není nastavený v Netlify (Site configuration → Environment variables)." }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Neplatné tělo požadavku." }) };
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const maxTokens = Number(payload.max_tokens) || 500;
  if (!messages.length) {
    return { statusCode: 400, body: JSON.stringify({ error: "Prázdný požadavek." }) };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const message = (data && data.error && data.error.message) || `Anthropic API vrátilo chybu (${res.status}).`;
      return { statusCode: res.status, body: JSON.stringify({ error: message }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Nepodařilo se spojit s Anthropic API: " + e.message }) };
  }
};
