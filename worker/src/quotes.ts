import { PRODUCTS, type ProductConfig } from "./config";
import { crawlProduct } from "./crawler";
import type { Offer } from "./types";
import { formatMoney } from "./telegram";
import type { ProductState } from "./state";

export interface PriceQuote {
  product: ProductConfig;
  offer: Offer | null;
  minPriceSeen: number | null;
  scannedCount: number;
  matchedCount: number;
  error?: string;
}

export async function fetchPriceQuotes(
  loadState: (model: string) => Promise<ProductState | null>,
): Promise<PriceQuote[]> {
  return Promise.all(
    PRODUCTS.map(async (product) => {
      const stored = await loadState(product.model);
      try {
        const crawl = await crawlProduct(product);
        return {
          product,
          offer: crawl.bestOffer,
          minPriceSeen: stored?.minPriceSeen ?? null,
          scannedCount: crawl.scannedCount,
          matchedCount: crawl.matchedCount,
        };
      } catch (error) {
        return {
          product,
          offer: null,
          minPriceSeen: stored?.minPriceSeen ?? null,
          scannedCount: 0,
          matchedCount: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

export function buildPriceReportMessage(quotes: PriceQuote[]): string {
  const lines = [
    "Precos SSD (crawler KaBuM)",
    "Busca por nome + validacao do produto",
    "",
  ];

  quotes.forEach((quote, index) => {
    const { product, offer, minPriceSeen, scannedCount, matchedCount, error } =
      quote;
    lines.push(`${index + 1}. ${product.name}`);
    lines.push(`   Busca: "${product.searchQuery}"`);
    lines.push(`   Modelo: ${product.model}`);
    lines.push(`   Alvo: ate ${formatMoney(product.maxPrice)}`);
    lines.push(
      `   Analisadas: ${scannedCount} anuncios | Confirmadas: ${matchedCount}`,
    );

    if (error) {
      lines.push(`   Erro: ${error}`);
    } else if (!offer) {
      lines.push("   Nenhuma oferta com nome confirmado");
    } else {
      const withinTarget = offer.price <= product.maxPrice ? " dentro do alvo" : "";
      lines.push(`   Nome: ${offer.title}`);
      lines.push(`   Menor preco: ${formatMoney(offer.price)}${withinTarget}`);
      lines.push(`   ${offer.url}`);
    }

    if (minPriceSeen !== null) {
      lines.push(`   Menor ja visto: ${formatMoney(minPriceSeen)}`);
    }

    lines.push("");
  });

  lines.push("Envie qualquer mensagem ou /precos para atualizar.");
  return lines.join("\n").trim();
}
