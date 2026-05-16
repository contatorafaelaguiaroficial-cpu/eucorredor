import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido. Use POST."
    });
  }

  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({
        erro: "Access Token do Mercado Pago não configurado."
      });
    }

    const {
      registrationId,
      amountCents,
      participantEmail,
      participantName
    } = req.body || {};

    if (!registrationId) {
      return res.status(400).json({
        erro: "ID da inscrição não informado."
      });
    }

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        erro: "Valor da inscrição inválido."
      });
    }

    if (!participantEmail) {
      return res.status(400).json({
        erro: "E-mail do participante não informado."
      });
    }

    const amount = (amountCents / 100).toFixed(2);

    const body = {
      type: "online",
      processing_mode: "automatic",
      external_reference: `race_registration_${registrationId}`,
      total_amount: amount,
      payer: {
        email: "comprador@testuser.com",
        first_name: participantName || "Corredor"
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: "pix",
              type: "bank_transfer"
            }
          }
        ]
      }
    };

    const resposta = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      return res.status(resposta.status).json({
        erro: "Erro ao criar pagamento Pix no Mercado Pago.",
        detalhes: dados
      });
    }

    const pagamento = dados?.transactions?.payments?.[0] || null;
    const metodo = pagamento?.payment_method || null;

    const supabaseUrl = "https://atzbgyjenhfgrnwdstnl.supabase.co";
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseSecretKey) {
      return res.status(500).json({
        erro: "Secret Key do Supabase não configurada."
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

    const { error: updatePaymentError } = await supabaseAdmin
      .from("race_registrations")
      .update({
        payment_provider: "mercadopago",
        payment_order_id: dados.id,
        payment_transaction_id: pagamento?.id || null,
        payment_status: dados.status || pagamento?.status || null,
        payment_status_detail: dados.status_detail || pagamento?.status_detail || null,
        payment_expires_at: pagamento?.date_of_expiration || null
      })
      .eq("id", registrationId);

    if (updatePaymentError) {
      console.error("Erro ao salvar dados do Pix na inscrição:", updatePaymentError);

      return res.status(500).json({
        erro: "Pix criado, mas não foi possível vincular o pagamento à inscrição.",
        detalhes: updatePaymentError.message
      });
    }

    return res.status(200).json({
      sucesso: true,
      order_id: dados.id,
      external_reference: dados.external_reference,
      status: dados.status,
      status_detail: dados.status_detail,
      pagamento: {
        id: pagamento?.id || null,
        status: pagamento?.status || null,
        status_detail: pagamento?.status_detail || null,
        amount: pagamento?.amount || amount,
        qr_code: metodo?.qr_code || null,
        qr_code_base64: metodo?.qr_code_base64 || null,
        ticket_url: metodo?.ticket_url || null,
        expiration_date: pagamento?.date_of_expiration || null
      }
    });
  } catch (erro) {
    console.error("Falha ao criar pagamento Pix:", erro);

    return res.status(500).json({
      erro: "Falha interna ao criar pagamento Pix.",
      detalhes: erro.message
    });
  }
}
