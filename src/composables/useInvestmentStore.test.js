import { describe, it, expect, beforeEach } from 'vitest';
import {
  encodeState,
  serializeState,
  applyState,
  loadFromLocal,
  initialCapital,
  durationYears,
  reinvestGains,
  inflationRate,
  returnScenario,
  withdrawalPlanYears,
  allowCapitalDecay,
  withdrawalReturnRate,
  withdrawalMode,
  pensionMonthly,
  pensionStartAge,
  withdrawalStartAge,
  etfCostRate,
  withdrawalVolatility,
  targetSuccessRate,
  pensionHasChildren,
  bridgeIncome,
  vpwReturn,
  yieldPhases,
  transactions,
  savedScenarios,
  saveScenario,
  applyScenario,
  deleteScenario,
  loadScenariosFromLocal,
  MAX_SCENARIOS,
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

  it('keeps initialCapital/durationYears finite when the blob omits them', () => {
    initialCapital.value = 55555;
    durationYears.value = 12;
    mockLocalStorage(JSON.stringify({ inflationRate: 2 })); // valid JSON, missing both keys
    loadFromLocal();
    expect(Number.isFinite(initialCapital.value)).toBe(true);
    expect(Number.isFinite(durationYears.value)).toBe(true);
    expect(initialCapital.value).toBe(55555); // untouched, not set to undefined
    expect(durationYears.value).toBe(12);
  });
});

// Every setting must survive a share-link round-trip (serialize → encode → decode
// → applyState). This is the guard for "all settings are saved when sharing".
describe('share-link round-trip', () => {
  it('restores every setting, including a one-time deposit and multi-phase bands', () => {
    initialCapital.value = 77777;
    durationYears.value = 22;
    reinvestGains.value = false;
    inflationRate.value = 3.3;
    withdrawalPlanYears.value = 40;
    allowCapitalDecay.value = false;
    withdrawalReturnRate.value = 5.5;
    withdrawalMode.value = 'nominal';
    pensionMonthly.value = 1800;
    pensionStartAge.value = 65;
    withdrawalStartAge.value = 58;
    pensionHasChildren.value = false;
    bridgeIncome.value = true;
    withdrawalVolatility.value = 18;
    targetSuccessRate.value = 80;
    etfCostRate.value = 0.35;
    vpwReturn.value = 3.5;
    returnScenario.value = 'best';
    yieldPhases.value = [
      { id: 1, startYear: 1, endYear: 10, rateMin: 3, rateMax: 9, customDuration: true },
      { id: 2, startYear: 11, endYear: 22, rateMin: 2, rateMax: 6, customDuration: false },
    ];
    transactions.value = [
      { id: 1, name: 'Sparplan', amount: 500, type: 'monthly', startYear: 1, endYear: 22, customDuration: false },
      { id: 2, name: 'Bonus', amount: 5000, type: 'once', startYear: 5, endYear: 5, customDuration: false },
    ];

    const token = encodeState();

    // Scramble everything, then restore from the link.
    initialCapital.value = 1; durationYears.value = 1; reinvestGains.value = true;
    inflationRate.value = 0; withdrawalPlanYears.value = 1; allowCapitalDecay.value = true;
    withdrawalReturnRate.value = 0; withdrawalMode.value = 'dynamic'; pensionMonthly.value = 0;
    pensionStartAge.value = 67; withdrawalStartAge.value = 60; pensionHasChildren.value = true;
    bridgeIncome.value = false; withdrawalVolatility.value = 15; targetSuccessRate.value = 90;
    etfCostRate.value = 0.2; vpwReturn.value = 4; returnScenario.value = 'avg';
    yieldPhases.value = []; transactions.value = [];

    applyState(decodeState(token));

    expect(initialCapital.value).toBe(77777);
    expect(durationYears.value).toBe(22);
    expect(reinvestGains.value).toBe(false);
    expect(inflationRate.value).toBe(3.3);
    expect(withdrawalPlanYears.value).toBe(40);
    expect(allowCapitalDecay.value).toBe(false);
    expect(withdrawalReturnRate.value).toBe(5.5);
    expect(withdrawalMode.value).toBe('nominal');
    expect(pensionMonthly.value).toBe(1800);
    expect(pensionStartAge.value).toBe(65);
    expect(withdrawalStartAge.value).toBe(58);
    expect(pensionHasChildren.value).toBe(false);
    expect(bridgeIncome.value).toBe(true);
    expect(withdrawalVolatility.value).toBe(18);
    expect(targetSuccessRate.value).toBe(80);
    expect(etfCostRate.value).toBe(0.35);
    expect(vpwReturn.value).toBe(3.5);
    expect(returnScenario.value).toBe('best');

    expect(yieldPhases.value).toHaveLength(2);
    expect(yieldPhases.value[0]).toMatchObject({ startYear: 1, endYear: 10, rateMin: 3, rateMax: 9, customDuration: true });
    expect(yieldPhases.value[1]).toMatchObject({ startYear: 11, endYear: 22, rateMin: 2, rateMax: 6, customDuration: false });

    expect(transactions.value).toHaveLength(2);
    expect(transactions.value[0]).toMatchObject({ name: 'Sparplan', amount: 500, type: 'monthly' });
    // Regression: a one-time deposit must come back as 'once' (not 'onetime'),
    // otherwise the projection silently drops it.
    expect(transactions.value[1]).toMatchObject({ name: 'Bonus', amount: 5000, type: 'once', startYear: 5, endYear: 5 });
  });

  it('every serialized key is read back by applyState (no orphan fields)', () => {
    const keys = Object.keys(serializeState());
    // Snapshot of the contract — bump this when a setting is intentionally added.
    expect(keys.sort()).toEqual([
      'acd', 'bi', 'cost', 'dy', 'ic', 'ir', 'pm', 'phc', 'psa', 'rg',
      'rsc', 'tr', 'tsr', 'vol', 'vpw', 'wm', 'wpy', 'wrr', 'wsa', 'yp',
    ].sort());
  });

  it('coerces NaN / out-of-range values from a hand-edited link', () => {
    applyState({
      ic: 'foo', dy: 9999, ir: -5,
      wpy: 'abc', wrr: NaN, pm: 'x', psa: NaN, wsa: 'y',
      vol: 'z', tsr: NaN, cost: 'q', vpw: NaN,
      yp: [{ s: NaN, e: 'x', lo: 5, hi: 5 }],
      tr: [{ n: 7, a: 'abc', tp: 'o', s: -99, e: 9999 }],
    });
    // Every scalar stays a finite number after a garbage link.
    for (const r of [
      initialCapital, durationYears, inflationRate, withdrawalPlanYears,
      withdrawalReturnRate, pensionMonthly, pensionStartAge, withdrawalStartAge,
      withdrawalVolatility, targetSuccessRate, etfCostRate, vpwReturn,
    ]) {
      expect(Number.isFinite(r.value)).toBe(true);
    }
    expect(durationYears.value).toBeLessThanOrEqual(120);
    expect(inflationRate.value).toBeGreaterThanOrEqual(0);
    const ph = yieldPhases.value[0];
    expect(Number.isFinite(ph.startYear) && Number.isFinite(ph.endYear)).toBe(true);
    const tx = transactions.value[0];
    expect(Number.isFinite(tx.amount)).toBe(true);
    expect(tx.startYear).toBeGreaterThanOrEqual(1);
    expect(tx.endYear).toBeLessThanOrEqual(120);
    expect(typeof tx.name).toBe('string');
  });
});

// Map-keyed localStorage (the settings mock above ignores the key).
function mockLocalStorageMap() {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
  return m;
}

describe('saved scenarios', () => {
  beforeEach(() => {
    mockLocalStorageMap();
    savedScenarios.value = [];
  });

  it('saves a lightweight snapshot of the current settings', () => {
    initialCapital.value = 42000;
    const item = saveScenario('Mein Plan');
    expect(savedScenarios.value).toHaveLength(1);
    expect(item.name).toBe('Mein Plan');
    expect(item.data.ic).toBe(42000);
    expect(item.id).toBeTruthy();
    expect(item.ts).toBeTruthy();
    // persisted to localStorage
    const raw = JSON.parse(globalThis.localStorage.getItem('investment_sim_scenarios_v1'));
    expect(raw).toHaveLength(1);
  });

  it('caps at MAX_SCENARIOS, newest first, dropping the oldest', () => {
    for (let i = 0; i < MAX_SCENARIOS + 2; i++) saveScenario(`P${i}`);
    expect(savedScenarios.value).toHaveLength(MAX_SCENARIOS);
    expect(savedScenarios.value[0].name).toBe(`P${MAX_SCENARIOS + 1}`); // newest
    expect(savedScenarios.value.at(-1).name).toBe('P2'); // P0, P1 dropped
  });

  it('restores a saved scenario via applyScenario', () => {
    initialCapital.value = 11111;
    withdrawalMode.value = 'real';
    const { id } = saveScenario('Snapshot');
    initialCapital.value = 22222;
    withdrawalMode.value = 'dynamic';
    expect(applyScenario(id)).toBe(true);
    expect(initialCapital.value).toBe(11111);
    expect(withdrawalMode.value).toBe('real');
  });

  it('deletes a scenario and reloads from storage', () => {
    const a = saveScenario('A');
    saveScenario('B');
    deleteScenario(a.id);
    expect(savedScenarios.value.map((s) => s.name)).toEqual(['B']);
    loadScenariosFromLocal();
    expect(savedScenarios.value.map((s) => s.name)).toEqual(['B']);
  });

  it('ignores corrupt scenario entries on load', () => {
    globalThis.localStorage.setItem(
      'investment_sim_scenarios_v1',
      JSON.stringify([{ id: 'x', name: 'ok', ts: 1, data: { ic: 1 } }, null, { name: 'no-data' }, 42]),
    );
    loadScenariosFromLocal();
    expect(savedScenarios.value).toHaveLength(1);
    expect(savedScenarios.value[0].name).toBe('ok');
  });
});
