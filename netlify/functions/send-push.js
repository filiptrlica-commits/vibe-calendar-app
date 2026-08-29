// netlify/functions/send-push.js
const webpush = require("web-push");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:noreply@example.com";

  if (!publicKey || !privateKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY nejsou nastavené v Netlify." }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Neplatné JSON tělo požadavku." }) };
  }

  const { subscription, title, message, url } = body;
  if (!subscription || !subscription.endpoint) {
    return { statusCode: 400, body: JSON.stringify({ error: "Chybí platný 'subscription' objekt." }) };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const payload = JSON.stringify({
    title: title || "Vibe Calendar",
    message: message || "Něco se změnilo ve sdílené položce.",
    url: url || "./",
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const expired = e.statusCode === 404 || e.statusCode === 410;
    return {
      statusCode: expired ? 410 : 500,
      body: JSON.stringify({ error: e.message || "Odeslání push notifikace selhalo.", expired }),
    };
  }
};
