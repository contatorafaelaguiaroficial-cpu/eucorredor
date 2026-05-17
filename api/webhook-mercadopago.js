import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";

export default async function handler(req, res) {
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

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const paymentId =
      payload?.data?.id ||
      req.query?.["data.id"] ||
      req.query?.id ||
      null;

    console.log(
      "Webhook Mercado Pago recebido:",
      JSON.stringify(payload, null, 2)
    );

    if (!paymentId) {
      return res.status(200).json({
        recebido: true,
        aviso: "Notificação recebida sem paymentId."
      });
    }

    const paymentIdText = String(paymentId);
    const supabaseAdmin = createClient(SUPABASE_URL, supabaseSecretKey);

    const {
      data: registration,
      error: findRegistrationError
    } = await supabaseAdmin
      .from("race_registrations")
      .select("id, status, race_event_id, payment_transaction_id")
      .eq("payment_transaction_id", paymentIdText)
      .maybeSingle();

    if (findRegistrationError) {
      console.error(
        "Erro ao localizar inscrição pelo paymentId:",
        findRegistrationError
      );

      return res.status(500).json({
        erro: "Não foi possível localizar a inscrição vinculada ao pagamento."
      });
    }

    if (!registration?.id) {
      console.warn(
        "Webhook chegou antes do vínculo da inscrição ou pagamento não localizado:",
        paymentIdText
      );

      return res.status(500).json({
        recebido: false,
        aviso: "Pagamento recebido, mas a inscrição ainda não foi localizada."
      });
    }

    const {
      data: raceEvent,
      error: raceEventError
    } = await supabaseAdmin
      .from("race_events")
      .select("id, organizer_id")
      .eq("id", registration.race_event_id)
      .maybeSingle();

    if (raceEventError || !raceEvent?.organizer_id) {
      console.error(
        "Erro ao localizar organizador do evento:",
        raceEventError
      );

      return res.status(500).json({
        erro: "Não foi possível localizar o organizador do evento."
      });
    }

    const {
      data: organizerMpAccount,
      error: organizerMpError
    } = await supabaseAdmin
      .from("organizer_mercadopago_accounts")
      .select("organizer_id, access_token, status")
      .eq("organizer_id", raceEvent.organizer_id)
      .maybeSingle();

    if (
      organizerMpError ||
      !organizerMpAccount?.access_token ||
      organizerMpAccount.status !== "connected"
    ) {
      console.error(
        "Conta Mercado Pago do organizador não localizada:",
        organizerMpError
      );

      return res.status(500).json({
        erro: "Não foi possível localizar a conta Mercado Pago do organizador."
      });
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentIdText)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${organizerMpAccount.access_token}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (paymentResponse.status === 404) {
      return res.status(200).json({
        recebido: true,
        aviso: "Pagamento não encontrado no Mercado Pago."
      });
    }

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        "Erro ao consultar pagamento no Mercado Pago:",
        paymentData
      );

      return res.status(500).json({
        erro: "Não foi possível consultar o pagamento no Mercado Pago.",
        detalhes: paymentData
      });
    }

    const paymentStatus = paymentData?.status || null;
    const paymentStatusDetail = paymentData?.status_detail || null;

    const isApproved =
      paymentStatus === "approved" &&
      paymentStatusDetail === "accredited";

    const updateData = {
      payment_status: paymentStatus,
      payment_status_detail: paymentStatusDetail,
      payment_transaction_id: String(paymentData.id || paymentIdText),
      updated_at: new Date().toISOString()
    };

    if (isApproved) {
      updateData.status = "confirmed";
      updateData.confirmed_at = new Date().toISOString();
    }

    const { error: updateRegistrationError } = await supabaseAdmin
      .from("race_registrations")
      .update(updateData)
      .eq("id", registration.id);

    if (updateRegistrationError) {
      console.error(
        "Erro ao atualizar inscrição após webhook:",
        updateRegistrationError
      );

      return res.status(500).json({
        erro: "Não foi possível atualizar a inscrição após o pagamento."
      });
    }

    return res.status(200).json({
      recebido: true,
      payment_id: paymentIdText,
      inscricao_id: registration.id,
      payment_status: paymentStatus,
      payment_status_detail: paymentStatusDetail,
      inscricao_confirmada: isApproved
    });
  } catch (erro) {
    console.error("Erro no webhook Mercado Pago:", erro);

    return res.status(500).json({
      erro: "Falha ao processar webhook do Mercado Pago.",
      detalhes: erro.message
    });
  }
}
