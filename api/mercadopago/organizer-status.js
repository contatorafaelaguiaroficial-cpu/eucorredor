import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";

function configurarCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  configurarCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      connected: false,
      error: "Método não permitido."
    });
  }

  try {
    const organizerId = String(req.query?.organizerId || "").trim();

    if (!organizerId) {
      return res.status(400).json({
        connected: false,
        error: "organizerId é obrigatório."
      });
    }

    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!SUPABASE_URL || !supabaseSecretKey) {
      console.error("Supabase não configurado para consultar status do organizador.");

      return res.status(500).json({
        connected: false,
        error: "Configuração do servidor incompleta."
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, supabaseSecretKey);

    const { data, error } = await supabaseAdmin
      .from("organizer_mercadopago_accounts")
      .select("organizer_id, status, connected_at")
      .eq("organizer_id", organizerId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao consultar status Mercado Pago do organizador:", error);

      return res.status(500).json({
        connected: false,
        error: "Não foi possível consultar a conexão do organizador."
      });
    }

    const connected = data?.status === "connected";

    return res.status(200).json({
      connected,
      status: data?.status || "not_connected",
      connected_at: data?.connected_at || null
    });
  } catch (error) {
    console.error("Erro inesperado ao consultar status Mercado Pago:", error);

    return res.status(500).json({
      connected: false,
      error: "Erro interno ao consultar a conexão."
    });
  }
}
