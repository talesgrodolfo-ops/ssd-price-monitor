#!/usr/bin/env python3
"""Monitor de preços de SSD com alertas no Telegram."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import yaml
from dotenv import load_dotenv

from fetchers import Offer, collect_offers
from notifiers import notify
from state_logic import decide_alert, next_state

ROOT = Path(__file__).resolve().parent
STATE_FILE = ROOT / "state.json"


def load_config(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {}
    with STATE_FILE.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_state(state: dict) -> None:
    with STATE_FILE.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, ensure_ascii=False)


def format_money(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_message(
    product_name: str,
    model: str,
    max_price: float,
    offer: Offer,
    previous_min: float | None,
) -> str:
    previous = "primeira leitura" if previous_min is None else format_money(previous_min)
    return (
        f"Oferta de SSD encontrada!\n\n"
        f"Produto: {product_name}\n"
        f"Modelo: {model}\n"
        f"Loja: {offer.store}\n"
        f"Preco agora: {format_money(offer.price)}\n"
        f"Seu alvo: ate {format_money(max_price)}\n"
        f"Menor preco anterior: {previous}\n\n"
        f"{offer.title}\n"
        f"{offer.url}"
    )


def run(config_path: Path, dry_run: bool = False) -> int:
    load_dotenv(ROOT / ".env")
    config = load_config(config_path)
    state = load_state()
    telegram_enabled = bool(config.get("telegram", {}).get("enabled", True))

    alerts_sent = 0
    print(f"Verificacao iniciada em {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")

    for product in config.get("products", []):
        name = product["name"]
        model = product.get("model", "")
        max_price = float(product["max_price"])
        product_key = model or name

        print(f"\n> {name} (alvo: ate {format_money(max_price)})")
        offers = collect_offers(product)
        if not offers:
            print("  Nenhuma oferta encontrada.")
            continue

        best = offers[0]
        stored = state.get(product_key)
        decision = decide_alert(best.price, max_price, stored)
        print(
            f"  Melhor: {best.store} - {format_money(best.price)} - "
            f"{best.title[:70]} ({decision.reason})"
        )

        updated = next_state(best.price, stored, decision.should_alert)
        state[product_key] = updated

        if not decision.should_alert:
            continue

        message = build_message(name, model, max_price, best, decision.previous_min)
        if dry_run:
            print("  [dry-run] Alerta que seria enviado:")
            print(message)
        else:
            notify(f"Oferta SSD: {name}", message, telegram_enabled=telegram_enabled)
            alerts_sent += 1

    if not dry_run:
        save_state(state)

    print(f"\nConcluido. Alertas enviados: {alerts_sent}")
    return alerts_sent


def main() -> None:
    parser = argparse.ArgumentParser(description="Monitor de preços de SSD")
    parser.add_argument(
        "--config",
        type=Path,
        default=ROOT / "config.yaml",
        help="Arquivo de configuração YAML",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Só mostra no terminal, sem enviar mensagem",
    )
    parser.add_argument(
        "--test-alert",
        action="store_true",
        help="Envia mensagem de teste no Telegram/e-mail",
    )
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    if args.test_alert:
        notify(
            "Teste SSD Price Monitor",
            "Monitor de SSD configurado com sucesso!\nVoce recebera alertas apenas em novos minimos de preco.",
            telegram_enabled=True,
        )
        return

    run(args.config, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
