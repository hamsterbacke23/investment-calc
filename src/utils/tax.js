// German ETF taxation helpers (equity ETFs).
// 30% Teilfreistellung, 25% Abgeltungssteuer + 5.5% Soli ≈ 26.375% effective rate.
// 1.000 € Sparerpauschbetrag (single).

export const TEILFREISTELLUNG = 0.30;
export const FREIBETRAG = 1000;
export const TAX_RATE = 0.26375;

export function calculateTax(finalBalance, totalInvested) {
  const gains = Math.max(0, finalBalance - totalInvested);
  const taxableGains = gains * (1 - TEILFREISTELLUNG);
  const taxableAfterFreibetrag = Math.max(0, taxableGains - FREIBETRAG);
  const tax = Math.round(taxableAfterFreibetrag * TAX_RATE);
  return {
    gains,
    tax,
    afterTax: finalBalance - tax,
    effectiveRate: gains > 0 ? (tax / gains * 100).toFixed(1) : '0.0',
  };
}

export function inflationAdjusted(value, annualRatePct, years) {
  const factor = Math.pow(1 + annualRatePct / 100, years);
  return Math.round(value / factor);
}
