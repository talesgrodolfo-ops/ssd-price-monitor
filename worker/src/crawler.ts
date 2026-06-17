import type { ProductConfig } from "./config";
import { verifyProductName } from "./matcher";
import type { Offer } from "./types";

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

const FETCH_TIMEOUT_MS = 20_000;
const MAX_PAGES = 5;
const PAGE_SIZE = 30;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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

interface KabumListing {
  id: number;
  title: string;
  description: string;
  price: number;
  available: boolean;
}

async function fetchKabumSearchPage(
  query: string,
  page: number,
): Promise<{ listings: KabumListing[]; total: number }> {
  const url = new URL(KABUM_API);
  url.searchParams.set("query", query);
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("page_number", String(page));

  const response = await fetchWithTimeout(url.toString(), {
    headers: KABUM_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`KaBuM HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    meta?: { total_items_count?: number };
    data?: Array<{
      id?: number;
      attributes?: Record<string, unknown>;
    }>;
  };

  const listings: KabumListing[] = [];
  for (const item of payload.data ?? []) {
    const attributes = item.attributes ?? {};
    const price = bestKabumPrice(attributes);
    const id = item.id;
    if (price === null || id === undefined) {
      continue;
    }
    listings.push({
      id,
      title: String(attributes.title ?? ""),
      description: String(attributes.description ?? ""),
      price,
      available: Boolean(attributes.available ?? true),
    });
  }

  return {
    listings,
    total: payload.meta?.total_items_count ?? listings.length,
  };
}

function searchQueriesFor(product: ProductConfig): string[] {
  const queries = [
    product.searchQuery,
    product.name,
    product.model,
    product.kabumSearch,
  ];
  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
}

export interface CrawlResult {
  bestOffer: Offer | null;
  scannedCount: number;
  matchedCount: number;
  matches: Offer[];
}

/**
 * Simula a busca na pagina de pesquisa: percorre varias paginas/termos,
 * valida o campo Nome de cada resultado e retorna o menor preco confirmado.
 */
export async function crawlProduct(product: ProductConfig): Promise<CrawlResult> {
  const seenIds = new Set<number>();
  const scanned: KabumListing[] = [];

  for (const query of searchQueriesFor(product)) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { listings, total } = await fetchKabumSearchPage(query, page);
      for (const listing of listings) {
        if (!seenIds.has(listing.id)) {
          seenIds.add(listing.id);
          scanned.push(listing);
        }
      }
      if (page * PAGE_SIZE >= total || listings.length === 0) {
        break;
      }
    }
  }

  const matches: Offer[] = [];
  for (const listing of scanned) {
    if (!listing.available) {
      continue;
    }
    const verification = verifyProductName(
      product,
      listing.title,
      listing.description,
    );
    if (!verification.matched) {
      continue;
    }
    matches.push({
      store: "KaBuM",
      title: listing.title,
      price: listing.price,
      url: `https://www.kabum.com.br/produto/${listing.id}`,
    });
  }

  matches.sort((a, b) => a.price - b.price);

  return {
    bestOffer: matches[0] ?? null,
    scannedCount: scanned.length,
    matchedCount: matches.length,
    matches,
  };
}

export async function collectOffers(product: ProductConfig): Promise<Offer[]> {
  const result = await crawlProduct(product);
  return result.matches;
}
