import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeState,
  loadFromLocal,
  initialCapital,
  durationYears,
  etfCostRate,
  withdrawalVolatility,
  targetSuccessRate,
  pensionHasChildren,
  yieldPhases,
  transactions,
} from './useInvestmentStore.js';

const STORAGE_KEY = 'investment_sim_v1';

// Decode the URL-safe base64 produced by encodeState back into the data object.
function decodeState(token) {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(b64).split('').map((c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
}

// Minimal localStorage stand-in for the load path.
function mockLocalStorage(blob) {
  globalThis.localStorage = {
    _v: blob,
    getItem() { return this._v; },
    setItem(_k, v) { this._v = v; },
    removeItem() { this._v = null; },
  };
}

describe('encodeState', () => {
  it('round-trips the new fields and drops the dead withdrawalRate', () => {
    etfCostRate.value = 0.35;
    withdrawalVolatility.value = 17;
    targetSuccessRate.value = 85;
    pensionHasChildren.value = false;

    const data = decodeState(encodeState());

    expect(data.cost).toBe(0.35);
    expect(data.vol).toBe(17);
    expect(data.tsr).toBe(85);
    expect(data.phc).toBe(0);
    expect('wr' in data).toBe(false); // dead withdrawalRate removed
    // Rendite is carried as a band, not a single rate.
    expect(data.yp[0]).toHaveProperty('lo');
    expect(data.yp[0]).toHaveProperty('hi');
  });
});

describe('loadFromLocal', () => {
  it('migrates a legacy single-rate phase to a collapsed band', () => {
    mockLocalStorage(JSON.stringify({
      initialCapital: 50000,
      durationYears: 10,
      yieldPhases: [{ id: 1, startYear: 1, endYear: 10, rate: 7, customDuration: false }],
      transactions: [{ id: 1, name: 'Sparplan', amount: 200, type: 'monthly', startYear: 1, endYear: 10 }],
    }));
    loadFromLocal();
    expect(initialCapital.value).toBe(50000);
    expect(yieldPhases.value[0].rateMin).toBe(7);
    expect(yieldPhases.value[0].rateMax).toBe(7);
    expect(yieldPhases.value[0].rate).toBeUndefined();
  });

  it('does not throw or wipe the restore when arrays are missing', () => {
    mockLocalStorage(JSON.stringify({ initialCapital: 12345, durationYears: 8 }));
    expect(() => loadFromLocal()).not.toThrow();
    expect(initialCapital.value).toBe(12345);
    expect(durationYears.value).toBe(8);
    // yieldPhases/transactions keep whatever they were — not clobbered to undefined.
    expect(Array.isArray(yieldPhases.value)).toBe(true);
    expect(Array.isArray(transactions.value)).toBe(true);
  });

  it('clamps out-of-range persisted values', () => {
    mockLocalStorage(JSON.stringify({
      initialCapital: 1000,
      durationYears: 5,
      etfCostRate: 99,
      targetSuccessRate: 5,
      yieldPhases: [{ id: 1, startYear: 1, endYear: 5, rateMin: 4, rateMax: 8 }],
      transactions: [],
    }));
    loadFromLocal();
    expect(etfCostRate.value).toBeLessThanOrEqual(3);
    expect(targetSuccessRate.value).toBeGreaterThanOrEqual(50);
  });
});
