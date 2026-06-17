"""Busca de preços em lojas brasileiras."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

import requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9",
}

KABUM_HEADERS = {
    **HEADERS,
    "Origin": "https://www.kabum.com.br",
    "Referer": "https://www.kabum.com.br/",
}

KABUM_API = "https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products"
ML_API = "https://api.mercadolibre.com/sites/MLB/search"


@dataclass
class Offer:
    store: str
    title: str
    price: float
    url: str
    available: bool = True


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[/\-_]", " ", text)
    return re.sub(r"\s+", " ", text)


def _matches_keywords(
    title: str,
    keywords: Iterable[str],
    exclude_keywords: Iterable[str] | None = None,
) -> bool:
    normalized = _normalize(title)
    if exclude_keywords:
        for excluded in exclude_keywords:
            if _normalize(excluded) in normalized:
                return False
    return all(_normalize(keyword) in normalized for keyword in keywords)


def _best_kabum_price(attributes: dict) -> float | None:
    discount = attributes.get("price_with_discount")
    if isinstance(discount, (int, float)) and discount > 0:
        return float(discount)
    price = attributes.get("price")
    if isinstance(price, (int, float)) and price > 0:
        return float(price)
    marketplace = attributes.get("marketplace") or {}
    mp_price = marketplace.get("price")
    if isinstance(mp_price, (int, float)) and mp_price > 0:
        return float(mp_price)
    return None


def search_kabum(
    query: str,
    keywords: list[str],
    exclude_keywords: list[str] | None = None,
    limit: int = 10,
) -> list[Offer]:
    response = requests.get(
        KABUM_API,
        params={"query": query, "page_size": limit},
        headers=KABUM_HEADERS,
        timeout=25,
    )
    response.raise_for_status()
    offers: list[Offer] = []
    for item in response.json().get("data", []):
        attributes = item.get("attributes") or {}
        title = attributes.get("title") or ""
        if keywords and not _matches_keywords(title, keywords, exclude_keywords):
            continue
        price = _best_kabum_price(attributes)
        if price is None:
            continue
        product_id = item.get("id")
        url = f"https://www.kabum.com.br/produto/{product_id}" if product_id else "https://www.kabum.com.br/"
        offers.append(
            Offer(
                store="KaBuM",
                title=title,
                price=price,
                url=url,
                available=bool(attributes.get("available", True)),
            )
        )
    offers.sort(key=lambda offer: offer.price)
    return offers


def search_mercadolivre(
    query: str,
    keywords: list[str],
    exclude_keywords: list[str] | None = None,
    limit: int = 10,
) -> list[Offer]:
    response = requests.get(
        ML_API,
        params={"q": query, "limit": limit},
        headers=HEADERS,
        timeout=25,
    )
    if response.status_code == 403:
        return []
    response.raise_for_status()
    offers: list[Offer] = []
    for item in response.json().get("results", []):
        title = item.get("title") or ""
        if keywords and not _matches_keywords(title, keywords, exclude_keywords):
            continue
        price = item.get("price")
        if not isinstance(price, (int, float)):
            continue
        offers.append(
            Offer(
                store="Mercado Livre",
                title=title,
                price=float(price),
                url=item.get("permalink") or "",
                available=item.get("available_quantity", 0) > 0,
            )
        )
    offers.sort(key=lambda offer: offer.price)
    return offers


def search_amazon(asin: str) -> Offer | None:
    if not asin:
        return None
    response = requests.get(
        f"https://www.amazon.com.br/dp/{asin}",
        headers=HEADERS,
        timeout=25,
    )
    if not response.ok:
        return None

    title_match = re.search(r"<span id=\"productTitle\"[^>]*>([^<]+)", response.text)
    title = title_match.group(1).strip() if title_match else f"Amazon ASIN {asin}"

    price = None
    for pattern in (
        r"\"priceAmount\":\s*([0-9.]+)",
        r"class=\"a-price-whole\">([0-9.]+)",
    ):
        match = re.search(pattern, response.text)
        if match:
            price = float(match.group(1).replace(".", "").replace(",", "."))
            break

    if price is None:
        return None

    return Offer(
        store="Amazon",
        title=title,
        price=price,
        url=f"https://www.amazon.com.br/dp/{asin}",
    )


def collect_offers(product: dict) -> list[Offer]:
    keywords = product.get("keywords") or []
    exclude_keywords = product.get("exclude_keywords") or []
    offers: list[Offer] = []

    kabum_query = product.get("kabum_search") or product.get("model") or product["name"]
    try:
        offers.extend(search_kabum(kabum_query, keywords, exclude_keywords))
    except requests.RequestException as error:
        print(f"[KaBuM] {product['name']}: {error}")

    ml_query = product.get("mercadolivre_search") or kabum_query
    try:
        offers.extend(search_mercadolivre(ml_query, keywords, exclude_keywords))
    except requests.RequestException as error:
        print(f"[Mercado Livre] {product['name']}: {error}")

    try:
        amazon_offer = search_amazon(product.get("amazon_asin", ""))
        if amazon_offer:
            offers.append(amazon_offer)
    except requests.RequestException as error:
        print(f"[Amazon] {product['name']}: {error}")

    offers.sort(key=lambda offer: offer.price)
    return offers
