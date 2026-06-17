"""Envio de alertas por Telegram e e-mail."""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

import requests


def send_telegram(message: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print("Telegram não configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).")
        return False

    response = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={
            "chat_id": chat_id,
            "text": message,
            "disable_web_page_preview": False,
        },
        timeout=20,
    )
    response.raise_for_status()
    return True


def send_email(subject: str, body: str) -> bool:
    if os.getenv("EMAIL_ENABLED", "false").lower() not in {"1", "true", "yes"}:
        return False

    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    email_to = os.getenv("EMAIL_TO", "").strip()
    if not smtp_user or not smtp_password or not email_to:
        print("E-mail não configurado (SMTP_USER / SMTP_PASSWORD / EMAIL_TO).")
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = smtp_user
    message["To"] = email_to
    message.set_content(body)

    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=30) as server:
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(message)
    return True


def notify(subject: str, body: str, telegram_enabled: bool = True) -> None:
    if telegram_enabled:
        try:
            if send_telegram(body):
                print("Alerta enviado no Telegram.")
                return
        except requests.RequestException as error:
            print(f"Falha no Telegram: {error}")

    try:
        if send_email(subject, body):
            print("Alerta enviado por e-mail.")
            return
    except OSError as error:
        print(f"Falha no e-mail: {error}")

    print("Nenhum canal de notificação disponível. Mensagem:")
    print(body)
