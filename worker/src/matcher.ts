import type { ProductConfig } from "./config";

export interface MatchResult {
  matched: boolean;
  reason: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[/\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CAPACITY_BLOCKLIST_1TB = [
  "2tb",
  "2 tb",
  "2000g",
  "2000 g",
  "4tb",
  "4 tb",
  "500gb",
  "500 gb",
  "480gb",
  "480 gb",
  "250gb",
  "250 gb",
  "512gb",
  "512 gb",
];

function hasTargetCapacity(text: string): boolean {
  const normalized = normalize(text);
  return (
    /\b1\s*tb\b/.test(normalized) ||
    /\b1000\s*g\b/.test(normalized) ||
    normalized.includes("1tb") ||
    normalized.includes("1000gb")
  );
}

function hasBlockedCapacity(text: string): boolean {
  const normalized = normalize(text);
  return CAPACITY_BLOCKLIST_1TB.some((blocked) => normalized.includes(blocked));
}

function modelInText(text: string, model: string): boolean {
  return normalize(text).includes(normalize(model));
}

/**
 * Verifica se o campo Nome/titulo do anuncio corresponde ao SSD esperado.
 */
export function verifyProductName(
  product: ProductConfig,
  name: string,
  description = "",
): MatchResult {
  const combined = `${name} ${description}`;
  const normalized = normalize(combined);

  for (const excluded of product.excludeKeywords ?? []) {
    if (normalized.includes(normalize(excluded))) {
      return { matched: false, reason: `excluido: contem "${excluded}"` };
    }
  }

  if (hasBlockedCapacity(combined)) {
    return { matched: false, reason: "capacidade diferente de 1TB" };
  }

  if (!hasTargetCapacity(combined)) {
    return { matched: false, reason: "capacidade 1TB nao encontrada no nome" };
  }

  if (modelInText(combined, product.model)) {
    return { matched: true, reason: `modelo ${product.model} confirmado` };
  }

  const missing = product.keywords.filter(
    (keyword) => !normalized.includes(normalize(keyword)),
  );
  if (missing.length > 0) {
    return {
      matched: false,
      reason: `nome nao confere (falta: ${missing.join(", ")})`,
    };
  }

  const searchTokens = normalize(product.searchQuery)
    .split(" ")
    .filter((token) => token.length > 2);
  const importantTokens = searchTokens.filter(
    (token) => !["ssd", "nvme", "1tb", "tb"].includes(token),
  );
  const missingSearch = importantTokens.filter(
    (token) => !normalized.includes(token),
  );
  if (missingSearch.length > 0) {
    return {
      matched: false,
      reason: `nome nao confere com busca (falta: ${missingSearch.join(", ")})`,
    };
  }

  return { matched: true, reason: "nome confirmado pelos termos da busca" };
}
