// German ETF taxation helpers (equity ETFs).
// 25% Abgeltungsteuer + 5.5% Soli ≈ 26.375% effective rate (TAX_RATE).
// 30% Teilfreistellung für Aktien-ETF.
// Sparerpauschbetrag: 1.000 € (single; Paar-Toggle bewusst entfernt).
// Kirchensteuer wird nicht berücksichtigt (bewusst ausgelassen).
// Verbleibende bewusste Vereinfachungen: proportionale Durchschnittsmethode
// statt FIFO-Lot-Tracking; keine Günstigerprüfung. Vorabpauschale, KV/PV der
// Rentner und die Renten-Einkommensteuer (§32a/§22 EStG) werden jetzt modelliert
// — die Konstanten unten sind aus primären Quellen verifiziert (Stand 2026).

export const TEILFREISTELLUNG = 0.30;
export const TAX_RATE = 0.26375;
export const EFFECTIVE_GAIN_TAX_RATE = TAX_RATE * (1 - TEILFREISTELLUNG); // 0.184625
export const FREIBETRAG = 1000;

// Tax on a year's realized equity-fund gain, Sparerpauschbetrag applied AFTER
// Teilfreistellung (the legally correct order: the teilfreigestellte 30% are not
// part of the Kapitalerträge, so the 1.000 € allowance bites on the 70%).
export function taxOnGain(realizedGain) {
  const afterTeilfreistellung = Math.max(0, realizedGain) * (1 - TEILFREISTELLUNG);
  const taxable = Math.max(0, afterTeilfreistellung - FREIBETRAG);
  return taxable * TAX_RATE;
}

// ===========================================================================
// Verified German tax / social-insurance constants — Stand 2026.
// Sources: gesetze-im-internet.de (§32a, §22, §9a EStG; InvStG 2018 §§18-20),
// BMF Basiszins-Schreiben 2025/2026, DRV (Besteuerungsanteil, KVdR), GKV-SV.
// ===========================================================================

// --- §32a EStG income-tax tariff (Grundtarif, single) ---------------------
// x = zvE floored to full euro; result floored to full euro (§32a Abs. 1).
const TARIFF_2026 = {
  grundfreibetrag: 12348, // tax = 0 up to here
  zone2Upper: 17799,
  zone3Upper: 69878,
  rate45Threshold: 277826, // Reichensteuer (not inflation-indexed)
  z2a: 914.51, z2b: 1400, // zone 2: (z2a*y + z2b)*y,  y = (x - grundfreibetrag)/10000
  z3a: 173.10, z3b: 2397, z3c: 1034.87, // zone 3: (z3a*z + z3b)*z + z3c, z = (x - zone2Upper)/10000
  z4c: 11135.63, // zone 4: 0.42*x - z4c
  z5c: 19470.38, // zone 5: 0.45*x - z5c
};

// Progressive income tax on a taxable income (zu versteuerndes Einkommen).
export function einkommensteuer(zvE) {
  const t = TARIFF_2026;
  const x = Math.floor(Math.max(0, zvE));
  let tax;
  if (x <= t.grundfreibetrag) {
    tax = 0;
  } else if (x <= t.zone2Upper) {
    const y = (x - t.grundfreibetrag) / 10000;
    tax = (t.z2a * y + t.z2b) * y;
  } else if (x <= t.zone3Upper) {
    const z = (x - t.zone2Upper) / 10000;
    tax = (t.z3a * z + t.z3b) * z + t.z3c;
  } else if (x < t.rate45Threshold) {
    tax = 0.42 * x - t.z4c;
  } else {
    tax = 0.45 * x - t.z5c;
  }
  return Math.floor(tax);
}

// --- §22 EStG: taxable share of the statutory pension by Rentenbeginn year --
// +0.5 pp per cohort-year since 2023 (Wachstumschancengesetz); 100% at 2058.
export function besteuerungsanteil(rentenbeginnYear) {
  return Math.min(100, Math.max(0, 82.5 + 0.5 * (rentenbeginnYear - 2023))) / 100;
}
// Werbungskosten-Pauschbetrag für Renten (§9a S.1 Nr.3 EStG).
export const WK_PAUSCHBETRAG_RENTE = 102;

// --- KV/PV der Rentner: retiree's own deduction from the gross pension ------
// 2026: KV 7,3% + halber Zusatzbeitrag 1,45% + volle Pflege (DRV zahlt 0).
export function kvpvRate(hasChildren) {
  return hasChildren ? 0.1235 : 0.1295; // mit Kindern / kinderlos (2026)
}

// --- Vorabpauschale (InvStG 2018) ------------------------------------------
// Basiszins zum 2. Januar (BMF). Default = 2026; konstant über den Plan
// fortgeschrieben (zukünftige Werte sind unbekannt → bewusste Annahme).
export const VORAB_BASISZINS = 0.032; // 3,20 % (BMF 13.01.2026)
export const VORAB_FACTOR = 0.7; // §18 Abs.1 S.2: 70 % des Basiszinses

// Vorabpauschale (brutto, vor Teilfreistellung) für ein Jahr.
// valueStart = Depotwert am Jahresanfang, valueGain = Wertzuwachs im Jahr.
// Thesaurierend → keine Ausschüttungen. Gedeckelt auf den Wertzuwachs, ≥ 0.
export function vorabpauschale(valueStart, valueGain) {
  if (VORAB_BASISZINS <= 0 || valueStart <= 0) return 0;
  const basisertrag = valueStart * VORAB_BASISZINS * VORAB_FACTOR;
  return Math.max(0, Math.min(basisertrag, Math.max(0, valueGain)));
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
