import { createClient } from "@supabase/supabase-js";

function lerCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, item) => {
    const [nome, ...valorPartes] = item.trim().split("=");

    if (!nome) return cookies;

    cookies[nome] = decodeURIComponent(valorPartes.join("=") || "");
    return cookies;
  }, {});
}

function limparCookie(nome) {
  return `${nome}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function escaparHtml(valor = "") {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paginaHtml({ titulo, mensagem, sucesso = false }) {
  const tituloSeguro = escaparHtml(titulo);
  const mensagemSegura = escaparHtml(mensagem);

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${tituloSeguro}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f5f5f5;
            color: #141414;
          }
          .card {
            width: min(560px, 100%);
            background: #fff;
            border: 1px solid #e8e8e8;
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
          }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            border-radius: 999px;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 700;
            background: ${sucesso ? "#eaf8ef" : "#fff1f1"};
            color: ${sucesso ? "#116b36" : "#a31919"};
            margin-bottom: 18px;
          }
          h1 {
            margin: 0 0 12px;
            font-size: 28px;
            line-height: 1.15;
          }
          p {
            margin: 0;
            font-size: 16px;
            line-height: 1.55;
            color: #4a4a4a;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <div class="badge">${sucesso ? "Conexão concluída" : "Não foi possível concluir"}</div>
          <h1>${tituloSeguro}</h1>
          <p>${mensagemSegura}</p>
        </main>
      </body>
    </html>
  `;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send(
      paginaHtml({
        titulo: "Método não permitido",
        mensagem: "Use GET para concluir a conexão com o Mercado Pago."
      })
    );
  }

  try {
    const clientId = process.env.MERCADOPAGO_CLIENT_ID;
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
    const redirectUri = process.env.MERCADOPAGO_OAUTH_REDIRECT_URI;
    const supabaseUrl = "https://atzbgyjenhfgrnwdstnl.supabase.co";
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).send(
        paginaHtml({
          titulo: "Configuração OAuth incompleta",
          mensagem: "As credenciais do Mercado Pago não estão configuradas corretamente."
        })
      );
    }

    if (!supabaseSecretKey) {
      return res.status(500).send(
        paginaHtml({
          titulo: "Configuração do banco incompleta",
          mensagem: "A chave segura do Supabase não está configurada."
        })
      );
    }

    const code = req.query?.code;
    const stateRecebido = req.query?.state;
    const erroAutorizacao = req.query?.error;

    if (erroAutorizacao) {
      return res.status(400).send(
        paginaHtml({
          titulo: "Autorização cancelada",
          mensagem: "O Mercado Pago não autorizou a conexão da conta do organizador."
        })
      );
    }

    if (!code || typeof code !== "string") {
      return res.status(400).send(
        paginaHtml({
          titulo: "Código ausente",
          mensagem: "O retorno do Mercado Pago não trouxe um código de autorização válido."
        })
      );
    }

    const cookies = lerCookies(req.headers.cookie || "");
    const stateSalvo = cookies.mp_oauth_state;
    const codeVerifier = cookies.mp_oauth_verifier;
    const organizerId = cookies.mp_oauth_organizer_id;

    if (!stateRecebido || stateRecebido !== stateSalvo) {
      return res.status(400).send(
        paginaHtml({
          titulo: "Validação de segurança recusada",
          mensagem: "O estado da autorização não confere. Inicie a conexão novamente."
        })
      );
    }

    if (!codeVerifier) {
      return res.status(400).send(
        paginaHtml({
          titulo: "Verificador PKCE ausente",
          mensagem: "A autorização expirou ou foi iniciada em outro navegador. Inicie novamente."
        })
      );
    }

    if (!organizerId) {
      return res.status(400).send(
        paginaHtml({
          titulo: "Organizador não identificado",
          mensagem: "Não foi possível identificar qual organizador está sendo conectado."
        })
      );
    }

    const respostaToken = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        test_token: false
      })
    });

    const tokenData = await respostaToken.json();

    if (!respostaToken.ok) {
      console.error("Erro ao obter token OAuth do Mercado Pago:", tokenData);

      return res.status(respostaToken.status).send(
        paginaHtml({
          titulo: "Falha ao conectar Mercado Pago",
          mensagem: "O Mercado Pago recusou a troca do código por credenciais de acesso."
        })
      );
    }

    const expiresIn = Number(tokenData.expires_in || 0);
    const tokenExpiresAt =
      expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null;

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

    const { data: organizer, error: organizerError } = await supabaseAdmin
      .from("race_organizers")
      .select("id, name")
      .eq("id", organizerId)
      .maybeSingle();

    if (organizerError || !organizer) {
      console.error("Organizador não localizado no Supabase:", organizerError);

      return res.status(404).send(
        paginaHtml({
          titulo: "Organizador não encontrado",
          mensagem: "A conta foi autorizada, mas o organizador não existe mais no EuCorredor."
        })
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from("organizer_mercadopago_accounts")
      .upsert(
        {
          organizer_id: organizerId,
          mercadopago_user_id: tokenData.user_id ? String(tokenData.user_id) : null,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          public_key: tokenData.public_key || null,
          token_type: tokenData.token_type || null,
          scope: tokenData.scope || null,
          expires_in: expiresIn || null,
          token_expires_at: tokenExpiresAt,
          status: "connected",
          connected_at: new Date().toISOString()
        },
        {
          onConflict: "organizer_id"
        }
      );

    if (upsertError) {
      console.error("Erro ao salvar tokens OAuth no Supabase:", upsertError);

      return res.status(500).send(
        paginaHtml({
          titulo: "Token recebido, mas não salvo",
          mensagem: "A autorização foi concluída, porém o EuCorredor não conseguiu salvar a conexão."
        })
      );
    }

    res.setHeader("Set-Cookie", [
      limparCookie("mp_oauth_state"),
      limparCookie("mp_oauth_verifier"),
      limparCookie("mp_oauth_organizer_id")
    ]);

    return res.status(200).send(
      paginaHtml({
        titulo: "Mercado Pago conectado com sucesso",
        mensagem: `A conta foi vinculada ao organizador ${organizer.name}. Você já pode voltar ao EuCorredor.`,
        sucesso: true
      })
    );
  } catch (erro) {
    console.error("Erro no callback OAuth Mercado Pago:", erro);

    return res.status(500).send(
      paginaHtml({
        titulo: "Falha interna na conexão",
        mensagem: "O EuCorredor não conseguiu concluir a conexão com o Mercado Pago."
      })
    );
  }
}
