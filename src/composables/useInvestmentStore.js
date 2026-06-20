import { ref, watch } from 'vue';

const STORAGE_KEY = 'investment_sim_v1';

// URL-safe base64 helpers (handles Unicode via TextEncoder)
function toBase64(str) {
  return btoa(new TextEncoder().encode(str).reduce((s, b) => s + String.fromCharCode(b), ''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function fromBase64(b64) {
  const bytes = atob(b64.replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => c.charCodeAt(0));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

// --- Growth phase state ---
export const initialCapital = ref(30000);
export const durationYears = ref(15);
export const reinvestGains = ref(true);
export const inflationRate = ref(2.5);
// Rendite is given as a BAND [rateMin, rateMax] per phase rather than a single
// figure. `returnScenario` then picks which edge of every band drives the
// projection (and the Endkapital handed to the withdrawal phase):
//   'avg'   → midpoint of the band (default)
//   'worst' → lower edge
//   'best'  → upper edge
// Default 4–10 % brackets realistic long-horizon (15 yr+) net returns of a broad
// global equity ETF: ~7 % midpoint (the historical real ~5 % + ~2.5 % inflation),
// a 4 % floor for a poor stretch and a 10 % ceiling for a strong one.
export const yieldPhases = ref([
  { id: 1, startYear: 1, endYear: 15, rateMin: 4, rateMax: 10, customDuration: false },
]);
export const returnScenario = ref('avg'); // 'avg' | 'worst' | 'best'

// Resolve a phase's band to the single annual rate (%) for a given scenario.
export function scenarioRate(phase, scenario = returnScenario.value) {
  const lo = Math.min(Number(phase.rateMin), Number(phase.rateMax));
  const hi = Math.max(Number(phase.rateMin), Number(phase.rateMax));
  if (scenario === 'worst') return lo;
  if (scenario === 'best') return hi;
  return (lo + hi) / 2;
}
export const transactions = ref([
  { id: 1, name: 'Sparplan', amount: 500, type: 'monthly', startYear: 1, endYear: 15, customDuration: false },
]);

// --- Withdrawal phase state ---
export const withdrawalPlanYears = ref(30);
export const allowCapitalDecay = ref(true);
export const withdrawalReturnRate = ref(6);
// Withdrawal strategy: 'dynamic' (VPW — amortise the current depot each year, the
// default) | 'real' (inflation-indexed fixed €) | 'nominal' (fixed €).
export const withdrawalMode = ref('dynamic');

// --- Pension (Gesetzliche Rente) ---
// pensionMonthly is given in today's purchasing power (€/Monat, brutto).
export const pensionMonthly = ref(0);
export const pensionStartAge = ref(67);
export const withdrawalStartAge = ref(60);
// Pflegeversicherung surcharge for the childless is higher; drives the KV/PV
// deduction applied to the gross pension.
export const pensionHasChildren = ref(true);
// Income bridge: before the pension starts, the depot pre-pays ~the later net
// pension so total income doesn't jump at Rentenbeginn (early-retirement bridge).
export const bridgeIncome = ref(false);

// --- Monte-Carlo / advanced (sensible defaults, hidden behind "Erweiterte Einstellungen") ---
// Annual volatility (stdev) of the depot return — drives the spread of scenarios.
export const withdrawalVolatility = ref(15);
// Solve the withdrawal so this share of simulated market paths survives the plan.
export const targetSuccessRate = ref(90);
// All-in annual product cost (TER + spreads), subtracted from the gross return.
export const etfCostRate = ref(0.2);
// VPW amortisation return (g, real %) — used ONLY to size the dynamic withdrawal,
// deliberately separate from the Monte-Carlo market return above.
export const vpwReturn = ref(4);

// --- URL state sharing ---
export function encodeState() {
  const data = {
    ic: initialCapital.value,
    dy: durationYears.value,
    rg: reinvestGains.value ? 1 : 0,
    ir: inflationRate.value,
    wpy: withdrawalPlanYears.value,
    acd: allowCapitalDecay.value ? 1 : 0,
    wrr: withdrawalReturnRate.value,
    wm: withdrawalMode.value,
    pm: pensionMonthly.value,
    psa: pensionStartAge.value,
    wsa: withdrawalStartAge.value,
    phc: pensionHasChildren.value ? 1 : 0,
    bi: bridgeIncome.value ? 1 : 0,
    vol: withdrawalVolatility.value,
    tsr: targetSuccessRate.value,
    cost: etfCostRate.value,
    vpw: vpwReturn.value,
    rsc: returnScenario.value,
    yp: yieldPhases.value.map(p => ({ s: p.startYear, e: p.endYear, lo: p.rateMin, hi: p.rateMax, cd: p.customDuration ? 1 : 0 })),
    tr: transactions.value.map(tx => ({ n: tx.name, a: tx.amount, tp: tx.type === 'monthly' ? 'm' : 'o', s: tx.startYear, e: tx.endYear, cd: tx.customDuration ? 1 : 0 })),
  };
  return toBase64(JSON.stringify(data));
}

function applyState(data) {
  if (data.ic !== undefined) initialCapital.value = data.ic;
  if (data.dy !== undefined) durationYears.value = data.dy;
  if (data.rg !== undefined) reinvestGains.value = !!data.rg;
  if (data.ir !== undefined) inflationRate.value = data.ir;
  if (data.wpy !== undefined) withdrawalPlanYears.value = Math.min(80, Math.max(1, Number(data.wpy)));
  if (data.acd !== undefined) allowCapitalDecay.value = !!data.acd;
  if (data.wrr !== undefined) withdrawalReturnRate.value = Math.min(20, Math.max(0, Number(data.wrr)));
  if (data.wm === 'real' || data.wm === 'nominal' || data.wm === 'dynamic') withdrawalMode.value = data.wm;
  if (data.pm !== undefined) pensionMonthly.value = Math.max(0, Number(data.pm) || 0);
  if (data.psa !== undefined) pensionStartAge.value = Math.min(80, Math.max(50, Number(data.psa) || 67));
  if (data.wsa !== undefined) withdrawalStartAge.value = Math.min(90, Math.max(30, Number(data.wsa) || 60));
  if (data.phc !== undefined) pensionHasChildren.value = !!data.phc;
  if (data.bi !== undefined) bridgeIncome.value = !!data.bi;
  if (data.vol !== undefined) withdrawalVolatility.value = Math.min(40, Math.max(0, Number(data.vol)));
  if (data.tsr !== undefined) targetSuccessRate.value = Math.min(99, Math.max(50, Number(data.tsr)));
  if (data.cost !== undefined) etfCostRate.value = Math.min(3, Math.max(0, Number(data.cost)));
  if (data.vpw !== undefined) vpwReturn.value = Math.min(15, Math.max(0, Number(data.vpw)));
  if (data.rsc === 'worst' || data.rsc === 'best' || data.rsc === 'avg') returnScenario.value = data.rsc;
  if (data.yp) {
    // Coerce + clamp like the scalar fields above, so a hand-edited/garbage
    // share link can't push NaN/out-of-range rates into the projection.
    const clampRate = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(20, Math.max(-15, n)) : fallback;
    };
    yieldPhases.value = data.yp.map((p, i) => {
      // Newer links carry a band (lo/hi); older links only a single rate (r).
      const hasBand = p.lo !== undefined || p.hi !== undefined;
      const lo = clampRate(hasBand ? p.lo : p.r, 5);
      const hi = clampRate(hasBand ? p.hi : p.r, lo);
      return { id: i + 1, startYear: p.s, endYear: p.e, rateMin: lo, rateMax: hi, customDuration: !!p.cd };
    });
  }
  if (data.tr) {
    transactions.value = data.tr.map((t, i) => ({
      id: i + 1, name: t.n, amount: t.a, type: t.tp === 'm' ? 'monthly' : 'onetime',
      startYear: t.s, endYear: t.e, customDuration: !!t.cd,
    }));
  }
}

function loadFromUrl() {
  const qi = window.location.hash.indexOf('?');
  if (qi === -1) return false;
  const encoded = new URLSearchParams(window.location.hash.slice(qi)).get('s');
  if (!encoded) return false;
  try {
    const data = JSON.parse(fromBase64(encoded));
    applyState(data);
    history.replaceState(null, '', window.location.pathname + window.location.hash.slice(0, qi));
    // Update tab title so the plan is identifiable in browser history
    if (data.ic !== undefined && data.dy !== undefined) {
      document.title = `ETF-Rechner – ${(data.ic / 1000).toFixed(0)}k Startkapital, ${data.dy} Jahre`;
    }
    return true;
  } catch {
    return false;
  }
}

// --- Persistence ---
function saveToLocal() {
  const data = {
    initialCapital: initialCapital.value,
    durationYears: durationYears.value,
    reinvestGains: reinvestGains.value,
    inflationRate: inflationRate.value,
    returnScenario: returnScenario.value,
    yieldPhases: yieldPhases.value,
    transactions: transactions.value,
    withdrawalPlanYears: withdrawalPlanYears.value,
    allowCapitalDecay: allowCapitalDecay.value,
    withdrawalReturnRate: withdrawalReturnRate.value,
    withdrawalMode: withdrawalMode.value,
    pensionMonthly: pensionMonthly.value,
    pensionStartAge: pensionStartAge.value,
    withdrawalStartAge: withdrawalStartAge.value,
    pensionHasChildren: pensionHasChildren.value,
    bridgeIncome: bridgeIncome.value,
    withdrawalVolatility: withdrawalVolatility.value,
    targetSuccessRate: targetSuccessRate.value,
    etfCostRate: etfCostRate.value,
    vpwReturn: vpwReturn.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadFromLocal() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    initialCapital.value = parsed.initialCapital;
    durationYears.value = parsed.durationYears;
    if (parsed.reinvestGains !== undefined) reinvestGains.value = parsed.reinvestGains;
    if (parsed.inflationRate !== undefined) {
      const rate = Number(parsed.inflationRate);
      inflationRate.value = Number.isFinite(rate) ? Math.min(20, Math.max(0, rate)) : 2.5;
    }
    if (parsed.withdrawalPlanYears !== undefined) {
      const years = Number(parsed.withdrawalPlanYears);
      withdrawalPlanYears.value = Number.isFinite(years) ? Math.min(80, Math.max(1, years)) : 30;
    }
    if (parsed.allowCapitalDecay !== undefined) allowCapitalDecay.value = !!parsed.allowCapitalDecay;
    if (parsed.withdrawalReturnRate !== undefined) {
      const rate = Number(parsed.withdrawalReturnRate);
      withdrawalReturnRate.value = Number.isFinite(rate) ? Math.min(20, Math.max(0, rate)) : 6;
    }
    if (['real', 'nominal', 'dynamic'].includes(parsed.withdrawalMode)) {
      withdrawalMode.value = parsed.withdrawalMode;
    }
    if (parsed.pensionMonthly !== undefined) {
      const v = Number(parsed.pensionMonthly);
      pensionMonthly.value = Number.isFinite(v) ? Math.max(0, v) : 0;
    }
    if (parsed.pensionStartAge !== undefined) {
      const v = Number(parsed.pensionStartAge);
      pensionStartAge.value = Number.isFinite(v) ? Math.min(80, Math.max(50, v)) : 67;
    }
    if (parsed.withdrawalStartAge !== undefined) {
      const v = Number(parsed.withdrawalStartAge);
      withdrawalStartAge.value = Number.isFinite(v) ? Math.min(90, Math.max(30, v)) : 60;
    }
    if (parsed.pensionHasChildren !== undefined) pensionHasChildren.value = !!parsed.pensionHasChildren;
    if (parsed.bridgeIncome !== undefined) bridgeIncome.value = !!parsed.bridgeIncome;
    if (parsed.withdrawalVolatility !== undefined) {
      const v = Number(parsed.withdrawalVolatility);
      withdrawalVolatility.value = Number.isFinite(v) ? Math.min(40, Math.max(0, v)) : 15;
    }
    if (parsed.targetSuccessRate !== undefined) {
      const v = Number(parsed.targetSuccessRate);
      targetSuccessRate.value = Number.isFinite(v) ? Math.min(99, Math.max(50, v)) : 90;
    }
    if (parsed.etfCostRate !== undefined) {
      const v = Number(parsed.etfCostRate);
      etfCostRate.value = Number.isFinite(v) ? Math.min(3, Math.max(0, v)) : 0.2;
    }
    if (parsed.vpwReturn !== undefined) {
      const v = Number(parsed.vpwReturn);
      vpwReturn.value = Number.isFinite(v) ? Math.min(15, Math.max(0, v)) : 4;
    }
    if (parsed.returnScenario === 'worst' || parsed.returnScenario === 'best' || parsed.returnScenario === 'avg') {
      returnScenario.value = parsed.returnScenario;
    }
    // Guard like every field above: a partial/corrupt blob missing these arrays
    // must not throw (which the catch would swallow, wiping the whole restore).
    if (Array.isArray(parsed.yieldPhases)) {
      yieldPhases.value = parsed.yieldPhases.map((p) => {
        const out = { ...p };
        // Migrate single-rate phases (pre-band) to a collapsed band.
        if (out.rateMin === undefined) out.rateMin = out.rate ?? 5;
        if (out.rateMax === undefined) out.rateMax = out.rate ?? out.rateMin;
        delete out.rate;
        if (out.customDuration === undefined) out.customDuration = false;
        return out;
      });
    }
    if (Array.isArray(parsed.transactions)) {
      transactions.value = parsed.transactions.map((t) => {
        if (t.duration !== undefined && t.endYear === undefined) {
          return { ...t, endYear: t.startYear + t.duration - 1, duration: undefined, customDuration: true };
        }
        if (t.customDuration === undefined) t.customDuration = false;
        return t;
      });
    }
  } catch {
    /* ignore corrupt local storage */
  }
}

// --- Mutators ---
export const addPhase = () =>
  yieldPhases.value.push({ id: Date.now(), startYear: 1, endYear: durationYears.value, rateMin: 3, rateMax: 7, customDuration: false });
export const removePhase = (id) => (yieldPhases.value = yieldPhases.value.filter((p) => p.id !== id));

export const addTransaction = () =>
  transactions.value.push({ id: Date.now(), name: 'Zusätzliche Einzahlung', amount: 500, type: 'monthly', startYear: 1, endYear: durationYears.value, customDuration: false });
export const removeTransaction = (id) => (transactions.value = transactions.value.filter((t) => t.id !== id));

export const toggleCustomDuration = (item) => {
  item.customDuration = !item.customDuration;
  if (!item.customDuration) {
    item.startYear = 1;
    item.endYear = durationYears.value;
  }
};

// --- Setup wiring (call once from main.js / App.vue) ---
let initialized = false;
export function initInvestmentStore() {
  if (initialized) return;
  initialized = true;
  if (!loadFromUrl()) loadFromLocal();

  watch(
    [
      initialCapital,
      durationYears,
      reinvestGains,
      inflationRate,
      returnScenario,
      yieldPhases,
      transactions,
      withdrawalPlanYears,
      allowCapitalDecay,
      withdrawalReturnRate,
      withdrawalMode,
      pensionMonthly,
      pensionStartAge,
      withdrawalStartAge,
      pensionHasChildren,
      bridgeIncome,
      withdrawalVolatility,
      targetSuccessRate,
      etfCostRate,
      vpwReturn,
    ],
    () => saveToLocal(),
    { deep: true },
  );

  // Auto-extend yield phases & transactions when total duration increases
  watch(durationYears, (newVal, oldVal) => {
    if (newVal > oldVal) {
      yieldPhases.value.forEach((p) => {
        if (!p.customDuration) {
          p.startYear = 1;
          p.endYear = newVal;
        } else if (p.endYear === oldVal) {
          p.endYear = newVal;
        }
      });
      transactions.value.forEach((t) => {
        if (t.type === 'monthly' && !t.customDuration) t.endYear = newVal;
        else if (t.type === 'monthly' && t.endYear === oldVal) t.endYear = newVal;
      });
    }
  });
}
