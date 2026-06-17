import { PRODUCTS } from "./config";
import { crawlProduct } from "./crawler";
import {
  buildPriceReportMessage,
  fetchPriceQuotes,
} from "./quotes";
import {
  buildAlertMessage,
  formatMoney,
  sendTelegram,
} from "./telegram";
import {
  decideAlert,
  nextState,
  type ProductState,
} from "./state";
import type { Env } from "./env";

async function loadProductState(
  kv: KVNamespace,
  model: string,
): Promise<ProductState | null> {
  const raw = await kv.get(`product:${model}`);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as ProductState;
}

async function saveProductState(
  kv: KVNamespace,
  model: string,
  state: ProductState,
): Promise<void> {
  await kv.put(`product:${model}`, JSON.stringify(state));
}

export async function runMonitor(env: Env): Promise<{
  alertsSent: number;
  results: string[];
}> {
  const productResults: Array<{ line: string; alerted: boolean }> = [];
  for (const product of PRODUCTS) {
    const stateKey = product.model;
    try {
        const crawl = await crawlProduct(product);
        if (!crawl.bestOffer) {
          productResults.push({
            line: `${product.name}: 0/${crawl.scannedCount} confirmados pelo nome`,
            alerted: false,
          });
          continue;
        }

        const best = crawl.bestOffer;
        const stored = await loadProductState(env.STATE_KV, stateKey);
        const decision = decideAlert(best.price, product.maxPrice, stored);
        const updated = nextState(best.price, stored, decision.shouldAlert);
        await saveProductState(env.STATE_KV, stateKey, updated);

        if (!decision.shouldAlert) {
          productResults.push({
            line: `${product.name}: ${formatMoney(best.price)} (${crawl.matchedCount}/${crawl.scannedCount} ok, ${decision.reason})`,
            alerted: false,
          });
          continue;
        }

        const message = buildAlertMessage({
          productName: product.name,
          model: product.model,
          maxPrice: product.maxPrice,
          offerTitle: best.title,
          offerStore: best.store,
          offerPrice: best.price,
          offerUrl: best.url,
          previousMin: decision.previousMin,
        });

        await sendTelegram(
          env.TELEGRAM_BOT_TOKEN,
          env.TELEGRAM_CHAT_ID,
          message,
        );

      productResults.push({
        line: `${product.name}: ${formatMoney(best.price)} alerta (${crawl.matchedCount}/${crawl.scannedCount} confirmados)`,
        alerted: true,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      productResults.push({
        line: `${product.name}: erro (${reason})`,
        alerted: false,
      });
    }
  }

  const lines = productResults.map((item) => item.line);
  const alertsSent = productResults.filter((item) => item.alerted).length;

  return { alertsSent, results: lines };
}

export async function sendPriceReport(env: Env, chatId: string): Promise<void> {
  const quotes = await fetchPriceQuotes((model) =>
    loadProductState(env.STATE_KV, model),
  );
  await sendTelegram(
    env.TELEGRAM_BOT_TOKEN,
    chatId,
    buildPriceReportMessage(quotes),
  );
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

export async function handleTelegramWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  if (!message?.chat?.id) {
    return new Response("ok");
  }

  const chatId = String(message.chat.id);
  if (chatId !== env.TELEGRAM_CHAT_ID) {
    return new Response("ok");
  }

  const text = (message.text ?? "").trim().toLowerCase();
  if (text === "/start") {
    await sendTelegram(
      env.TELEGRAM_BOT_TOKEN,
      chatId,
      "Ola! Envie qualquer mensagem ou /precos para ver os SSDs mais baratos agora.",
    );
    return new Response("ok");
  }

  await sendPriceReport(env, chatId);
  return new Response("ok");
}

export async function registerTelegramWebhook(workerUrl: string, token: string): Promise<string> {
  const webhookUrl = `${workerUrl.replace(/\/$/, "")}/telegram-webhook`;
  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
      }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`setWebhook failed: ${body}`);
  }
  return body;
}
