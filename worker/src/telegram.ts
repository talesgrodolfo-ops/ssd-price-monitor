export async function sendTelegram(
  token: string,
  chatId: string,
  message: string,
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_web_page_preview: false,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram HTTP ${response.status}: ${body}`);
  }
}

export function formatMoney(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function buildAlertMessage(input: {
  productName: string;
  model: string;
  maxPrice: number;
  offerTitle: string;
  offerStore: string;
  offerPrice: number;
  offerUrl: string;
  previousMin: number | null;
}): string {
  const previous =
    input.previousMin === null
      ? "primeira leitura"
      : formatMoney(input.previousMin);

  return [
    "Oferta de SSD encontrada!",
    "",
    `Produto: ${input.productName}`,
    `Modelo: ${input.model}`,
    `Loja: ${input.offerStore}`,
    `Preco agora: ${formatMoney(input.offerPrice)}`,
    `Seu alvo: ate ${formatMoney(input.maxPrice)}`,
    `Menor preco anterior: ${previous}`,
    "",
    input.offerTitle,
    input.offerUrl,
  ].join("\n");
}
