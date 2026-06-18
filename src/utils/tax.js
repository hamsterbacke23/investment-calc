// German ETF taxation helpers (equity ETFs).
// 25% Abgeltungsteuer + 5.5% Soli ≈ 26.375% effective rate.
// 30% Teilfreistellung für Aktien-ETF → effektiver Satz auf Gewinne ≈ 18.4625%.
// Sparerpauschbetrag: 1.000 € (fix; Paar-Toggle bewusst entfernt — Vereinfachung).
// Kirchensteuer wird hier nicht berücksichtigt (bewusst ausgelassen).
// TODO: Vorabpauschale in der Ansparphase, FIFO-Lot-Tracking
// (wir nutzen die proportionale Durchschnittsmethode), Cash-Puffer-Strategie.

export const TEILFREISTELLUNG = 0.30;
export const TAX_RATE = 0.26375;
export const EFFECTIVE_GAIN_TAX_RATE = TAX_RATE * (1 - TEILFREISTELLUNG); // 0.184625
export const FREIBETRAG = 1000;

// Tax on a realized gain over one year (after Sparerpauschbetrag).
export function taxOnGain(realizedGain) {
  const taxable = Math.max(0, realizedGain - FREIBETRAG);
  return taxable * EFFECTIVE_GAIN_TAX_RATE;
}

export function inflationAdjusted(value, annualRatePct, years) {
  const factor = Math.pow(1 + annualRatePct / 100, years);
  return Math.round(value / factor);
}

// de-DE: thousands "." and no decimals for euro amounts.
const eurFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

export function formatEUR(n) {
  if (!Number.isFinite(n)) return '–';
  return eurFormatter.format(Math.round(n)) + ' €';
}

export function formatNumber(n) {
  if (!Number.isFinite(n)) return '–';
  return eurFormatter.format(Math.round(n));
}

// Compact de-DE euro label for chart axes: "97 k €", "1,4 Mio €".
const compactFormatter = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
export function formatCompactEUR(n) {
  if (!Number.isFinite(n)) return '–';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return compactFormatter.format(n / 1_000_000) + ' Mio €';
  if (abs >= 1_000) return compactFormatter.format(Math.round(n / 1_000)) + ' k €';
  return eurFormatter.format(Math.round(n)) + ' €';
}
