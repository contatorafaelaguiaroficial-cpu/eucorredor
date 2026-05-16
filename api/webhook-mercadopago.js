import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://atzbgyjenhfgrnwdstnl.supabase.co";

export default async function handler(req, res) {
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

    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const orderId = payload?.data?.id || null;

    console.log("Webhook Mercado Pago recebido:", JSON.stringify(payload, null, 2));

    if (!orderId) {
      return res.status(200).json({
        recebido: true,
        aviso: "Notificação recebida sem orderId."
      });
    }

    const orderResponse = await fetch(
      `https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (orderResponse.status === 404) {
      return res.status(200).json({
        recebido: true,
        aviso: "Order não encontrada no Mercado Pago."
      });
    }

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error("Erro ao consultar Order no Mercado Pago:", orderData);

      return res.status(500).json({
        erro: "Não foi possível consultar a Order no Mercado Pago.",
        detalhes: orderData
      });
    }

    const payment = orderData?.transactions?.payments?.[0] || null;

    const supabaseAdmin = createClient(SUPABASE_URL, supabaseSecretKey);

    const { data: registration, error: findRegistrationError } = await supabaseAdmin
      .from("race_registrations")
      .select("id, status, payment_order_id")
      .eq("payment_order_id", orderId)
      .maybeSingle();

    if (findRegistrationError) {
      console.error("Erro ao localizar inscrição pelo pagamento:", findRegistrationError);

      return res.status(500).json({
        erro: "Não foi possível localizar a inscrição vinculada ao pagamento."
      });
    }

    if (!registration?.id) {
      return res.status(200).json({
        recebido: true,
        aviso: "Pagamento recebido, mas nenhuma inscrição foi encontrada para esta Order."
      });
    }

    const paymentStatus = orderData?.status || payment?.status || null;
    const paymentStatusDetail = orderData?.status_detail || payment?.status_detail || null;

    const updateData = {
      payment_status: paymentStatus,
      payment_status_detail: paymentStatusDetail,
      payment_transaction_id: payment?.id || null,
      updated_at: new Date().toISOString()
    };

    if (paymentStatus === "processed" && paymentStatusDetail === "accredited") {
      updateData.status = "confirmed";
      updateData.confirmed_at = new Date().toISOString();
    }

    const { error: updateRegistrationError } = await supabaseAdmin
      .from("race_registrations")
      .update(updateData)
      .eq("id", registration.id);

    if (updateRegistrationError) {
      console.error("Erro ao atualizar inscrição após webhook:", updateRegistrationError);

      return res.status(500).json({
        erro: "Não foi possível atualizar a inscrição após o pagamento."
      });
    }

    return res.status(200).json({
      recebido: true,
      order_id: orderId,
      inscricao_id: registration.id,
      payment_status: paymentStatus,
      payment_status_detail: paymentStatusDetail,
      inscricao_confirmada:
        paymentStatus === "processed" && paymentStatusDetail === "accredited"
    });
  } catch (erro) {
    console.error("Erro no webhook Mercado Pago:", erro);

    return res.status(500).json({
      erro: "Falha ao processar webhook do Mercado Pago.",
      detalhes: erro.message
    });
  }
}
