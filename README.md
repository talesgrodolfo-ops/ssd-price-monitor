# SSD Price Monitor

Monitora preços de SSD na **KaBuM** e envia alerta no **Telegram** quando encontrar um **novo mínimo histórico** dentro do preço alvo.

**Regra importante:** se o preço subir em relação ao menor valor já visto, **não envia nada**.

## Deploy na Cloudflare (recomendado)

Roda automaticamente a cada **2 horas** via Cron Trigger.

```powershell
cd worker
npm install
npx wrangler kv namespace create STATE_KV
```

Copie o `id` retornado para `worker/wrangler.jsonc` em `kv_namespaces`.

Configure os secrets (nunca commite o token):

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

Deploy:

```powershell
npm run deploy
```

Testes:

- `https://<seu-worker>.workers.dev/health` — status
- `https://<seu-worker>.workers.dev/run` — executa verificação manual
- `https://<seu-worker>.workers.dev/test` — mensagem de teste no Telegram

## Uso local (Python)

```powershell
python -m pip install -r requirements.txt
copy .env.example .env
python monitor.py --dry-run
python monitor.py --test-alert
python monitor.py
```

## SSDs monitorados

| Produto | Alvo |
|---|---|
| WD Green SN350 1TB | R$ 850 |
| Kingston NV3 1TB | R$ 900 |
| Crucial P3 1TB | R$ 420 |
| WD Blue SN570 1TB | R$ 450 |

Edite `worker/src/config.ts` (Cloudflare) ou `config.yaml` (Python).

## Segurança

- **Nunca** coloque o token do Telegram no código ou no GitHub.
- Use `wrangler secret` na Cloudflare e `.env` local (gitignored).
- Se o token vazar, gere um novo em **@BotFather**.
