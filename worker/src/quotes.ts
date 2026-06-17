import { PRODUCTS, type ProductConfig } from "./config";
import { collectOffers, type Offer } from "./fetchers";
import { formatMoney } from "./telegram";
import type { ProductState } from "./state";

export interface PriceQuote {
  product: ProductConfig;
  offer: Offer | null;
  minPriceSeen: number | null;
  error?: string;
}

export async function fetchPriceQuotes(
  loadState: (model: string) => Promise<ProductState | null>,
): Promise<PriceQuote[]> {
  return Promise.all(
    PRODUCTS.map(async (product) => {
      const stateKey = `product:${product.model}`;
      const stored = await loadState(product.model);
      try {
        const offers = await collectOffers(product);
        return {
          product,
          offer: offers[0] ?? null,
          minPriceSeen: stored?.minPriceSeen ?? null,
        };
      } catch (error) {
        return {
          product,
          offer: null,
          minPriceSeen: stored?.minPriceSeen ?? null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

export function buildPriceReportMessage(quotes: PriceQuote[]): string {
  const lines = [
    "Precos SSD mais baratos agora (KaBuM)",
    "",
  ];

  quotes.forEach((quote, index) => {
    const { product, offer, minPriceSeen, error } = quote;
    lines.push(`${index + 1}. ${product.name}`);
    lines.push(`   Modelo: ${product.model}`);
    lines.push(`   Alvo: ate ${formatMoney(product.maxPrice)}`);

    if (error) {
      lines.push(`   Erro: ${error}`);
    } else if (!offer) {
      lines.push("   Nenhuma oferta encontrada");
    } else {
      const withinTarget = offer.price <= product.maxPrice ? " dentro do alvo" : "";
      lines.push(`   ${formatMoney(offer.price)}${withinTarget}`);
      lines.push(`   ${offer.title}`);
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
