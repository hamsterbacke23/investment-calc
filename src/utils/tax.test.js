import { describe, it, expect } from 'vitest';
import {
  einkommensteuer,
  taxOnGain,
  besteuerungsanteil,
  kvpvRate,
  vorabpauschale,
  TEILFREISTELLUNG,
  TAX_RATE,
  FREIBETRAG,
} from './tax.js';

describe('einkommensteuer (§32a 2026 Grundtarif)', () => {
  it('is zero up to and at the Grundfreibetrag (12.348 €)', () => {
    expect(einkommensteuer(0)).toBe(0);
    expect(einkommensteuer(12348)).toBe(0);
    // Just above the allowance the polynomial still floors to 0; tax is clearly
    // positive a bit higher up.
    expect(einkommensteuer(13000)).toBeGreaterThan(0);
  });

  it('matches the official 2026 Grundtabelle spot checks', () => {
    // Reference values verified against the published 2026 tariff.
    expect(einkommensteuer(30000)).toBe(4217);
    expect(einkommensteuer(50000)).toBe(10548);
    expect(einkommensteuer(100000)).toBe(30864);
  });

  it('is monotonically non-decreasing', () => {
    let prev = -1;
    for (let z = 0; z <= 300000; z += 2500) {
      const t = einkommensteuer(z);
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  it('is continuous across the zone boundaries (no jumps > 1 €)', () => {
    for (const b of [12348, 17799, 69878, 277826]) {
      const below = einkommensteuer(b - 1);
      const above = einkommensteuer(b + 1);
      expect(Math.abs(above - below)).toBeLessThan(2);
    }
  });

  it('applies the 45 % Reichensteuer marginal rate at the top', () => {
    const marginal = einkommensteuer(400000) - einkommensteuer(399000);
    expect(marginal / 1000).toBeCloseTo(0.45, 2);
  });
});

describe('taxOnGain (Teilfreistellung BEFORE Sparerpauschbetrag)', () => {
  it('frees 30 %, then the 1.000 € allowance, then taxes at 26,375 %', () => {
    // 2000 gain → 1400 after TF → 400 over the 1000 allowance → 105,50 €.
    expect(taxOnGain(2000)).toBeCloseTo(400 * TAX_RATE, 5);
    // NOT the wrong allowance-first order (which would give (2000-1000)*0.184625).
    expect(taxOnGain(2000)).not.toBeCloseTo((2000 - FREIBETRAG) * TAX_RATE * (1 - TEILFREISTELLUNG), 2);
  });

  it('is zero when the gain after Teilfreistellung is within the allowance', () => {
    expect(taxOnGain(1000)).toBe(0); // 700 after TF < 1000
    expect(taxOnGain(-500)).toBe(0);
  });
});

describe('besteuerungsanteil (Renten taxable share by Rentenbeginn)', () => {
  it('follows +0,5pp/year from 2023 and caps at 100 %', () => {
    expect(besteuerungsanteil(2023)).toBeCloseTo(0.825, 5);
    expect(besteuerungsanteil(2026)).toBeCloseTo(0.84, 5);
    expect(besteuerungsanteil(2058)).toBeCloseTo(1.0, 5);
    expect(besteuerungsanteil(2099)).toBeCloseTo(1.0, 5);
  });
});

describe('kvpvRate (retiree KV/PV deduction 2026)', () => {
  it('is 12,35 % with children and 12,95 % childless', () => {
    expect(kvpvRate(true)).toBeCloseTo(0.1235, 5);
    expect(kvpvRate(false)).toBeCloseTo(0.1295, 5);
  });
});

describe('vorabpauschale', () => {
  it('is Basiszins×0,7 of the start value, capped at the year gain', () => {
    // 100.000 × 3,20 % × 0,7 = 2240, gain 10000 ⇒ uncapped.
    expect(vorabpauschale(100000, 10000)).toBeCloseTo(2240, 5);
    // gain smaller than the basisertrag ⇒ capped at the gain.
    expect(vorabpauschale(100000, 1000)).toBeCloseTo(1000, 5);
  });

  it('is zero on a loss, zero gain, or zero start value', () => {
    expect(vorabpauschale(100000, -5000)).toBe(0);
    expect(vorabpauschale(100000, 0)).toBe(0);
    expect(vorabpauschale(0, 10000)).toBe(0);
  });
});
