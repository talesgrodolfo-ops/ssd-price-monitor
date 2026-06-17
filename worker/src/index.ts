import type { Env } from "./env";
import {
  handleTelegramWebhook,
  registerTelegramWebhook,
  runMonitor,
  sendPriceReport,
} from "./monitor";
import { sendTelegram } from "./telegram";

const WORKER_URL = "https://ssd-price-monitor.talesgrodolfo.workers.dev";

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

    if (url.pathname === "/precos") {
      await sendPriceReport(env, env.TELEGRAM_CHAT_ID);
      return Response.json({ ok: true });
    }

    if (url.pathname === "/test") {
      await sendTelegram(
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_CHAT_ID,
        "SSD Price Monitor na Cloudflare configurado com sucesso.",
      );
      return Response.json({ ok: true });
    }

    if (url.pathname === "/telegram-webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    if (url.pathname === "/setup-webhook" && request.method === "POST") {
      try {
        const result = await registerTelegramWebhook(
          WORKER_URL,
          env.TELEGRAM_BOT_TOKEN,
        );
        return new Response(result, { status: 200 });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return new Response(message, { status: 500 });
      }
    }

    return new Response("SSD Price Monitor", { status: 200 });
  },
};
