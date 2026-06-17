"""Regras de estado e alerta."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AlertDecision:
    should_alert: bool
    reason: str
    previous_min: float | None


def decide_alert(
    current_price: float,
    max_price: float,
    stored: dict[str, Any] | None,
) -> AlertDecision:
    min_seen = None if stored is None else stored.get("min_price_seen")

    if min_seen is None:
        if current_price <= max_price:
            return AlertDecision(True, "primeira leitura dentro do alvo", None)
        return AlertDecision(False, "primeira leitura acima do alvo", None)

    if current_price >= min_seen:
        return AlertDecision(
            False,
            "preco igual ou maior que o menor ja registrado",
            float(min_seen),
        )

    if current_price > max_price:
        return AlertDecision(
            False,
            "novo minimo, mas ainda acima do alvo",
            float(min_seen),
        )

    return AlertDecision(
        True,
        "novo minimo historico dentro do alvo",
        float(min_seen),
    )


def next_state(
    current_price: float,
    stored: dict[str, Any] | None,
    alerted: bool,
) -> dict[str, Any]:
    from datetime import datetime, timezone

    min_seen = current_price
    if stored is not None and stored.get("min_price_seen") is not None:
        min_seen = min(float(stored["min_price_seen"]), current_price)

    state: dict[str, Any] = {
        "min_price_seen": min_seen,
        "last_checked_at": datetime.now(timezone.utc).isoformat(),
    }

    if alerted:
        state["last_alert_price"] = current_price
        state["last_alert_at"] = datetime.now(timezone.utc).isoformat()
    elif stored:
        if stored.get("last_alert_price") is not None:
            state["last_alert_price"] = stored["last_alert_price"]
        if stored.get("last_alert_at") is not None:
            state["last_alert_at"] = stored["last_alert_at"]

    return state
