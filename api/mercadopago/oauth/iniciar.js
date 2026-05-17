import { createHash, randomBytes } from "crypto";

function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function gerarStringSegura(bytes = 32) {
  return base64Url(randomBytes(bytes));
}

function gerarCodeChallenge(codeVerifier) {
  const hash = createHash("sha256").update(codeVerifier).digest();
  return base64Url(hash);
}

function cookie(nome, valor, maxAge = 600) {
  return `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      erro: "Método não permitido. Use GET."
    });
  }

  try {
    const clientId = process.env.MERCADOPAGO_CLIENT_ID;
    const redirectUri = process.env.MERCADOPAGO_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        erro: "Credenciais OAuth do Mercado Pago não configuradas."
      });
    }

    const organizerId = req.query?.organizerId;

    if (!organizerId || typeof organizerId !== "string") {
      return res.status(400).json({
        erro: "organizerId não informado."
      });
    }

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(organizerId)) {
      return res.status(400).json({
        erro: "organizerId inválido."
      });
    }

    const state = gerarStringSegura(32);
    const codeVerifier = gerarStringSegura(64);
    const codeChallenge = gerarCodeChallenge(codeVerifier);

    res.setHeader("Set-Cookie", [
      cookie("mp_oauth_state", state),
      cookie("mp_oauth_verifier", codeVerifier),
      cookie("mp_oauth_organizer_id", organizerId)
    ]);

    const authorizationUrl = new URL(
      "https://auth.mercadopago.com.br/authorization"
    );

    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("platform_id", "mp");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("code_challenge", codeChallenge);
    authorizationUrl.searchParams.set("code_challenge_method", "S256");

    return res.redirect(302, authorizationUrl.toString());
  } catch (erro) {
    console.error("Erro ao iniciar OAuth Mercado Pago:", erro);

    return res.status(500).json({
      erro: "Falha interna ao iniciar conexão com Mercado Pago.",
      detalhes: erro.message
    });
  }
}
