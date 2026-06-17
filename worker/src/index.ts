import { PRODUCTS } from "./config";
import { collectOffers } from "./fetchers";
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

export interface Env {
  STATE_KV: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

async function loadProductState(
  kv: KVNamespace,
  key: string,
): Promise<ProductState | null> {
  const raw = await kv.get(key);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as ProductState;
}

async function saveProductState(
  kv: KVNamespace,
  key: string,
  state: ProductState,
): Promise<void> {
  await kv.put(key, JSON.stringify(state));
}

export async function runMonitor(env: Env): Promise<{
  alertsSent: number;
  results: string[];
}> {
  const results: string[] = [];
  let alertsSent = 0;

  for (const product of PRODUCTS) {
    const stateKey = `product:${product.model}`;
    const offers = await collectOffers(product);

    if (!offers.length) {
      results.push(`${product.name}: nenhuma oferta encontrada`);
      continue;
    }

    const best = offers[0];
    const stored = await loadProductState(env.STATE_KV, stateKey);
    const decision = decideAlert(best.price, product.maxPrice, stored);

    results.push(
      `${product.name}: ${formatMoney(best.price)} (${decision.reason})`,
    );

    const updated = nextState(best.price, stored, decision.shouldAlert);
    await saveProductState(env.STATE_KV, stateKey, updated);

    if (!decision.shouldAlert) {
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
    alertsSent += 1;
  }

  return { alertsSent, results };
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const summary = await runMonitor(env);
    console.log(JSON.stringify(summary));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    if (url.pathname === "/run") {
      const summary = await runMonitor(env);
      return Response.json(summary);
    }

    if (url.pathname === "/test") {
      await sendTelegram(
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_CHAT_ID,
        "SSD Price Monitor na Cloudflare configurado com sucesso.",
      );
      return Response.json({ ok: true });
    }

    return new Response("SSD Price Monitor", { status: 200 });
  },
};
