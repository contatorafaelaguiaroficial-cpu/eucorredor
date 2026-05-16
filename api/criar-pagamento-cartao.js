import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";

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
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!accessToken) {
      return res.status(500).json({
        erro: "Access Token do Mercado Pago não configurado."
      });
    }

    if (!supabaseSecretKey) {
      return res.status(500).json({
        erro: "Secret Key do Supabase não configurada."
      });
    }

    const {
      registrationId,
      amountCents,
      token,
      paymentMethodId,
      paymentTypeId,
      installments,
      payerEmail,
      identification
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

    if (!token) {
      return res.status(400).json({
        erro: "Token do cartão não informado."
      });
    }

    if (!paymentMethodId) {
      return res.status(400).json({
        erro: "Bandeira do cartão não informada."
      });
    }

    if (!paymentTypeId) {
      return res.status(400).json({
        erro: "Tipo de pagamento do cartão não informado."
      });
    }

    if (!payerEmail) {
      return res.status(400).json({
        erro: "E-mail do pagador não informado."
      });
    }

    const amount = (amountCents / 100).toFixed(2);

    const body = {
      type: "online",
      processing_mode: "automatic",
      external_reference: `race_registration_${registrationId}`,
      total_amount: amount,
      payer: {
        email: payerEmail,
        ...(identification ? { identification } : {})
      },
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: paymentMethodId,
              type: paymentTypeId,
              token,
              installments: Number(installments) || 1
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
        erro: "Erro ao criar pagamento com cartão no Mercado Pago.",
        detalhes: dados
      });
    }

    const pagamento = dados?.transactions?.payments?.[0] || null;
    const paymentStatus = dados?.status || pagamento?.status || null;
    const paymentStatusDetail = dados?.status_detail || pagamento?.status_detail || null;
    const isApproved =
      paymentStatus === "processed" &&
      paymentStatusDetail === "accredited";

    const supabaseAdmin = createClient(SUPABASE_URL, supabaseSecretKey);

    const updateData = {
      payment_provider: "mercadopago",
      payment_order_id: dados.id,
      payment_transaction_id: pagamento?.id || null,
      payment_status: paymentStatus,
      payment_status_detail: paymentStatusDetail,
      payment_expires_at: null,
      updated_at: new Date().toISOString()
    };

    if (isApproved) {
      updateData.status = "confirmed";
      updateData.confirmed_at = new Date().toISOString();
    }

    const { error: updatePaymentError } = await supabaseAdmin
      .from("race_registrations")
      .update(updateData)
      .eq("id", registrationId);

    if (updatePaymentError) {
      console.error("Erro ao salvar dados do cartão na inscrição:", updatePaymentError);

      return res.status(500).json({
        erro: "Pagamento criado, mas não foi possível vinculá-lo à inscrição.",
        detalhes: updatePaymentError.message
      });
    }

    return res.status(200).json({
      sucesso: true,
      order_id: dados.id,
      external_reference: dados.external_reference,
      status: paymentStatus,
      status_detail: paymentStatusDetail,
      inscricao_confirmada: isApproved,
      pagamento: {
        id: pagamento?.id || null,
        status: pagamento?.status || null,
        status_detail: pagamento?.status_detail || null,
        amount: pagamento?.amount || amount,
        payment_method: pagamento?.payment_method || null
      }
    });
  } catch (erro) {
    console.error("Falha ao criar pagamento com cartão:", erro);

    return res.status(500).json({
      erro: "Falha interna ao criar pagamento com cartão.",
      detalhes: erro.message
    });
  }
}
