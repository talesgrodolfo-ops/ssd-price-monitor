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
  const productResults = await Promise.all(
    PRODUCTS.map(async (product) => {
      const stateKey = `product:${product.model}`;
      try {
        const offers = await collectOffers(product);
        if (!offers.length) {
          return {
            line: `${product.name}: nenhuma oferta encontrada`,
            alerted: false,
            stateKey,
            state: null as ProductState | null,
          };
        }

        const best = offers[0];
        const stored = await loadProductState(env.STATE_KV, stateKey);
        const decision = decideAlert(best.price, product.maxPrice, stored);
        const updated = nextState(best.price, stored, decision.shouldAlert);
        await saveProductState(env.STATE_KV, stateKey, updated);

        if (!decision.shouldAlert) {
          return {
            line: `${product.name}: ${formatMoney(best.price)} (${decision.reason})`,
            alerted: false,
            stateKey,
            state: updated,
          };
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

        return {
          line: `${product.name}: ${formatMoney(best.price)} (alerta enviado)`,
          alerted: true,
          stateKey,
          state: updated,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          line: `${product.name}: erro (${reason})`,
          alerted: false,
          stateKey,
          state: null as ProductState | null,
        };
      }
    }),
  );

  const lines = productResults.map((item) => item.line);
  const alertsSent = productResults.filter((item) => item.alerted).length;

  return { alertsSent, results: lines };
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
