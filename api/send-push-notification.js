import crypto from "crypto";
import http2 from "http2";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createApnsJwt() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY_BASE64
    ? Buffer.from(process.env.APNS_PRIVATE_KEY_BASE64, "base64").toString("utf8").trim()
    : process.env.APNS_PRIVATE_KEY
      ?.replace(/\\n/g, "\n")
      ?.trim();

  if (!keyId || !teamId || !privateKey) {
    throw new Error("Variáveis APNs ausentes.");
  }

  const header = {
    alg: "ES256",
    kid: keyId,
  };

  const payload = {
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  };

  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const sign = crypto.createSign("SHA256");
  sign.update(unsignedToken);
  sign.end();

  const signature = sign.sign(privateKey);

  return `${unsignedToken}.${base64url(signature)}`;
}

function sendApnsPush({ token, title, body, data = {} }) {
  return new Promise((resolve) => {
    const isProduction = String(process.env.APNS_PRODUCTION).toLowerCase() === "true";
    const host = isProduction ? "api.push.apple.com" : "api.sandbox.push.apple.com";
    const bundleId = process.env.APNS_BUNDLE_ID || "com.eucorredor.app";

    let jwt;

    try {
      jwt = createApnsJwt();
    } catch (err) {
      resolve({ ok: false, token, status: 500, error: err.message });
      return;
    }

    const client = http2.connect(`https://${host}`);

    client.on("error", (err) => {
      resolve({ ok: false, token, status: 500, error: err.message });
    });

    const payload = JSON.stringify({
      aps: {
        alert: {
          title,
          body,
        },
        sound: "default",
      },
      ...data,
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let responseBody = "";
    let statusCode = 0;

    req.setEncoding("utf8");

    req.on("response", (headers) => {
      statusCode = headers[":status"];
    });

    req.on("data", (chunk) => {
      responseBody += chunk;
    });

    req.on("end", () => {
      client.close();

      let parsedResponse = null;

      try {
        parsedResponse = responseBody ? JSON.parse(responseBody) : null;
      } catch {
        parsedResponse = responseBody || null;
      }

      resolve({
        ok: statusCode >= 200 && statusCode < 300,
        token,
        status: statusCode,
        response: parsedResponse,
      });
    });

    req.on("error", (err) => {
      client.close();
      resolve({ ok: false, token, status: 500, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

async function getUserTokens(userId) {
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!serviceKey) {
    throw new Error("SUPABASE_SECRET_KEY ausente.");
  }

  const url = `${SUPABASE_URL}/rest/v1/mobile_push_tokens?user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&select=id,token,platform`;

  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao buscar tokens: ${text}`);
  }

  return response.json();
}

async function deactivateToken(token) {
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!serviceKey || !token) return;

  await fetch(`${SUPABASE_URL}/rest/v1/mobile_push_tokens?token=eq.${encodeURIComponent(token)}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({
      is_active: false,
      updated_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const internalSecret = process.env.PUSH_INTERNAL_SECRET;
  const receivedSecret = req.headers["x-push-secret"];

  if (!internalSecret || receivedSecret !== internalSecret) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    const { userId, title, body, data } = req.body || {};

    if (!userId || !title || !body) {
      return res.status(400).json({
        error: "Campos obrigatórios: userId, title e body.",
      });
    }

    const tokens = await getUserTokens(userId);

    if (!tokens.length) {
      return res.status(200).json({
        ok: true,
        sent: 0,
        message: "Usuário sem tokens ativos.",
      });
    }

    const results = await Promise.all(
      tokens.map((item) =>
        sendApnsPush({
          token: item.token,
          title,
          body,
          data,
        })
      )
    );

    await Promise.all(
      results
        .filter((result) => result.status === 410 || result?.response?.reason === "BadDeviceToken")
        .map((result) => deactivateToken(result.token))
    );

    return res.status(200).json({
      ok: true,
      sent: results.filter((result) => result.ok).length,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error("Erro ao enviar push:", err);
    return res.status(500).json({
      error: "Erro ao enviar push.",
      details: err.message || String(err),
    });
  }
}
