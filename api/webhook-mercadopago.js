export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido. Use POST."
    });
  }

  try {
    console.log("Webhook Mercado Pago recebido:");
    console.log(JSON.stringify(req.body, null, 2));

    return res.status(200).json({
      recebido: true
    });
  } catch (erro) {
    console.error("Erro no webhook Mercado Pago:", erro);

    return res.status(500).json({
      erro: "Falha ao receber webhook."
    });
  }
}
