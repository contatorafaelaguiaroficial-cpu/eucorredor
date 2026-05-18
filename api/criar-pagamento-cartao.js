import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";
const WEBHOOK_URL = "https://app.eucorredor.com.br/api/webhook-mercadopago?source_news=webhooks";

function calcularPlatformFeeCents(amountCents, feeType, feeValue) {
  const valor = Number(feeValue || 0);

  if (!Number.isFinite(valor) || valor <= 0) {
    return 0;
  }

  let feeCents = 0;

  if (feeType === "percentage") {
    feeCents = Math.round((amountCents * valor) / 100);
  } else {
    feeCents = Math.round(valor * 100);
  }

  return Math.max(0, Math.min(feeCents, amountCents));
}

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
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseSecretKey) {
      return res.status(500).json({
        erro: "Secret Key do Supabase não configurada."
      });
    }

    const {
      registrationId,
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

    const supabaseAdmin = createClient(SUPABASE_URL, supabaseSecretKey);

    const { data: registration, error: registrationError } = await supabaseAdmin
      .from("race_registrations")
      .select("id, race_event_id, amount_cents, status")
      .eq("id", registrationId)
      .maybeSingle();

    if (registrationError) {
      console.error("Erro ao buscar inscrição para cartão:", registrationError);

      return res.status(500).json({
        erro: "Não foi possível buscar a inscrição."
      });
    }

    if (!registration?.id) {
      return res.status(404).json({
        erro: "Inscrição não encontrada."
      });
    }

    if (registration.status === "confirmed") {
      return res.status(409).json({
        erro: "Esta inscrição já está confirmada."
      });
    }

    const amountCents = Number(registration.amount_cents || 0);

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return res.status(400).json({
        erro: "Valor da inscrição inválido."
      });
    }

    const { data: raceEvent, error: raceEventError } = await supabaseAdmin
      .from("race_events")
      .select("id, organizer_id, platform_fee_type, platform_fee_value")
      .eq("id", registration.race_event_id)
      .maybeSingle();

    if (raceEventError) {
      console.error("Erro ao buscar evento da inscrição:", raceEventError);

      return res.status(500).json({
        erro: "Não foi possível buscar os dados do evento."
      });
    }

    if (!raceEvent?.organizer_id) {
      return res.status(400).json({
        erro: "Evento sem organizador vinculado."
      });
    }

    const { data: organizerMpAccount, error: organizerMpError } = await supabaseAdmin
      .from("organizer_mercadopago_accounts")
      .select("organizer_id, access_token, status")
      .eq("organizer_id", raceEvent.organizer_id)
      .maybeSingle();

    if (organizerMpError) {
      console.error("Erro ao buscar conta Mercado Pago do organizador:", organizerMpError);

      return res.status(500).json({
        erro: "Não foi possível buscar a conta Mercado Pago do organizador."
      });
    }

    if (!organizerMpAccount?.access_token || organizerMpAccount.status !== "connected") {
      return res.status(400).json({
        erro: "O organizador desta prova ainda não conectou o Mercado Pago."
      });
    }

    const platformFeeCents = calcularPlatformFeeCents(
      amountCents,
      raceEvent.platform_fee_type,
      raceEvent.platform_fee_value
    );

    const transactionAmount = Number((amountCents / 100).toFixed(2));
    const applicationFee = Number((platformFeeCents / 100).toFixed(2));

    const body = {
      transaction_amount: transactionAmount,
      token,
      description: "Inscrição de corrida no EuCorredor",
      installments: Number(installments) || 1,
      payment_method_id: paymentMethodId,
      external_reference: `race_registration_${registrationId}`,
      notification_url: WEBHOOK_URL,
      payer: {
        email: payerEmail,
        ...(identification ? { identification } : {})
      },
      ...(applicationFee > 0 ? { application_fee: applicationFee } : {})
    };

    const resposta = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${organizerMpAccount.access_token}`,
        "X-Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify(body)
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro Mercado Pago ao criar cartão:", dados);

      return res.status(resposta.status).json({
        erro: "Erro ao criar pagamento com cartão no Mercado Pago.",
        detalhes: dados
      });
    }

    const paymentStatus = dados.status || null;
    const paymentStatusDetail = dados.status_detail || null;
    const isApproved =
      paymentStatus === "approved" &&
      paymentStatusDetail === "accredited";

    const updateData = {
      payment_provider: "mercadopago",
      payment_order_id: null,
      payment_transaction_id: String(dados.id),
      payment_status: paymentStatus,
      payment_status_detail: paymentStatusDetail,
      payment_expires_at: null,
      platform_fee_cents: platformFeeCents,
      payment_split_mode: "mercadopago_split_1_1",
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
      payment_id: String(dados.id),
      order_id: null,
      external_reference: dados.external_reference,
      status: paymentStatus,
      status_detail: paymentStatusDetail,
      inscricao_confirmada: isApproved,
      pagamento: {
        id: String(dados.id),
        status: paymentStatus,
        status_detail: paymentStatusDetail,
        amount: dados.transaction_amount || transactionAmount,
        payment_method: {
          id: dados.payment_method_id || paymentMethodId,
          type: paymentTypeId || null
        }
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
