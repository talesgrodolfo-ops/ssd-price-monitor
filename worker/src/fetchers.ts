import type { ProductConfig } from "./config";

export interface Offer {
  store: string;
  title: string;
  price: number;
  url: string;
}

const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const KABUM_HEADERS: Record<string, string> = {
  ...HEADERS,
  Origin: "https://www.kabum.com.br",
  Referer: "https://www.kabum.com.br/",
};

const KABUM_API =
  "https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2/products";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[/\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesKeywords(
  title: string,
  keywords: string[],
  excludeKeywords: string[] = [],
): boolean {
  const normalized = normalize(title);
  for (const excluded of excludeKeywords) {
    if (normalized.includes(normalize(excluded))) {
      return false;
    }
  }
  return keywords.every((keyword) => normalized.includes(normalize(keyword)));
}

function bestKabumPrice(attributes: Record<string, unknown>): number | null {
  const discount = attributes.price_with_discount;
  if (typeof discount === "number" && discount > 0) {
    return discount;
  }
  const price = attributes.price;
  if (typeof price === "number" && price > 0) {
    return price;
  }
  const marketplace = attributes.marketplace as Record<string, unknown> | undefined;
  const mpPrice = marketplace?.price;
  if (typeof mpPrice === "number" && mpPrice > 0) {
    return mpPrice;
  }
  return null;
}

export async function searchKabum(
  query: string,
  keywords: string[],
  excludeKeywords: string[] = [],
  limit = 10,
): Promise<Offer[]> {
  const url = new URL(KABUM_API);
  url.searchParams.set("query", query);
  url.searchParams.set("page_size", String(limit));

  const response = await fetch(url.toString(), { headers: KABUM_HEADERS });
  if (!response.ok) {
    throw new Error(`KaBuM HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id?: number;
      attributes?: Record<string, unknown>;
    }>;
  };

  const offers: Offer[] = [];
  for (const item of payload.data ?? []) {
    const attributes = item.attributes ?? {};
    const title = String(attributes.title ?? "");
    if (keywords.length && !matchesKeywords(title, keywords, excludeKeywords)) {
      continue;
    }
    const price = bestKabumPrice(attributes);
    if (price === null) {
      continue;
    }
    const productId = item.id;
    offers.push({
      store: "KaBuM",
      title,
      price,
      url: productId
        ? `https://www.kabum.com.br/produto/${productId}`
        : "https://www.kabum.com.br/",
    });
  }

  return offers.sort((a, b) => a.price - b.price);
}

export async function collectOffers(product: ProductConfig): Promise<Offer[]> {
  const offers = await searchKabum(
    product.kabumSearch,
    product.keywords,
    product.excludeKeywords ?? [],
  );
  return offers.sort((a, b) => a.price - b.price);
}
