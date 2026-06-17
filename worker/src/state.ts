export interface ProductState {
  minPriceSeen: number;
  lastCheckedAt: string;
  lastAlertPrice?: number;
  lastAlertAt?: string;
}

export interface AlertDecision {
  shouldAlert: boolean;
  reason: string;
  previousMin: number | null;
}

/**
 * Alerta somente quando o preco atual e um novo minimo historico
 * e esta dentro do valor alvo. Se subir em relacao ao menor ja visto, nao envia.
 */
export function decideAlert(
  currentPrice: number,
  maxPrice: number,
  stored: ProductState | null,
): AlertDecision {
  if (stored === null) {
    if (currentPrice <= maxPrice) {
      return {
        shouldAlert: true,
        reason: "primeira leitura dentro do alvo",
        previousMin: null,
      };
    }
    return {
      shouldAlert: false,
      reason: "primeira leitura acima do alvo",
      previousMin: null,
    };
  }

  if (currentPrice >= stored.minPriceSeen) {
    return {
      shouldAlert: false,
      reason: "preco igual ou maior que o menor ja registrado",
      previousMin: stored.minPriceSeen,
    };
  }

  if (currentPrice > maxPrice) {
    return {
      shouldAlert: false,
      reason: "novo minimo, mas ainda acima do alvo",
      previousMin: stored.minPriceSeen,
    };
  }

  return {
    shouldAlert: true,
    reason: "novo minimo historico dentro do alvo",
    previousMin: stored.minPriceSeen,
  };
}

export function nextState(
  currentPrice: number,
  stored: ProductState | null,
  alerted: boolean,
): ProductState {
  const minPriceSeen =
    stored === null
      ? currentPrice
      : Math.min(stored.minPriceSeen, currentPrice);

  const next: ProductState = {
    minPriceSeen,
    lastCheckedAt: new Date().toISOString(),
  };

  if (alerted) {
    next.lastAlertPrice = currentPrice;
    next.lastAlertAt = new Date().toISOString();
  } else if (stored?.lastAlertPrice !== undefined) {
    next.lastAlertPrice = stored.lastAlertPrice;
    next.lastAlertAt = stored.lastAlertAt;
  }

  return next;
}
