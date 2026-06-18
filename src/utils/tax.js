// German ETF taxation helpers (equity ETFs).
// 25% Abgeltungsteuer + 5.5% Soli ≈ 26.375% effective rate.
// 30% Teilfreistellung für Aktien-ETF → effektiver Satz auf Gewinne ≈ 18.4625%.
// Sparerpauschbetrag: 1.000 € (Einzel) / 2.000 € (Paar).
// Kirchensteuer wird hier nicht berücksichtigt (bewusst ausgelassen).
// TODO: Vorabpauschale in der Ansparphase, FIFO-Lot-Tracking
// (wir nutzen die proportionale Durchschnittsmethode), Cash-Puffer-Strategie.

export const TEILFREISTELLUNG = 0.30;
export const TAX_RATE = 0.26375;
export const EFFECTIVE_GAIN_TAX_RATE = TAX_RATE * (1 - TEILFREISTELLUNG); // 0.184625
export const FREIBETRAG_SINGLE = 1000;
export const FREIBETRAG_COUPLE = 2000;

export function freibetragFor(isCouple) {
  return isCouple ? FREIBETRAG_COUPLE : FREIBETRAG_SINGLE;
}

// Tax on a realized gain over one year (after Sparerpauschbetrag).
export function taxOnGain(realizedGain, isCouple) {
  const taxable = Math.max(0, realizedGain - freibetragFor(isCouple));
  return taxable * EFFECTIVE_GAIN_TAX_RATE;
}

export function inflationAdjusted(value, annualRatePct, years) {
  const factor = Math.pow(1 + annualRatePct / 100, years);
  return Math.round(value / factor);
}
